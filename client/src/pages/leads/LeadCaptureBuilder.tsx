import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Settings, Eye, Copy, Trash2, FileText, GripVertical, Code, ExternalLink } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import InstallFormMenu from '@/components/leads/InstallFormMenu';
import QuestionEditor from '@/components/leads/QuestionEditor';

interface LeadForm {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
}

interface FormDetails {
  id: string;
  title: string;
  slug: string;
  projectName: string;
  notification: string;
  autoResponseTemplateId: string | null;
  calendarId: string | null;
  lifecycleId: string | null;
  workflowId: string | null;
  contactTags: string | null;
  projectTags: string | null;
  recaptchaEnabled: boolean;
  isActive: boolean;
  transparency: string;
  updatedAt: string;
}

interface Question {
  id: string;
  type: string;
  label: string;
  required: boolean;
  mapTo: string;
  options?: string;
  orderIndex: number;
}

export default function LeadCaptureBuilder() {
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formDetails, setFormDetails] = useState<FormDetails | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all forms
  const { data: forms = [], isLoading: formsLoading } = useQuery<LeadForm[]>({
    queryKey: ['/api/admin/lead-forms'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/lead-forms');
      return response.json();
    },
  });

  // Fetch selected form details
  const { data: formData, isLoading: formLoading } = useQuery({
    queryKey: ['/api/admin/lead-forms', selectedFormId],
    queryFn: async () => {
      if (!selectedFormId) return null;
      const response = await apiRequest('GET', `/api/admin/lead-forms/${selectedFormId}`);
      return response.json();
    },
    enabled: !!selectedFormId,
  });

  useEffect(() => {
    if (formData) {
      setFormDetails(formData.form);
      setQuestions(formData.questions || []);
    }
  }, [formData]);

  // Create new form mutation
  const createFormMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest('POST', '/api/admin/lead-forms', { title });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/lead-forms'] });
      setSelectedFormId(data.id);
      toast({ title: 'Form created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create form', variant: 'destructive' });
    },
  });

  // Save form mutation
  const saveFormMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFormId || !formDetails) return;
      const response = await apiRequest('PATCH', `/api/admin/lead-forms/${selectedFormId}`, {
        form: formDetails,
        questions: questions
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/lead-forms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/lead-forms', selectedFormId] });
      toast({ title: 'Form saved successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to save form', variant: 'destructive' });
    },
  });

  const handleCreateForm = () => {
    createFormMutation.mutate('New Capture Form');
  };

  const handleSaveForm = () => {
    saveFormMutation.mutate();
  };

  const handlePreview = () => {
    if (formDetails?.slug) {
      window.open(`/f/${formDetails.slug}`, '_blank');
    } else {
      toast({ 
        title: 'Save required', 
        description: 'Please save the form first to generate a preview link',
        variant: 'destructive' 
      });
    }
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setShowQuestionEditor(true);
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setShowQuestionEditor(true);
  };

  const handleSaveQuestion = (question: Question) => {
    if (editingQuestion) {
      setQuestions(prev => prev.map(q => q.id === question.id ? question : q));
    } else {
      setQuestions(prev => [...prev, question]);
    }
  };

  const handleDeleteQuestion = (questionId: string) => {
    setQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  return (
    <>
      <Header 
        title="Lead Capture Forms" 
        subtitle="Create and manage lead capture forms for your website"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar - Forms List */}
          <div className="lg:col-span-1">
            <Card data-testid="forms-sidebar">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Forms</CardTitle>
                  <Button 
                    onClick={handleCreateForm}
                    disabled={createFormMutation.isPending}
                    data-testid="button-create-form"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {createFormMutation.isPending ? 'Creating...' : 'Add Method'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {formsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : forms.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No forms created yet
                  </p>
                ) : (
                  forms.map((form) => (
                    <div
                      key={form.id}
                      onClick={() => setSelectedFormId(form.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedFormId === form.id 
                          ? 'bg-primary/10 border-primary' 
                          : 'hover:bg-muted/50'
                      }`}
                      data-testid={`form-item-${form.id}`}
                    >
                      <h4 className="font-medium text-sm">{form.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        Updated {formatDate(form.updatedAt)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Form Details */}
          <div className="lg:col-span-2">
            {!selectedFormId ? (
              <Card data-testid="no-form-selected">
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No form selected</h3>
                    <p className="text-muted-foreground mb-4">
                      Select a form from the sidebar or create a new one to get started
                    </p>
                    <Button onClick={handleCreateForm} data-testid="button-create-first-form">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Form
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : formLoading ? (
              <div className="space-y-6">
                <div className="h-24 bg-muted rounded animate-pulse" />
                <div className="h-64 bg-muted rounded animate-pulse" />
                <div className="h-32 bg-muted rounded animate-pulse" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Form Actions */}
                <Card data-testid="form-actions">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{formDetails?.title || 'Form Details'}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Configure your form settings and questions
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={handlePreview}
                          disabled={!formDetails?.slug}
                          data-testid="button-preview-form"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <InstallFormMenu slug={formDetails?.slug || ''}>
                          <Button 
                            variant="outline"
                            disabled={!formDetails?.slug}
                            data-testid="button-install-form"
                          >
                            <Code className="h-4 w-4 mr-2" />
                            Install Form
                          </Button>
                        </InstallFormMenu>
                        <Button
                          onClick={handleSaveForm}
                          disabled={saveFormMutation.isPending || !formDetails}
                          data-testid="button-save-form"
                        >
                          {saveFormMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Form Settings */}
                <Card data-testid="form-settings">
                  <CardHeader>
                    <CardTitle>Form Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="form-title">Form Title</Label>
                        <Input
                          id="form-title"
                          value={formDetails?.title || ''}
                          onChange={(e) => setFormDetails(prev => prev ? {...prev, title: e.target.value} : null)}
                          data-testid="input-form-title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="project-name">Project Name</Label>
                        <Input
                          id="project-name"
                          value={formDetails?.projectName || ''}
                          onChange={(e) => setFormDetails(prev => prev ? {...prev, projectName: e.target.value} : null)}
                          data-testid="input-project-name"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="notification">Notification Method</Label>
                        <Select
                          value={formDetails?.notification || 'email'}
                          onValueChange={(value) => setFormDetails(prev => prev ? {...prev, notification: value} : null)}
                        >
                          <SelectTrigger data-testid="select-notification">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="recaptcha"
                          checked={formDetails?.recaptchaEnabled || false}
                          onCheckedChange={(checked) => setFormDetails(prev => prev ? {...prev, recaptchaEnabled: checked} : null)}
                          data-testid="switch-recaptcha"
                        />
                        <Label htmlFor="recaptcha">Enable reCAPTCHA</Label>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="transparency">Transparency Text</Label>
                      <Textarea
                        id="transparency"
                        value={formDetails?.transparency || ''}
                        onChange={(e) => setFormDetails(prev => prev ? {...prev, transparency: e.target.value} : null)}
                        placeholder="Explain how you'll use the submitted information"
                        data-testid="textarea-transparency"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Questions */}
                <Card data-testid="form-questions">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Questions</CardTitle>
                      <Button
                        onClick={handleAddQuestion}
                        data-testid="button-add-question"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Question
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {questions.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">No questions added yet</p>
                        <Button onClick={handleAddQuestion} data-testid="button-add-first-question">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First Question
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {questions
                          .sort((a, b) => a.orderIndex - b.orderIndex)
                          .map((question) => (
                            <div
                              key={question.id}
                              className="flex items-center justify-between p-3 border rounded-lg"
                              data-testid={`question-${question.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{question.label}</span>
                                    {question.required && (
                                      <Badge variant="destructive" className="text-xs">Required</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {question.type} • Maps to: {question.mapTo}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditQuestion(question)}
                                  data-testid={`button-edit-question-${question.id}`}
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteQuestion(question.id)}
                                  data-testid={`button-delete-question-${question.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Question Editor Modal */}
        <QuestionEditor
          isOpen={showQuestionEditor}
          onClose={() => setShowQuestionEditor(false)}
          onSave={handleSaveQuestion}
          question={editingQuestion}
          nextOrderIndex={questions.length}
        />
      </main>
    </>
  );
}