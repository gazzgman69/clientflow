import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface Question {
  id?: string;
  type: string;
  label: string;
  required: boolean;
  mapTo: string;
  options?: string;
  orderIndex: number;
}

interface QuestionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (question: Question) => void;
  question?: Question | null;
  nextOrderIndex: number;
}

const QUESTION_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone Number' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Checkboxes' },
];

const MAP_TO_OPTIONS = [
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'leadSource', label: 'Lead Source' },
  { value: 'notes', label: 'Notes' },
  { value: 'custom', label: 'Custom Field' },
];

export default function QuestionEditor({ 
  isOpen, 
  onClose, 
  onSave, 
  question, 
  nextOrderIndex 
}: QuestionEditorProps) {
  const form = useForm<Question>({
    defaultValues: {
      type: 'text',
      label: '',
      required: false,
      mapTo: 'custom',
      options: '',
      orderIndex: nextOrderIndex,
    },
  });

  useEffect(() => {
    if (question) {
      form.reset(question);
    } else {
      form.reset({
        type: 'text',
        label: '',
        required: false,
        mapTo: 'custom',
        options: '',
        orderIndex: nextOrderIndex,
      });
    }
  }, [question, nextOrderIndex, form]);

  const selectedType = form.watch('type');
  const needsOptions = ['select', 'radio', 'checkbox'].includes(selectedType);

  const handleSave = (data: Question) => {
    onSave({
      ...data,
      id: question?.id || `q_${Date.now()}`,
    });
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" data-testid="question-editor-dialog">
        <DialogHeader>
          <DialogTitle>
            {question ? 'Edit Question' : 'Add Question'}
          </DialogTitle>
          <DialogDescription>
            Configure the question settings and field mapping
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-question-type">
                        <SelectValue placeholder="Select question type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {QUESTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Label</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Enter the question text"
                      data-testid="input-question-label"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mapTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Map To Field</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-map-to">
                        <SelectValue placeholder="Select field mapping" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MAP_TO_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {needsOptions && (
              <FormField
                control={form.control}
                name="options"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Options</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter options separated by commas (e.g., Option 1, Option 2, Option 3)"
                        rows={3}
                        data-testid="textarea-question-options"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Separate each option with a comma
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="required"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Required Field</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Users must fill out this question to submit the form
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-question-required"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                data-testid="button-cancel-question"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="button-save-question"
              >
                {question ? 'Update Question' : 'Add Question'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}