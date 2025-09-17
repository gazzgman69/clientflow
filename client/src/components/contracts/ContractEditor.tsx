import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CalendarIcon, FileText, Save, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import ContactPicker from "../quote/ContactPicker";
import { RichTextEditor, RichTextEditorRef } from "../ui/rich-text-editor";
import { TokenDropdown } from "../ui/token-dropdown";
import type { Contract, Contact, Template } from "@shared/schema";
import { insertContractSchema } from "@shared/schema";
import { z } from "zod";

// Form schema for contract editor
const contractEditorSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  terms: z.string().min(1, "Contract content is required"),
  amount: z.number().min(0).optional(),
  dueDate: z.date().optional(),
  status: z.enum(["draft", "sent", "signed", "completed", "cancelled"]).default("draft"),
});

type ContractEditorForm = z.infer<typeof contractEditorSchema>;

interface ContractEditorProps {
  isOpen: boolean;
  onClose: () => void;
  contactId?: string;
  contactName?: string;
  editingContract?: Contract | null;
  projectId?: string;
}

interface TokenGroup {
  contact: Record<string, string>;
  project: Record<string, string>;
  extra: Record<string, string>;
  business: Record<string, string>;
}

export default function ContractEditor({ 
  isOpen, 
  onClose, 
  contactId: initialContactId, 
  contactName: initialContactName,
  editingContract,
  projectId
}: ContractEditorProps) {
  const [selectedContactId, setSelectedContactId] = useState(initialContactId || "");
  const [selectedContactName, setSelectedContactName] = useState(initialContactName || "");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [livePreview, setLivePreview] = useState("");
  const editorRef = useRef<RichTextEditorRef>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ContractEditorForm>({
    resolver: zodResolver(contractEditorSchema),
    defaultValues: {
      contactId: initialContactId || "",
      title: "",
      description: "",
      terms: "",
      amount: 0,
      status: "draft",
    },
  });

  // Reset form when editing contract changes
  useEffect(() => {
    if (editingContract) {
      setSelectedContactId(editingContract.contactId);
      form.reset({
        contactId: editingContract.contactId,
        title: editingContract.title,
        description: editingContract.description || "",
        terms: editingContract.terms || "",
        amount: editingContract.amount || 0,
        dueDate: editingContract.dueDate ? new Date(editingContract.dueDate) : undefined,
        status: editingContract.status,
      });
      // Set editor content
      if (editorRef.current && editingContract.terms) {
        editorRef.current.setContent(editingContract.terms);
      }
    } else {
      form.reset({
        contactId: initialContactId || "",
        title: "",
        description: "",
        terms: "",
        amount: 0,
        status: "draft",
      });
      setSelectedContactId(initialContactId || "");
      setSelectedContactName(initialContactName || "");
      if (editorRef.current) {
        editorRef.current.setContent("");
      }
    }
  }, [editingContract, form, initialContactId, initialContactName]);

  // Fetch contract templates
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['/api/admin/templates'],
    queryFn: async () => {
      const response = await fetch('/api/admin/templates', {
        headers: { 'user-id': 'test-user' }
      });
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data.filter((t: Template) => t.type === 'contract') : [];
    },
  });

  // Fetch available tokens
  const { data: availableTokens } = useQuery<{ tokens: TokenGroup }>({
    queryKey: ['/api/tokens/list'],
    queryFn: async () => {
      const response = await fetch('/api/tokens/list', {
        headers: { 'user-id': 'test-user' }
      });
      return response.json();
    },
  });

  // Fetch contacts for picker
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      const response = await fetch('/api/contacts', {
        headers: { 'user-id': 'test-user' }
      });
      return response.json();
    },
  });

  // Create contract mutation
  const createContractMutation = useMutation({
    mutationFn: async (data: ContractEditorForm) => {
      const contractData = {
        ...data,
        projectId: projectId || null,
        contractNumber: `CON-${Date.now()}`,
        dueDate: data.dueDate?.toISOString(),
      };
      
      return await apiRequest('/api/contracts', {
        method: 'POST',
        body: contractData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contract created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'contracts'] });
      }
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create contract",
        variant: "destructive",
      });
    },
  });

  // Update contract mutation
  const updateContractMutation = useMutation({
    mutationFn: async (data: ContractEditorForm) => {
      if (!editingContract) throw new Error("No contract to update");
      
      const contractData = {
        ...data,
        projectId: editingContract.projectId,
        dueDate: data.dueDate?.toISOString(),
      };
      
      return await apiRequest(`/api/contracts/${editingContract.id}`, {
        method: 'PATCH',
        body: contractData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contract updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'contracts'] });
      }
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update contract",
        variant: "destructive",
      });
    },
  });

  // Save as template mutation
  const saveAsTemplateMutation = useMutation({
    mutationFn: async (data: { title: string; body: string }) => {
      return await apiRequest('/api/admin/templates', {
        method: 'POST',
        body: {
          type: 'contract',
          title: data.title,
          body: data.body,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/templates'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    },
  });

  const handleContactSelect = (contactId: string, contactName: string) => {
    setSelectedContactId(contactId);
    setSelectedContactName(contactName);
    form.setValue('contactId', contactId);
  };

  const handleTemplateSelect = (template: Template) => {
    if (editorRef.current) {
      editorRef.current.setContent(template.body || "");
      form.setValue('terms', template.body || "");
      form.setValue('title', template.title);
    }
  };

  const handleEditorChange = (content: string) => {
    form.setValue('terms', content);
    // TODO: Add live preview with token rendering
  };

  const handleTokenInsert = (token: string) => {
    if (editorRef.current) {
      // Token already comes in format [TokenName] from TokenDropdown
      // Just insert it as-is since the server expects [TokenName] format
      editorRef.current.insertText(token);
    }
  };

  const onSubmit = async (data: ContractEditorForm) => {
    if (editingContract) {
      updateContractMutation.mutate(data);
    } else {
      createContractMutation.mutate(data);
    }

    // Save as template if requested
    if (saveAsTemplate && data.title && data.terms) {
      await saveAsTemplateMutation.mutateAsync({
        title: `${data.title} Template`,
        body: data.terms,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col dialog-content">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {editingContract ? 'Edit Contract' : 'Create Contract'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-6 overflow-visible">
          {/* Left Panel - Contract Settings */}
          <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto p-2">
            {/* Contact Selection */}
            <div className="space-y-2">
              <Label>Contact</Label>
              <ContactPicker
                contacts={contacts}
                selectedContactId={selectedContactId}
                selectedContactName={selectedContactName}
                onContactSelect={handleContactSelect}
                data-testid="contact-picker-contract"
              />
            </div>

            {/* Basic Fields */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Contract title" data-testid="input-contract-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Brief description" data-testid="input-contract-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Value (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          placeholder="0.00" 
                          data-testid="input-contract-amount" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-contract-due-date"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Select due date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Save as Template Option */}
                {!editingContract && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="save-as-template"
                      checked={saveAsTemplate}
                      onCheckedChange={setSaveAsTemplate}
                      data-testid="checkbox-save-as-template"
                    />
                    <Label htmlFor="save-as-template" className="text-sm">Save as template</Label>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    data-testid="button-cancel-contract"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createContractMutation.isPending || updateContractMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-contract"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {createContractMutation.isPending || updateContractMutation.isPending 
                      ? "Saving..." 
                      : editingContract ? "Update Contract" : "Save Contract"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {/* Right Panel - Contract Content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-visible p-2">
            <div className="flex-1 min-h-0 flex flex-col border rounded-lg overflow-visible">
              <div className="border-b p-2 flex items-center gap-2">
                <span className="text-sm font-medium">Contract Content</span>
                <div className="flex-1" />
                {/* Templates dropdown */}
                {templates.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-templates-menu">
                        <FileText className="h-4 w-4 mr-2" />
                        Templates
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {templates.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                          data-testid={`menuitem-template-${template.id}`}
                        >
                          {template.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {availableTokens && (
                  <TokenDropdown
                    tokens={availableTokens.tokens}
                    onTokenSelect={handleTokenInsert}
                    data-testid="token-dropdown-contract"
                  />
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-visible p-2">
                <RichTextEditor
                  ref={editorRef}
                  content={form.watch('terms') || ""}
                  onChange={handleEditorChange}
                  className="h-full"
                  data-testid="editor-contract-content"
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}