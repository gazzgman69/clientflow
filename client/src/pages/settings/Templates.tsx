import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Eye, AlertTriangle } from 'lucide-react';
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

interface NewTokenGroup {
  contact: { [token: string]: string };
  project: { [token: string]: string };
  business: { [token: string]: string };
}

interface Contact {
  id: string;
  fullName: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
  contactId: string;
}

interface TokenPreviewResult {
  rendered: string;
  unresolved: string[];
}

export default function TemplatesPage() {
  const [activeType, setActiveType] = useState<'auto_responder' | 'email' | 'invoice' | 'contract'>('auto_responder');
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [livePreviewData, setLivePreviewData] = useState<TokenPreviewResult | null>(null);
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

  // Fetch available tokens (old system)
  const { data: availableTokens } = useQuery<TokenGroup>({
    queryKey: ['/api/templates/tokens'],
    queryFn: async () => {
      const response = await fetch('/api/templates/tokens', {
        headers: { 'user-id': 'test-user' }
      });
      return response.json();
    },
  });

  // Fetch new token system
  const { data: newTokens } = useQuery<{ tokens: NewTokenGroup }>({
    queryKey: ['/api/tokens/list'],
    queryFn: async () => {
      const response = await fetch('/api/tokens/list', {
        headers: { 'user-id': 'test-user' }
      });
      return response.json();
    },
  });

  // Fetch contacts for preview selection
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      const response = await fetch('/api/contacts', {
        headers: { 'user-id': 'test-user' }
      });
      return response.json();
    },
  });

  // Fetch projects for preview selection
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects', {
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

  const insertNewToken = (token: string) => {
    const currentBody = form.getValues('body');
    const cursorPosition = currentBody.length;
    const newBody = currentBody.slice(0, cursorPosition) + `[${token}]` + currentBody.slice(cursorPosition);
    form.setValue('body', newBody);
  };

  // Live preview mutation
  const previewMutation = useMutation({
    mutationFn: async ({ template, contactId, projectId }: { 
      template: string; 
      contactId?: string; 
      projectId?: string; 
    }) => {
      const response = await apiRequest('POST', '/api/tokens/preview', {
        template,
        contactId,
        projectId
      });
      return response.json();
    },
    onSuccess: (data) => {
      setLivePreviewData(data);
    },
  });

  // Generate live preview when template or selections change
  const generateLivePreview = () => {
    if (!previewTemplate) return;
    
    const templateBody = previewTemplate.subject 
      ? `${previewTemplate.subject}\n\n${previewTemplate.body}`
      : previewTemplate.body;

    previewMutation.mutate({
      template: templateBody,
      contactId: selectedContactId || undefined,
      projectId: selectedProjectId || undefined
    });
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
                    
                    {/* New Token System */}
                    {newTokens && (
                      <div className="space-y-3">
                        <div className="text-xs text-muted-foreground border-b pb-2 mb-2">
                          New Token System - Use [Token] or [Token|format]
                        </div>
                        
                        <div>
                          <Label className="text-xs font-medium text-blue-600">Contact</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(newTokens?.tokens?.contact || {}).map(([token, description]) => (
                              <Button
                                key={token}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-6 border-blue-200 hover:border-blue-400"
                                onClick={() => insertNewToken(token.replace('[', '').replace(']', ''))}
                                title={description}
                                data-testid={`button-new-token-${token.replace(/[^a-zA-Z]/g, '-')}`}
                              >
                                {token}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-green-600">Project</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(newTokens?.tokens?.project || {}).map(([token, description]) => (
                              <Button
                                key={token}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-6 border-green-200 hover:border-green-400"
                                onClick={() => insertNewToken(token.replace('[', '').replace(']', ''))}
                                title={description}
                                data-testid={`button-new-token-${token.replace(/[^a-zA-Z]/g, '-')}`}
                              >
                                {token}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-purple-600">Business</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(newTokens?.tokens?.business || {}).map(([token, description]) => (
                              <Button
                                key={token}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-6 border-purple-200 hover:border-purple-400"
                                onClick={() => insertNewToken(token.replace('[', '').replace(']', ''))}
                                title={description}
                                data-testid={`button-new-token-${token.replace(/[^a-zA-Z]/g, '-')}`}
                              >
                                {token}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground mt-4 pt-2 border-t">
                          Legacy Token System - Use {"{{token}}"}
                        </div>
                      </div>
                    )}

                    {/* Legacy Token System */}
                    {availableTokens && (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">Contact</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(availableTokens.contact || []).map((token) => (
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
                            {(availableTokens.project || []).map((token) => (
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
                            {(availableTokens.lead || []).map((token) => (
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
        <Dialog open={showPreview} onOpenChange={(open) => {
          setShowPreview(open);
          if (!open) {
            setSelectedContactId('');
            setSelectedProjectId('');
            setLivePreviewData(null);
          }
        }}>
          <DialogContent className="max-w-4xl" data-testid="template-preview-dialog">
            <DialogHeader>
              <DialogTitle>Template Preview</DialogTitle>
              <DialogDescription>
                Preview "{previewTemplate?.title}" with real data or sample data
              </DialogDescription>
            </DialogHeader>

            {previewTemplate && (
              <div className="space-y-6">
                {/* Preview Controls */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium">Select Contact</Label>
                    <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose contact..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Use sample data</SelectItem>
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.fullName} ({contact.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Select Project</Label>
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose project..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Use sample data</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button 
                      onClick={generateLivePreview}
                      disabled={previewMutation.isPending}
                      data-testid="button-generate-preview"
                    >
                      {previewMutation.isPending ? 'Generating...' : 'Generate Preview'}
                    </Button>
                  </div>
                </div>

                {/* Live Preview Results */}
                {livePreviewData && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-medium">Live Preview Results</h3>
                      {livePreviewData.unresolved.length > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {livePreviewData.unresolved.length} unresolved
                        </Badge>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Rendered Content:</Label>
                      <div className="mt-1 p-4 bg-white dark:bg-gray-900 rounded border whitespace-pre-wrap text-sm">
                        {livePreviewData.rendered}
                      </div>
                    </div>

                    {livePreviewData.unresolved.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium text-red-600">Unresolved Tokens:</Label>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {livePreviewData.unresolved.map((token, index) => (
                            <Badge key={index} variant="destructive">
                              [{token}]
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback - Legacy Preview */}
                {!livePreviewData && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-medium">Legacy Sample Preview</h3>
                      <Badge variant="secondary">Sample Data</Badge>
                    </div>

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
                  </div>
                )}

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