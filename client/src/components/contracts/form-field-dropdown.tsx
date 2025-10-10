import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

interface FormField {
  id: string;
  type: 'checkbox' | 'text_input' | 'long_text_input' | 'initials' | 'signature';
  label: string;
  required: boolean;
}

interface FormFieldDropdownProps {
  onInsert: (field: FormField) => void;
}

const formFieldOptions = [
  { type: 'checkbox' as const, required: false, label: 'Checkbox (optional)' },
  { type: 'checkbox' as const, required: true, label: 'Checkbox (required)' },
  { type: 'initials' as const, required: true, label: 'Initials (required)' },
  { type: 'long_text_input' as const, required: false, label: 'Long text input (optional)' },
  { type: 'long_text_input' as const, required: true, label: 'Long text input (required)' },
  { type: 'text_input' as const, required: false, label: 'Short text input (optional)' },
  { type: 'text_input' as const, required: true, label: 'Short text input (required)' },
];

export default function FormFieldDropdown({ onInsert }: FormFieldDropdownProps) {
  const handleInsert = (type: FormField['type'], required: boolean, displayLabel: string) => {
    const field: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      label: displayLabel,
      required,
    };

    onInsert(field);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1"
          data-testid="button-insert-form"
        >
          Insert Form
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" data-testid="dropdown-insert-form">
        {formFieldOptions.map((option, index) => (
          <DropdownMenuItem
            key={index}
            onClick={() => handleInsert(option.type, option.required, option.label)}
            data-testid={`form-option-${option.type}-${option.required ? 'required' : 'optional'}`}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
