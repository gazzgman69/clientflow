import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Brain, BookOpen, Settings2, FileText, Plus, Edit, Trash2, Check, X, Image as ImageIcon, Upload, Video, Music, MoreVertical, Grid3x3, List, Search, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AISettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("questionnaire");

  // Fetch AI business context
  const { data: businessContext, isLoading: isLoadingContext } = useQuery({
    queryKey: ['/api/ai/business-context'],
  });

  // Fetch knowledge base
  const { data: knowledgeBase = [], isLoading: isLoadingKB } = useQuery({
    queryKey: ['/api/ai/knowledge-base'],
  });

  // Fetch custom instructions
  const { data: customInstructions = [], isLoading: isLoadingInstructions } = useQuery({
    queryKey: ['/api/ai/custom-instructions'],
  });

  // Fetch media library
  const { data: mediaItems = [], isLoading: isLoadingMedia } = useQuery({
    queryKey: ['/api/ai-features/media'],
  });

  // Save business context mutation
  const saveContextMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/ai/business-context', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/business-context'] });
      toast({
        title: "Success",
        description: "Business information saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save business information",
        variant: "destructive",
      });
    },
  });

  // Questionnaire component
  const BusinessQuestionnaire = () => {
    const [formData, setFormData] = useState({
      businessName: businessContext?.businessName || "",
      businessType: businessContext?.businessType || "",
      industry: businessContext?.industry || "",
      targetAudience: businessContext?.targetAudience || "",
      services: businessContext?.services || "",
      pricingInfo: businessContext?.pricingInfo || "",
      businessHours: businessContext?.businessHours || "",
      brandVoice: businessContext?.brandVoice || "",
      terminology: businessContext?.terminology || "",
      standardResponses: businessContext?.standardResponses || "",
      policies: businessContext?.policies || "",
    });

    const handleSave = () => {
      saveContextMutation.mutate(formData);
    };

    return (
      <div className="space-y-6">
        <Card data-testid="card-questionnaire">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="title-questionnaire">
              <Brain className="h-5 w-5" />
              Train Your AI Assistant
            </CardTitle>
            <CardDescription data-testid="description-questionnaire">
              Help the AI understand your business to provide more personalized assistance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName" data-testid="label-business-name">Business Name</Label>
                <Input
                  id="businessName"
                  data-testid="input-business-name"
                  placeholder="e.g., Acme DJ Services"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="businessType" data-testid="label-business-type">What type of business do you run?</Label>
                <Input
                  id="businessType"
                  data-testid="input-business-type"
                  placeholder="e.g., Wedding DJ, Mobile DJ, Event Entertainment"
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="industry" data-testid="label-industry">Industry/Niche</Label>
                <Input
                  id="industry"
                  data-testid="input-industry"
                  placeholder="e.g., Entertainment, Events, Music"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="targetAudience" data-testid="label-target-audience">Who are your ideal clients?</Label>
                <Textarea
                  id="targetAudience"
                  data-testid="textarea-target-audience"
                  placeholder="e.g., Couples planning weddings, corporate event planners, birthday party organizers"
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="services" data-testid="label-services">What services do you offer?</Label>
                <Textarea
                  id="services"
                  data-testid="textarea-services"
                  placeholder="e.g., Wedding DJ, Corporate events, Birthday parties, Equipment rental"
                  value={formData.services}
                  onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="pricingInfo" data-testid="label-pricing-info">Pricing Information</Label>
                <Textarea
                  id="pricingInfo"
                  data-testid="textarea-pricing-info"
                  placeholder="e.g., Wedding packages start at $800, Hourly rate $150, Custom quotes available"
                  value={formData.pricingInfo}
                  onChange={(e) => setFormData({ ...formData, pricingInfo: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="businessHours" data-testid="label-business-hours">Business Hours</Label>
                <Textarea
                  id="businessHours"
                  data-testid="textarea-business-hours"
                  placeholder="e.g., Mon-Fri 9am-6pm, Available weekends for events"
                  value={formData.businessHours}
                  onChange={(e) => setFormData({ ...formData, businessHours: e.target.value })}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="brandVoice" data-testid="label-brand-voice">Brand Voice & Communication Tone</Label>
                <Input
                  id="brandVoice"
                  data-testid="input-brand-voice"
                  placeholder="e.g., Professional yet friendly, Casual, Formal"
                  value={formData.brandVoice}
                  onChange={(e) => setFormData({ ...formData, brandVoice: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="terminology" data-testid="label-terminology">Industry-specific terms or jargon</Label>
                <Textarea
                  id="terminology"
                  data-testid="textarea-terminology"
                  placeholder="e.g., Setup/teardown, sound check, playlist curation, MC duties"
                  value={formData.terminology}
                  onChange={(e) => setFormData({ ...formData, terminology: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="standardResponses" data-testid="label-standard-responses">Standard responses or FAQs</Label>
                <Textarea
                  id="standardResponses"
                  data-testid="textarea-standard-responses"
                  placeholder="e.g., Common answers to frequently asked questions"
                  value={formData.standardResponses}
                  onChange={(e) => setFormData({ ...formData, standardResponses: e.target.value })}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="policies" data-testid="label-policies">Business Policies</Label>
                <Textarea
                  id="policies"
                  data-testid="textarea-policies"
                  placeholder="e.g., 50% deposit required, Cancellation policy, Equipment setup requirements"
                  value={formData.policies}
                  onChange={(e) => setFormData({ ...formData, policies: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saveContextMutation.isPending}
              className="w-full"
              data-testid="button-save-questionnaire"
            >
              {saveContextMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Business Information"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Knowledge Base component
  const KnowledgeBaseManager = () => {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [formData, setFormData] = useState({
      title: "",
      category: "",
      content: "",
      isActive: true,
    });

    const createKBMutation = useMutation({
      mutationFn: async (data: any) => {
        return await apiRequest('POST', '/api/ai/knowledge-base', data);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/ai/knowledge-base'] });
        setIsAddDialogOpen(false);
        setFormData({ title: "", category: "", content: "", isActive: true });
        toast({
          title: "Success",
          description: "Knowledge base article created",
        });
      },
    });

    const updateKBMutation = useMutation({
      mutationFn: async ({ id, data }: { id: string; data: any }) => {
        return await apiRequest('PATCH', `/api/ai/knowledge-base/${id}`, data);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/ai/knowledge-base'] });
        setEditingItem(null);
        toast({
          title: "Success",
          description: "Knowledge base article updated",
        });
      },
    });

    const deleteKBMutation = useMutation({
      mutationFn: async (id: string) => {
        return await apiRequest('DELETE', `/api/ai/knowledge-base/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/ai/knowledge-base'] });
        toast({
          title: "Success",
          description: "Knowledge base article deleted",
        });
      },
    });

    const handleAdd = () => {
      createKBMutation.mutate(formData);
    };

    const handleEdit = (item: any) => {
      setEditingItem(item);
      setFormData({
        title: item.title,
        category: item.category || "",
        content: item.content,
        isActive: item.isActive,
      });
    };

    const handleUpdate = () => {
      updateKBMutation.mutate({ id: editingItem.id, data: formData });
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium" data-testid="title-knowledge-base">Knowledge Base</h3>
            <p className="text-sm text-muted-foreground" data-testid="description-knowledge-base">
              Add articles and documentation for the AI to reference
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-knowledge">
            <Plus className="mr-2 h-4 w-4" />
            Add Article
          </Button>
        </div>

        <div className="space-y-2">
          {knowledgeBase.map((item: any) => (
            <Card key={item.id} data-testid={`card-kb-${item.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium" data-testid={`title-kb-${item.id}`}>{item.title}</h4>
                      {item.category && (
                        <span className="text-xs bg-secondary px-2 py-1 rounded" data-testid={`category-kb-${item.id}`}>
                          {item.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1" data-testid={`content-kb-${item.id}`}>
                      {item.content.substring(0, 150)}...
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-muted-foreground" data-testid={`status-kb-${item.id}`}>
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                      data-testid={`button-edit-kb-${item.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteKBMutation.mutate(item.id)}
                      data-testid={`button-delete-kb-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isAddDialogOpen || !!editingItem} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingItem(null);
            setFormData({ title: "", category: "", content: "", isActive: true });
          }
        }}>
          <DialogContent data-testid="dialog-kb-form">
            <DialogHeader>
              <DialogTitle data-testid="dialog-title-kb">
                {editingItem ? "Edit Article" : "Add New Article"}
              </DialogTitle>
              <DialogDescription data-testid="dialog-description-kb">
                Add information that the AI can reference when helping you
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="kb-title" data-testid="label-kb-title">Title</Label>
                <Input
                  id="kb-title"
                  data-testid="input-kb-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Pricing Guidelines"
                />
              </div>
              <div>
                <Label htmlFor="kb-category" data-testid="label-kb-category">Category (Optional)</Label>
                <Input
                  id="kb-category"
                  data-testid="input-kb-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Pricing, Services, Policies"
                />
              </div>
              <div>
                <Label htmlFor="kb-content" data-testid="label-kb-content">Content</Label>
                <Textarea
                  id="kb-content"
                  data-testid="textarea-kb-content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                  placeholder="Enter the information you want the AI to know..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setEditingItem(null);
                  setFormData({ title: "", category: "", content: "", isActive: true });
                }}
                data-testid="button-cancel-kb"
              >
                Cancel
              </Button>
              <Button
                onClick={editingItem ? handleUpdate : handleAdd}
                disabled={createKBMutation.isPending || updateKBMutation.isPending}
                data-testid="button-save-kb"
              >
                {(createKBMutation.isPending || updateKBMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingItem ? "Update" : "Create"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // Custom Instructions component
  const CustomInstructionsManager = () => {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [formData, setFormData] = useState({
      instruction: "",
      category: "",
      isActive: true,
    });

    const createInstructionMutation = useMutation({
      mutationFn: async (data: any) => {
        return await apiRequest('POST', '/api/ai/custom-instructions', data);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/ai/custom-instructions'] });
        setIsAddDialogOpen(false);
        setFormData({ instruction: "", category: "", isActive: true });
        toast({
          title: "Success",
          description: "Custom instruction created",
        });
      },
    });

    const updateInstructionMutation = useMutation({
      mutationFn: async ({ id, data }: { id: string; data: any }) => {
        return await apiRequest('PATCH', `/api/ai/custom-instructions/${id}`, data);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/ai/custom-instructions'] });
        setEditingItem(null);
        toast({
          title: "Success",
          description: "Custom instruction updated",
        });
      },
    });

    const deleteInstructionMutation = useMutation({
      mutationFn: async (id: string) => {
        return await apiRequest('DELETE', `/api/ai/custom-instructions/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/ai/custom-instructions'] });
        toast({
          title: "Success",
          description: "Custom instruction deleted",
        });
      },
    });

    const handleAdd = () => {
      createInstructionMutation.mutate(formData);
    };

    const handleEdit = (item: any) => {
      setEditingItem(item);
      setFormData({
        instruction: item.instruction,
        category: item.category || "",
        isActive: item.isActive,
      });
    };

    const handleUpdate = () => {
      updateInstructionMutation.mutate({ id: editingItem.id, data: formData });
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium" data-testid="title-instructions">Custom Instructions</h3>
            <p className="text-sm text-muted-foreground" data-testid="description-instructions">
              Define specific rules and behaviors for the AI
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-instruction">
            <Plus className="mr-2 h-4 w-4" />
            Add Instruction
          </Button>
        </div>

        <div className="space-y-2">
          {customInstructions.map((item: any) => (
            <Card key={item.id} data-testid={`card-instruction-${item.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {item.category && (
                        <span className="text-xs bg-secondary px-2 py-1 rounded" data-testid={`category-instruction-${item.id}`}>
                          {item.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1" data-testid={`instruction-text-${item.id}`}>{item.instruction}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-muted-foreground" data-testid={`status-instruction-${item.id}`}>
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                      data-testid={`button-edit-instruction-${item.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteInstructionMutation.mutate(item.id)}
                      data-testid={`button-delete-instruction-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isAddDialogOpen || !!editingItem} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingItem(null);
            setFormData({ instruction: "", category: "", isActive: true });
          }
        }}>
          <DialogContent data-testid="dialog-instruction-form">
            <DialogHeader>
              <DialogTitle data-testid="dialog-title-instruction">
                {editingItem ? "Edit Instruction" : "Add Custom Instruction"}
              </DialogTitle>
              <DialogDescription data-testid="dialog-description-instruction">
                Define how the AI should behave in specific situations
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="instruction-category" data-testid="label-instruction-category">Category (Optional)</Label>
                <Input
                  id="instruction-category"
                  data-testid="input-instruction-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Communication, Pricing, Scheduling"
                />
              </div>
              <div>
                <Label htmlFor="instruction-text" data-testid="label-instruction-text">Instruction</Label>
                <Textarea
                  id="instruction-text"
                  data-testid="textarea-instruction-text"
                  value={formData.instruction}
                  onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
                  rows={4}
                  placeholder="e.g., Always mention our 24-hour cancellation policy when discussing bookings"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="instruction-active"
                  data-testid="switch-instruction-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="instruction-active" data-testid="label-instruction-active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setEditingItem(null);
                  setFormData({ instruction: "", category: "", isActive: true });
                }}
                data-testid="button-cancel-instruction"
              >
                Cancel
              </Button>
              <Button
                onClick={editingItem ? handleUpdate : handleAdd}
                disabled={createInstructionMutation.isPending || updateInstructionMutation.isPending}
                data-testid="button-save-instruction"
              >
                {(createInstructionMutation.isPending || updateInstructionMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingItem ? "Update" : "Create"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // Media Library Manager component
  const MediaLibraryManager = () => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingItem, setEditingItem] = useState<any>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const uploadMutation = useMutation({
      mutationFn: async (formData: FormData) => {
        // Get CSRF token
        const csrfResponse = await fetch('/api/csrf-token', {
          credentials: 'include',
        });
        const { csrfToken } = await csrfResponse.json();

        const response = await fetch('/api/ai-features/media', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-CSRF-Token': csrfToken,
          },
          body: formData,
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Upload failed');
        }
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/ai-features/media'] });
        toast({
          title: 'Success',
          description: 'Media uploaded successfully',
        });
      },
      onError: (error: Error) => {
        toast({
          title: 'Upload Failed',
          description: error.message,
          variant: 'destructive',
        });
      },
    });

    const updateMutation = useMutation({
      mutationFn: async ({ id, data }: { id: string; data: any }) => {
        return await apiRequest('PATCH', `/api/ai-features/media/${id}`, data);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/ai-features/media'] });
        setIsEditDialogOpen(false);
        setEditingItem(null);
        toast({
          title: 'Success',
          description: 'Media updated successfully',
        });
      },
    });

    const deleteMutation = useMutation({
      mutationFn: async (id: string) => {
        return await apiRequest('DELETE', `/api/ai-features/media/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/ai-features/media'] });
        toast({
          title: 'Success',
          description: 'Media deleted successfully',
        });
      },
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const formData = new FormData();
      formData.append('file', files[0]);
      uploadMutation.mutate(formData);
      e.target.value = '';
    };

    const handleEdit = (item: any) => {
      setEditingItem(item);
      setIsEditDialogOpen(true);
    };

    const handleUpdate = () => {
      if (!editingItem) return;
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          title: editingItem.title,
          description: editingItem.description,
          category: editingItem.category,
          tags: editingItem.tags,
        },
      });
    };

    const uniqueCategories = ['all', ...new Set(mediaItems.map((item: any) => item.category).filter(Boolean))];

    const filteredItems = mediaItems.filter((item: any) => {
      const matchesType = filterType === 'all' || item.mediaType === filterType;
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchesSearch = searchQuery === '' || 
        item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesCategory && matchesSearch;
    });

    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getMediaIcon = (type: string) => {
      switch (type) {
        case 'photo':
          return <ImageIcon className="h-4 w-4" />;
        case 'video':
          return <Video className="h-4 w-4" />;
        case 'audio':
          return <Music className="h-4 w-4" />;
        default:
          return <FileText className="h-4 w-4" />;
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h3 className="text-lg font-medium" data-testid="title-media-library">Media Library</h3>
            <p className="text-sm text-muted-foreground" data-testid="description-media-library">
              Upload and manage photos, videos, and audio files for your AI assistant
            </p>
          </div>
          <div>
            <Button asChild data-testid="button-upload-media">
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Upload Media
              </label>
            </Button>
            <input
              id="file-upload"
              type="file"
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={handleFileUpload}
              data-testid="input-file-upload"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by filename or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
          
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]" data-testid="select-type-filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="photo">Photos</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[150px]" data-testid="select-category-filter">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {uniqueCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              data-testid="button-grid-view"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              data-testid="button-list-view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No media items found</p>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item: any) => (
              <Card key={item.id} className="overflow-hidden group" data-testid={`media-card-${item.id}`}>
                <div className="aspect-square relative bg-muted">
                  {item.mediaType === 'photo' ? (
                    <img
                      src={item.fileUrl}
                      alt={item.title || item.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {getMediaIcon(item.mediaType)}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" data-testid={`button-menu-${item.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleEdit(item)} data-testid={`menu-edit-${item.id}`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this media?')) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          data-testid={`menu-delete-${item.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardContent className="p-3">
                  <p className="font-medium text-sm truncate" data-testid={`media-title-${item.id}`}>
                    {item.title || item.fileName}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="secondary" className="text-xs" data-testid={`media-type-${item.id}`}>
                      {item.mediaType}
                    </Badge>
                    <span className="text-xs text-muted-foreground" data-testid={`media-size-${item.id}`}>
                      {formatFileSize(item.fileSize)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item: any) => (
              <Card key={item.id} data-testid={`media-row-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                        {item.mediaType === 'photo' ? (
                          <img src={item.fileUrl} alt={item.title || item.fileName} className="w-full h-full object-cover rounded" />
                        ) : (
                          getMediaIcon(item.mediaType)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" data-testid={`media-row-title-${item.id}`}>
                          {item.title || item.fileName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs" data-testid={`media-row-type-${item.id}`}>
                            {item.mediaType}
                          </Badge>
                          {item.category && (
                            <Badge variant="outline" className="text-xs" data-testid={`media-row-category-${item.id}`}>
                              {item.category}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground" data-testid={`media-row-size-${item.id}`}>
                            {formatFileSize(item.fileSize)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`button-row-menu-${item.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleEdit(item)} data-testid={`menu-row-edit-${item.id}`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this media?')) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          data-testid={`menu-row-delete-${item.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent data-testid="dialog-edit-media">
            <DialogHeader>
              <DialogTitle data-testid="dialog-title-edit-media">Edit Media</DialogTitle>
              <DialogDescription data-testid="dialog-description-edit-media">
                Update the title, description, category, and tags for this media item
              </DialogDescription>
            </DialogHeader>
            {editingItem && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-title" data-testid="label-edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    data-testid="input-edit-title"
                    value={editingItem.title || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description" data-testid="label-edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    data-testid="textarea-edit-description"
                    value={editingItem.description || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category" data-testid="label-edit-category">Category</Label>
                  <Input
                    id="edit-category"
                    data-testid="input-edit-category"
                    value={editingItem.category || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-tags" data-testid="label-edit-tags">Tags (comma-separated)</Label>
                  <Input
                    id="edit-tags"
                    data-testid="input-edit-tags"
                    value={editingItem.tags ? editingItem.tags.join(', ') : ''}
                    onChange={(e) => setEditingItem({ ...editingItem, tags: e.target.value.split(',').map((t: string) => t.trim()) })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit-media">
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-save-edit-media">
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  if (isLoadingContext || isLoadingKB || isLoadingInstructions || isLoadingMedia) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-ai-settings" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-ai-settings">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="title-page">AI Assistant Settings</h2>
        <p className="text-muted-foreground" data-testid="description-page">
          Customize and train your AI assistant to better understand your business
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-ai-settings">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="questionnaire" data-testid="tab-questionnaire">
            <Brain className="mr-2 h-4 w-4" />
            Business Profile
          </TabsTrigger>
          <TabsTrigger value="knowledge" data-testid="tab-knowledge">
            <BookOpen className="mr-2 h-4 w-4" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="media" data-testid="tab-media">
            <ImageIcon className="mr-2 h-4 w-4" />
            Media Library
          </TabsTrigger>
          <TabsTrigger value="instructions" data-testid="tab-instructions">
            <Settings2 className="mr-2 h-4 w-4" />
            Custom Instructions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questionnaire" data-testid="content-questionnaire">
          <BusinessQuestionnaire />
        </TabsContent>

        <TabsContent value="knowledge" data-testid="content-knowledge">
          <KnowledgeBaseManager />
        </TabsContent>

        <TabsContent value="media" data-testid="content-media">
          <MediaLibraryManager />
        </TabsContent>

        <TabsContent value="instructions" data-testid="content-instructions">
          <CustomInstructionsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
