import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Brain, BookOpen, Settings2, FileText, Plus, Edit, Trash2, Check, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
              <div className="flex items-center space-x-2">
                <Switch
                  id="kb-active"
                  data-testid="switch-kb-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="kb-active" data-testid="label-kb-active">Active</Label>
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

  if (isLoadingContext || isLoadingKB || isLoadingInstructions) {
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

        <TabsContent value="instructions" data-testid="content-instructions">
          <CustomInstructionsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
