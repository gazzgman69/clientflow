import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { SignaturePad, SignaturePadRef } from "../ui/signature-pad";
import type { Contract, Contact, Template } from "@shared/schema";
import { insertContractSchema } from "@shared/schema";
import { z } from "zod";

// Form schema for contract editor
const contractEditorSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  terms: z.string().min(1, "Contract content is required"),
  dueDate: z.date().optional(),
  status: z.enum(["draft", "sent", "signed", "completed", "cancelled"]).default("draft"),
  signatureWorkflow: z.enum(["not_required", "sign_upon_creation", "counter_sign_after_client"]).default("counter_sign_after_client"),
  businessSignature: z.string().optional(),
  clientSignature: z.string().optional(),
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

  // Get current authenticated user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });
  const [livePreview, setLivePreview] = useState("");
  const editorRef = useRef<RichTextEditorRef>(null);
  const businessSignatureRef = useRef<SignaturePadRef>(null);
  const clientSignatureRef = useRef<SignaturePadRef>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ContractEditorForm>({
    resolver: zodResolver(contractEditorSchema),
    defaultValues: {
      contactId: initialContactId || "",
      title: "",
      description: "",
      terms: "",
      status: "draft",
      signatureWorkflow: "counter_sign_after_client",
      businessSignature: "",
      clientSignature: "",
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
        dueDate: editingContract.expiresAt ? new Date(editingContract.expiresAt) : undefined,
        status: editingContract.status as "draft" | "sent" | "signed" | "completed" | "cancelled",
        signatureWorkflow: (editingContract as any).signatureWorkflow || "counter_sign_after_client",
        businessSignature: editingContract.businessSignature || "",
        clientSignature: editingContract.clientSignature || "",
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
        status: "draft",
        signatureWorkflow: "counter_sign_after_client",
        businessSignature: "",
        clientSignature: "",
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
        credentials: 'include'
      });
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data.filter((t: Template) => t.type === 'contract') : [];
    },
    enabled: !!currentUser,
  });

  // Fetch available tokens
  const { data: availableTokens } = useQuery<{ tokens: TokenGroup }>({
    queryKey: ['/api/tokens/list'],
    queryFn: async () => {
      const response = await fetch('/api/tokens/list', {
        credentials: 'include'
      });
      return response.json();
    },
    enabled: !!currentUser,
  });

  // Fetch contacts for picker
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      const response = await fetch('/api/contacts', {
        credentials: 'include'
      });
      return response.json();
    },
    enabled: !!currentUser,
  });

  // Create contract mutation
  const createContractMutation = useMutation({
    mutationFn: async (data: ContractEditorForm) => {
      const contractData = {
        ...data,
        projectId: projectId || null,
        contractNumber: `CON-${Date.now()}`,
        dueDate: data.dueDate?.toISOString(),
        signatureWorkflow: data.signatureWorkflow,
        businessSignature: data.businessSignature,
        clientSignature: data.clientSignature,
      };
      
      return await apiRequest('/api/contracts', 'POST', contractData);
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
        signatureWorkflow: data.signatureWorkflow,
        businessSignature: data.businessSignature,
        clientSignature: data.clientSignature,
      };
      
      return await apiRequest(`/api/contracts/${editingContract.id}`, 'PATCH', contractData);
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
      return await apiRequest('/api/admin/templates', 'POST', {
        type: 'contract',
        title: data.title,
        body: data.body,
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
          <DialogDescription>
            {editingContract 
              ? "Modify the contract details and content below. You can use tokens to insert dynamic information."
              : "Create a new contract by filling in the details and content below. You can use tokens to insert dynamic information."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
          {/* Left Panel - Contract Settings */}
          <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto p-2 max-h-full">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Contact Selection */}
                <FormField
                  control={form.control}
                  name="contactId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-contact">
                            <SelectValue placeholder="Select a contact" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.firstName} {contact.lastName} ({contact.email})
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

                {/* Signatures Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-medium">Digital Signatures</h3>
                  
                  {/* Signature Workflow */}
                  <FormField
                    control={form.control}
                    name="signatureWorkflow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Signature Workflow</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-signature-workflow">
                              <SelectValue placeholder="Select signature workflow" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="not_required">Not required</SelectItem>
                            <SelectItem value="sign_upon_creation">Sign upon creation</SelectItem>
                            <SelectItem value="counter_sign_after_client">Counter-sign after client(s)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Business Signature */}
                  <FormField
                    control={form.control}
                    name="businessSignature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Signature (Business Owner)</FormLabel>
                        <FormControl>
                          <SignaturePad
                            ref={businessSignatureRef}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Your name"
                            data-testid="signature-business"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Client Signature */}
                  <FormField
                    control={form.control}
                    name="clientSignature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Signature</FormLabel>
                        <FormControl>
                          <SignaturePad
                            ref={clientSignatureRef}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Client name"
                            data-testid="signature-client"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Save as Template Option */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="save-as-template"
                    checked={saveAsTemplate}
                    onCheckedChange={(checked) => setSaveAsTemplate(checked === true)}
                    data-testid="checkbox-save-as-template"
                  />
                  <Label htmlFor="save-as-template" className="text-sm">Save as template</Label>
                </div>

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
                    onTokenSelect={handleTokenInsert}
                    onAfterInsert={() => {
                      if (editorRef.current) {
                        editorRef.current.focus();
                      }
                    }}
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