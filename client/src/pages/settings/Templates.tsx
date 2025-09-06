import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import Header from '@/components/layout/header';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { z } from 'zod';

interface Template {
  id: string;
  type: 'auto_responder' | 'email' | 'invoice' | 'contract';
  title: string;
  subject?: string | null;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const templateFormSchema = z.object({
  type: z.enum(['auto_responder', 'email', 'invoice', 'contract']),
  title: z.string().min(1, 'Title is required'),
  subject: z.string().optional(),
  body: z.string().min(1, 'Body is required'),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

interface TokenGroup {
  contact: string[];
  project: string[];
  lead: string[];
}

export default function TemplatesPage() {
  const [activeType, setActiveType] = useState<'auto_responder' | 'email' | 'invoice' | 'contract'>('auto_responder');
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      type: 'auto_responder',
      title: '',
      subject: '',
      body: '',
    },
  });

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['/api/admin/templates'],
    queryFn: async () => {
      const response = await fetch('/api/admin/templates', {
        headers: { 'user-id': 'test-user' }
      });
      return response.json();
    },
  });

  // Fetch available tokens
  const { data: availableTokens } = useQuery<TokenGroup>({
    queryKey: ['/api/templates/tokens'],
    queryFn: async () => {
      const response = await fetch('/api/templates/tokens', {
        headers: { 'user-id': 'test-user' }
      });
      return response.json();
    },
  });

  // Filter templates by active type
  const filteredTemplates = templates.filter(template => template.type === activeType);

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const response = await apiRequest('POST', '/api/admin/templates', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/templates'] });
      toast({ title: 'Template created successfully' });
      setShowEditor(false);
      form.reset();
    },
    onError: () => {
      toast({ title: 'Failed to create template', variant: 'destructive' });
    },
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TemplateFormData>) => {
      const response = await apiRequest('PATCH', `/api/admin/templates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/templates'] });
      toast({ title: 'Template updated successfully' });
      setShowEditor(false);
      setEditingTemplate(null);
      form.reset();
    },
    onError: () => {
      toast({ title: 'Failed to update template', variant: 'destructive' });
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/admin/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/templates'] });
      toast({ title: 'Template deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete template', variant: 'destructive' });
    },
  });

  // Toggle template active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest('PATCH', `/api/admin/templates/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/templates'] });
      toast({ title: 'Template status updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update template status', variant: 'destructive' });
    },
  });

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    form.reset({
      type: activeType,
      title: '',
      subject: '',
      body: '',
    });
    setShowEditor(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    form.reset({
      type: template.type,
      title: template.title,
      subject: template.subject || '',
      body: template.body,
    });
    setShowEditor(true);
  };

  const handlePreviewTemplate = (template: Template) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const onSubmit = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const insertToken = (token: string) => {
    const currentBody = form.getValues('body');
    const cursorPosition = currentBody.length;
    const newBody = currentBody.slice(0, cursorPosition) + `{{${token}}}` + currentBody.slice(cursorPosition);
    form.setValue('body', newBody);
  };

  const getTypeDisplayName = (type: string) => {
    const names = {
      auto_responder: 'Auto Responders',
      email: 'Emails',
      invoice: 'Invoices',
      contract: 'Contracts'
    };
    return names[type as keyof typeof names];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  return (
    <>
      <Header 
        title="Templates" 
        subtitle="Manage email templates, auto-responders, invoices, and contracts"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <Card data-testid="templates-page-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Template Management</CardTitle>
              <Button onClick={handleNewTemplate} data-testid="button-new-template">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeType} onValueChange={(value) => setActiveType(value as any)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="auto_responder" data-testid="tab-auto-responders">Auto Responders</TabsTrigger>
                <TabsTrigger value="email" data-testid="tab-emails">Emails</TabsTrigger>
                <TabsTrigger value="invoice" data-testid="tab-invoices">Invoices</TabsTrigger>
                <TabsTrigger value="contract" data-testid="tab-contracts">Contracts</TabsTrigger>
              </TabsList>

              {(['auto_responder', 'email', 'invoice', 'contract'] as const).map((type) => (
                <TabsContent key={type} value={type} className="space-y-4">
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                      ))}
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-12" data-testid={`empty-${type}-templates`}>
                      <p className="text-muted-foreground mb-4">No {getTypeDisplayName(type).toLowerCase()} found</p>
                      <Button onClick={handleNewTemplate} data-testid={`button-create-first-${type}`}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First {type === 'auto_responder' ? 'Auto Responder' : getTypeDisplayName(type).slice(0, -1)}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredTemplates.map((template) => (
                        <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`template-${template.id}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium">{template.title}</h3>
                              <Badge variant={template.isActive ? "default" : "secondary"} data-testid={`badge-status-${template.id}`}>
                                {template.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Updated {formatDate(template.updatedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={template.isActive}
                              onCheckedChange={(checked) => 
                                toggleActiveMutation.mutate({ id: template.id, isActive: checked })
                              }
                              disabled={toggleActiveMutation.isPending}
                              data-testid={`switch-active-${template.id}`}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreviewTemplate(template)}
                              data-testid={`button-preview-${template.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                              data-testid={`button-edit-${template.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteMutation.mutate(template.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${template.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Template Editor Dialog */}
        <Dialog open={showEditor} onOpenChange={setShowEditor}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="template-editor-dialog">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
              <DialogDescription>
                {editingTemplate ? 'Update your template' : 'Create a new template with dynamic tokens'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!editingTemplate}>
                          <FormControl>
                            <SelectTrigger data-testid="select-template-type">
                              <SelectValue placeholder="Select template type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="auto_responder">Auto Responder</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="invoice">Invoice</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Template title" data-testid="input-template-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {(['auto_responder', 'email'].includes(form.watch('type'))) && (
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject {form.watch('type') === 'auto_responder' ? '(Optional)' : ''}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Email subject line" data-testid="input-template-subject" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="body"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Body</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Enter your template content here. Use {{token}} for dynamic values."
                              className="min-h-[300px]"
                              data-testid="textarea-template-body"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label>Available Tokens</Label>
                    {availableTokens && (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">Contact</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {availableTokens.contact.map((token) => (
                              <Button
                                key={token}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-6"
                                onClick={() => insertToken(token)}
                                data-testid={`button-token-${token.replace('.', '-')}`}
                              >
                                {token}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">Project</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {availableTokens.project.map((token) => (
                              <Button
                                key={token}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-6"
                                onClick={() => insertToken(token)}
                                data-testid={`button-token-${token.replace('.', '-')}`}
                              >
                                {token}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">Lead</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {availableTokens.lead.map((token) => (
                              <Button
                                key={token}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-6"
                                onClick={() => insertToken(token)}
                                data-testid={`button-token-${token.replace('.', '-')}`}
                              >
                                {token}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditor(false)}
                    data-testid="button-cancel-template"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-template"
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Template'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Template Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl" data-testid="template-preview-dialog">
            <DialogHeader>
              <DialogTitle>Template Preview</DialogTitle>
              <DialogDescription>
                Preview of "{previewTemplate?.title}" template with sample data
              </DialogDescription>
            </DialogHeader>

            {previewTemplate && (
              <div className="space-y-4">
                {previewTemplate.subject && (
                  <div>
                    <Label className="text-sm font-medium">Subject:</Label>
                    <div className="mt-1 p-3 bg-muted rounded border">
                      {previewTemplate.subject.replace(/\{\{(\w+\.\w+)\}\}/g, (match, token) => {
                        const sampleData: Record<string, string> = {
                          'contact.firstName': 'John',
                          'contact.lastName': 'Doe',
                          'contact.email': 'john@example.com',
                          'project.title': 'Website Redesign',
                          'project.date': '15/09/2025',
                          'project.id': 'PRJ-001',
                          'lead.service': 'Web Development',
                          'lead.message': 'Looking for a modern website redesign'
                        };
                        return sampleData[token] || match;
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Body:</Label>
                  <div className="mt-1 p-3 bg-muted rounded border whitespace-pre-wrap">
                    {previewTemplate.body.replace(/\{\{(\w+\.\w+)\}\}/g, (match, token) => {
                      const sampleData: Record<string, string> = {
                        'contact.firstName': 'John',
                        'contact.lastName': 'Doe',
                        'contact.email': 'john@example.com',
                        'project.title': 'Website Redesign',
                        'project.date': '15/09/2025',
                        'project.id': 'PRJ-001',
                        'lead.service': 'Web Development',
                        'lead.message': 'Looking for a modern website redesign'
                      };
                      return sampleData[token] || match;
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => setShowPreview(false)}
                    data-testid="button-close-preview"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}