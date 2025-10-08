import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import ContractEditor from '@/components/contract-editor';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { insertContractSchema } from '@shared/schema';
import type { Contact, Project, ContractTemplate } from '@shared/schema';
import { cn } from '@/lib/utils';

interface FormField {
  id: string;
  type: 'checkbox' | 'text_input' | 'long_text_input' | 'initials' | 'signature';
  label: string;
  required: boolean;
}

const createContractFormSchema = insertContractSchema.extend({
  contactId: z.string().min(1, 'Contact is required'),
  title: z.string().min(1, 'Title is required'),
});

interface CreateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContactId?: string;
  initialProjectId?: string;
  contract?: any;
}

export default function CreateContractDialog({ 
  open, 
  onOpenChange,
  initialContactId,
  initialProjectId,
  contract 
}: CreateContractDialogProps) {
  const [bodyHtml, setBodyHtml] = useState(contract?.bodyHtml || '');
  const [formFields, setFormFields] = useState<FormField[]>(
    contract?.formFields ? JSON.parse(contract.formFields) : []
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contactsData } = useQuery<{ contacts: Contact[] }>({
    queryKey: ['/api/contacts'],
  });
  const contacts = contactsData?.contacts;

  const { data: templates, isLoading: isLoadingTemplates, error: templatesError } = useQuery<ContractTemplate[]>({
    queryKey: ['/api/contract-templates'],
    enabled: open,
  });

  console.log('Templates query state:', { 
    templates, 
    isLoadingTemplates, 
    templatesError, 
    open,
    hasTemplates: templates && templates.length > 0,
    errorMessage: templatesError?.message || 'No error message'
  });

  const form = useForm<z.infer<typeof createContractFormSchema>>({
    resolver: zodResolver(createContractFormSchema),
    defaultValues: {
      title: contract?.title || '',
      displayTitle: contract?.displayTitle || '',
      contactId: contract?.contactId || initialContactId || '',
      projectId: contract?.projectId || initialProjectId || '',
      bodyHtml: contract?.bodyHtml || '',
      signatureWorkflow: contract?.signatureWorkflow || 'counter_sign_after_client',
      status: contract?.status || 'draft',
      dueDate: contract?.dueDate ? new Date(contract.dueDate) : undefined,
    },
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createContractFormSchema>) => {
      const contractData = {
        ...data,
        bodyHtml,
        formFields: JSON.stringify(formFields),
      };
      
      // Update existing contract or create new one
      const response = contract 
        ? await apiRequest('PATCH', `/api/contracts/${contract.id}`, contractData)
        : await apiRequest('POST', '/api/contracts', contractData);
      const savedContract = await response.json();
      
      // If save as template is checked, also create a template
      if (saveAsTemplate) {
        if (!templateName.trim()) {
          throw new Error('Template name is required');
        }
        const templateData = {
          name: templateName.trim(),
          displayTitle: data.displayTitle,
          signatureWorkflow: data.signatureWorkflow,
          bodyHtml,
          formFields: JSON.stringify(formFields),
        };
        await apiRequest('POST', '/api/contract-templates', templateData);
      }
      
      return savedContract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      if (saveAsTemplate) {
        queryClient.invalidateQueries({ queryKey: ['/api/contract-templates'] });
      }
      toast({
        title: 'Success',
        description: contract 
          ? (saveAsTemplate ? 'Contract updated and template saved!' : 'Contract updated successfully!')
          : (saveAsTemplate ? 'Contract and template created successfully!' : 'Contract created successfully!'),
      });
      form.reset();
      setBodyHtml('');
      setFormFields([]);
      setSelectedTemplateId('');
      setSaveAsTemplate(false);
      setTemplateName('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || `Failed to ${contract ? 'update' : 'create'} contract. Please try again.`,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (selectedTemplateId && templates) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        form.setValue('displayTitle', template.displayTitle || '');
        form.setValue('signatureWorkflow', template.signatureWorkflow || 'counter_sign_after_client');
        setBodyHtml(template.bodyHtml || '');
        
        try {
          const fields = template.formFields ? JSON.parse(template.formFields) : [];
          setFormFields(fields);
        } catch (error) {
          console.error('Failed to parse template form fields:', error);
          setFormFields([]);
        }
      }
    }
  }, [selectedTemplateId, templates, form]);

  const onSubmit = (data: z.infer<typeof createContractFormSchema>) => {
    createContractMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{contract ? 'Edit Contract' : 'Create Contract'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1">
              {/* Title with inline Templates dropdown */}
              <div className="flex gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Title:</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-contract-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {!contract && templates && templates.length > 0 && (
                  <FormItem className="w-48">
                    <FormLabel>&nbsp;</FormLabel>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                    >
                      <SelectTrigger data-testid="select-template">
                        <SelectValue placeholder="Templates" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id} data-testid={`template-${template.id}`}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              </div>

              {/* Display Title */}
              <FormField
                control={form.control}
                name="displayTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Title:</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} data-testid="input-display-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* My Signature (Signature Workflow) */}
              <FormField
                control={form.control}
                name="signatureWorkflow"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>My Signature:</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || 'counter_sign_after_client'}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-signature-workflow">
                          <SelectValue placeholder="Select signature workflow" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="not_required" data-testid="workflow-not-required">Not required</SelectItem>
                        <SelectItem value="sign_upon_creation" data-testid="workflow-sign-upon-creation">Sign upon creation</SelectItem>
                        <SelectItem value="counter_sign_after_client" data-testid="workflow-counter-sign">Counter-sign after client(s)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contract Editor */}
              <div>
                <ContractEditor
                  content={bodyHtml}
                  onChange={setBodyHtml}
                  formFields={formFields}
                  onFormFieldsChange={setFormFields}
                />
              </div>

              {/* Due Date */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date:</FormLabel>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen} modal={true}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            'w-64 pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          data-testid="button-due-date"
                          onClick={() => setDatePickerOpen(true)}
                        >
                          {field.value ? (
                            format(new Date(field.value), 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => {
                            field.onChange(date?.toISOString());
                            setDatePickerOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Save as Template Checkbox */}
              <div className="flex justify-end items-center gap-2 pt-4">
                <Checkbox 
                  id="save-as-template" 
                  checked={saveAsTemplate}
                  onCheckedChange={(checked) => {
                    setSaveAsTemplate(checked === true);
                    if (!checked) setTemplateName('');
                  }}
                  data-testid="checkbox-save-as-template"
                />
                <label 
                  htmlFor="save-as-template" 
                  className="text-sm font-medium cursor-pointer"
                >
                  Save as template
                </label>
              </div>

              {/* Template Name Input - shown when save as template is checked */}
              {saveAsTemplate && (
                <div className="flex justify-end">
                  <div className="w-64">
                    <Input
                      placeholder="Template name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      data-testid="input-template-name"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-green-600 hover:bg-green-700"
                  disabled={createContractMutation.isPending}
                  data-testid="button-save"
                >
                  {createContractMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
