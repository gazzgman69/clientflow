import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FormField {
  id: string;
  type: 'checkbox' | 'text_input' | 'initials' | 'signature';
  label: string;
  required: boolean;
}

interface FormFieldDropdownProps {
  onInsert: (field: FormField) => void;
}

export default function FormFieldDropdown({ onInsert }: FormFieldDropdownProps) {
  const [open, setOpen] = useState(false);
  const [fieldType, setFieldType] = useState<FormField['type']>('checkbox');
  const [label, setLabel] = useState('');
  const [required, setRequired] = useState(true);

  const handleInsert = () => {
    if (!label.trim()) {
      alert('Please enter a label for the form field');
      return;
    }

    const field: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: fieldType,
      label: label.trim(),
      required,
    };

    onInsert(field);
    
    // Reset form
    setLabel('');
    setFieldType('checkbox');
    setRequired(true);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="button-insert-form"
        >
          INSERT FORM
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" data-testid="dialog-insert-form">
        <DialogHeader>
          <DialogTitle>Insert Form Field</DialogTitle>
          <DialogDescription>
            Add an interactive form field that clients can fill out when signing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="field-type">Field Type</Label>
            <Select
              value={fieldType}
              onValueChange={(value) => setFieldType(value as FormField['type'])}
            >
              <SelectTrigger id="field-type" data-testid="select-field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checkbox" data-testid="option-checkbox">
                  Checkbox
                </SelectItem>
                <SelectItem value="text_input" data-testid="option-text-input">
                  Text Input
                </SelectItem>
                <SelectItem value="initials" data-testid="option-initials">
                  Initials
                </SelectItem>
                <SelectItem value="signature" data-testid="option-signature">
                  Signature
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {fieldType === 'checkbox' && 'A checkbox that must be checked'}
              {fieldType === 'text_input' && 'A text input field'}
              {fieldType === 'initials' && 'A field for client initials'}
              {fieldType === 'signature' && 'A field for client signature'}
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="field-label">Label</Label>
            <Input
              id="field-label"
              placeholder="e.g., I agree to the terms"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              data-testid="input-field-label"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="field-required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4"
              data-testid="checkbox-field-required"
            />
            <Label htmlFor="field-required" className="font-normal cursor-pointer">
              Required field
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="button-cancel-form"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleInsert}
            data-testid="button-confirm-insert-form"
          >
            Insert Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
