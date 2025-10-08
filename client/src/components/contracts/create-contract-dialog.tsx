import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ContractEditor from '@/components/contract-editor';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { insertContractSchema } from '@shared/schema';
import type { Contact, Project, ContractTemplate } from '@shared/schema';

interface FormField {
  id: string;
  type: 'checkbox' | 'text_input' | 'initials' | 'signature';
  label: string;
  required: boolean;
}

const createContractFormSchema = insertContractSchema.omit({ 
  createdBy: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  contactId: z.string().min(1, 'Contact is required'),
  title: z.string().min(1, 'Title is required'),
});

interface CreateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContactId?: string;
  initialProjectId?: string;
}

export default function CreateContractDialog({ 
  open, 
  onOpenChange,
  initialContactId,
  initialProjectId 
}: CreateContractDialogProps) {
  const [bodyHtml, setBodyHtml] = useState('');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contactsData } = useQuery<{ contacts: Contact[] }>({
    queryKey: ['/api/contacts'],
  });
  const contacts = contactsData?.contacts;

  const { data: projectsData } = useQuery<{ projects: Project[] }>({
    queryKey: ['/api/projects'],
  });
  const projects = projectsData?.projects;

  const { data: templates } = useQuery<ContractTemplate[]>({
    queryKey: ['/api/contract-templates'],
  });

  const form = useForm<z.infer<typeof createContractFormSchema>>({
    resolver: zodResolver(createContractFormSchema),
    defaultValues: {
      title: '',
      displayTitle: '',
      description: '',
      contactId: initialContactId || '',
      projectId: initialProjectId || '',
      bodyHtml: '',
      terms: '',
      signatureWorkflow: 'counter_sign_after_client',
      status: 'draft',
    },
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createContractFormSchema>) => {
      const contractData = {
        ...data,
        bodyHtml,
        formFields: JSON.stringify(formFields),
      };
      const response = await apiRequest('POST', '/api/contracts', contractData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      toast({
        title: 'Success',
        description: 'Contract created successfully!',
      });
      form.reset();
      setBodyHtml('');
      setFormFields([]);
      setSelectedTemplateId('');
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create contract. Please try again.',
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
          <DialogTitle>Create New Contract</DialogTitle>
          <DialogDescription>
            Create a contract with dynamic fields and embedded forms
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Contract Details</TabsTrigger>
            <TabsTrigger value="content">Content & Editor</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <TabsContent value="details" className="space-y-4 mt-4">
                  {templates && templates.length > 0 && (
                    <div>
                      <label className="text-sm font-medium">Load from Template</label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger data-testid="select-template">
                          <SelectValue placeholder="Select a template (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Title *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Photography Contract 2024" data-testid="input-contract-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="displayTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Title (shown to client)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="e.g., Service Agreement" data-testid="input-display-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-contact">
                              <SelectValue placeholder="Select contact..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {contacts?.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.firstName} {contact.lastName}
                                {contact.company && ` (${contact.company})`}
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
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project (optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-project">
                              <SelectValue placeholder="Link to project..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projects?.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
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
                    name="signatureWorkflow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Signature Workflow</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || 'counter_sign_after_client'}>
                          <FormControl>
                            <SelectTrigger data-testid="select-signature-workflow">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="not_required">No signature required</SelectItem>
                            <SelectItem value="sign_upon_creation">I sign when creating</SelectItem>
                            <SelectItem value="counter_sign_after_client">Client signs first, then I counter-sign</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="content" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Contract Body</label>
                      <ContractEditor
                        content={bodyHtml}
                        onChange={setBodyHtml}
                        formFields={formFields}
                        onFormFieldsChange={setFormFields}
                      />
                    </div>
                  </div>
                </TabsContent>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t">
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
                    disabled={createContractMutation.isPending}
                    data-testid="button-create-contract"
                  >
                    {createContractMutation.isPending ? 'Creating...' : 'Create Contract'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
