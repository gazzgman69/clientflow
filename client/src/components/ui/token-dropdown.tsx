import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Hash, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface TokenGroup {
  [category: string]: {
    [token: string]: string; // token name -> description
  };
}

interface TokenDropdownProps {
  onTokenSelect: (token: string) => void;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  onAfterInsert?: () => void;
}

export function TokenDropdown({ 
  onTokenSelect, 
  className = "", 
  variant = "outline",
  size = "default",
  onAfterInsert
}: TokenDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch available tokens
  const { data: tokenData, isLoading } = useQuery<{ success: boolean; tokens: TokenGroup }>({
    queryKey: ['/api/tokens/list'],
    queryFn: async () => {
      const response = await fetch('/api/tokens/list', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch tokens');
      return response.json();
    },
  });

  const tokens = tokenData?.tokens || {};

  // Filter and flatten tokens for search
  const filteredTokens = Object.entries(tokens).reduce<Array<{
    category: string;
    token: string;
    description: string;
    fullToken: string;
  }>>((acc, [category, categoryTokens]) => {
    Object.entries(categoryTokens).forEach(([token, description]) => {
      const fullToken = token.startsWith('[') ? token : `[${token}]`;
      const searchText = `${token} ${description} ${category}`.toLowerCase();
      
      if (!searchQuery || searchText.includes(searchQuery.toLowerCase())) {
        acc.push({
          category,
          token,
          description,
          fullToken
        });
      }
    });
    return acc;
  }, []);

  // Group filtered tokens by category for display
  const groupedFilteredTokens = filteredTokens.reduce<Record<string, typeof filteredTokens>>((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery('');
          setSelectedIndex(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredTokens.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && filteredTokens[selectedIndex]) {
            handleTokenSelect(filteredTokens[selectedIndex].fullToken);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedIndex, filteredTokens]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleTokenSelect = (token: string) => {
    onTokenSelect(token);
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(-1);
    
    // Restore focus to the editor after a longer delay to ensure dropdown closes first
    // Radix UI's dropdown returns focus to trigger, so we need to override that
    if (onAfterInsert) {
      setTimeout(() => {
        onAfterInsert();
      }, 300);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      contact: 'bg-blue-100 text-blue-800 border-blue-200',
      project: 'bg-green-100 text-green-800 border-green-200',
      business: 'bg-purple-100 text-purple-800 border-purple-200',
      system: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCategoryDisplayName = (category: string) => {
    const names = {
      contact: 'Contact',
      project: 'Project', 
      business: 'Business',
      system: 'System',
    };
    return names[category as keyof typeof names] || category;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant}
          size={size}
          className={`gap-1 ${className}`}
          aria-label="Insert token"
          data-testid="button-insert-token"
        >
          <Hash className={className?.includes("h-7") ? "h-2.5 w-2.5" : size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          Insert Token
          <ChevronDown className={className?.includes("h-7") ? "h-2.5 w-2.5" : size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        ref={menuRef}
        className="w-80 p-0 !max-h-[200px] !overflow-y-scroll pointer-events-auto"
        align="start"
        data-testid="token-dropdown-content"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b bg-background">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(-1);
              }}
              className="pl-8"
              data-testid="input-token-search"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-6 w-6 p-0"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedIndex(-1);
                  searchInputRef.current?.focus();
                }}
                data-testid="button-clear-search"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading tokens...
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery ? 'No tokens found' : 'No tokens available'}
          </div>
        ) : (
          <div className="p-2 space-y-3">
            {Object.entries(groupedFilteredTokens).map(([category, categoryTokens]) => (
              <div key={category} className="space-y-1">
                <div className="flex items-center gap-2 px-2 py-1">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs font-medium ${getCategoryColor(category)}`}
                  >
                    {getCategoryDisplayName(category)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {categoryTokens.length} token{categoryTokens.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                {categoryTokens.map((item, index) => {
                  const globalIndex = filteredTokens.findIndex(t => t === item);
                  const isSelected = globalIndex === selectedIndex;
                  
                  return (
                    <div
                      key={`${category}-${item.token}`}
                      className={`px-2 py-2 rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                      }`}
                      onClick={() => handleTokenSelect(item.fullToken)}
                      data-testid={`token-option-${category}-${item.token.replace(/[^a-zA-Z0-9]/g, '-')}`}
                    >
                      <div className="font-mono text-sm font-medium text-primary">
                        {item.fullToken}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}