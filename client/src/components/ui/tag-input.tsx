import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Tag } from "@shared/schema";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

interface TagData extends Tag {}

export function TagInput({ value = [], onChange, placeholder = "Add tags...", className }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch all tags for autocomplete
  const { data: allTags = [] } = useQuery<TagData[]>({
    queryKey: ['/api/tags'],
  });

  // Filter tags based on input and exclude already selected tags
  const suggestions = inputValue.trim()
    ? allTags
        .filter(tag => 
          tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
          !value.includes(tag.name)
        )
        .slice(0, 5)
    : [];

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = async (tagName: string) => {
    const trimmedTag = tagName.trim();
    if (!trimmedTag || value.includes(trimmedTag) || isCreating) return;

    // Create tag in backend (or get existing)
    try {
      setIsCreating(true);
      await apiRequest('POST', '/api/tags', { name: trimmedTag });
      
      // Invalidate tags query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      
      // Add to local state
      onChange([...value, trimmedTag]);
      setInputValue("");
      setShowSuggestions(false);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0 && selectedIndex < suggestions.length) {
        addTag(suggestions[selectedIndex].name);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
    setSelectedIndex(0);
  };

  // Get tag color from backend or use default
  const getTagColor = (tagName: string) => {
    const tag = allTags.find(t => t.name === tagName);
    return tag?.color || '#3b82f6';
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="flex flex-wrap gap-2 p-2 border rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 bg-background">
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 pr-1"
            style={{
              backgroundColor: `${getTagColor(tag)}20`,
              color: getTagColor(tag),
              borderColor: getTagColor(tag)
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 hover:bg-black/10 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-6"
        />
      </div>

      {/* Autocomplete Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg">
          {suggestions.map((tag, index) => (
            <div
              key={tag.id}
              className={`px-3 py-2 cursor-pointer hover:bg-accent flex items-center gap-2 ${
                index === selectedIndex ? 'bg-accent' : ''
              }`}
              onClick={() => addTag(tag.name)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span>{tag.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {tag.usageCount || 0} uses
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
