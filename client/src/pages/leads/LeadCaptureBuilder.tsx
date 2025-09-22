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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Settings, Eye, Copy, Trash2, FileText, GripVertical, Code, ExternalLink } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import InstallFormMenu from '@/components/leads/InstallFormMenu';
import QuestionEditor from '@/components/leads/QuestionEditor';
import { VenueAutocomplete } from '@/components/venues/VenueAutocomplete';

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
  id?: string;
  type: string;
  label: string;
  required: boolean;
  mapTo: string;
  options?: string;
  orderIndex: number;
}

interface PreviewQuestion {
  id: string;
  type: string;
  label: string;
  required: boolean;
  mapTo: string;
  options?: string;
  orderIndex: number;
}

// Form Preview Component
interface FormPreviewProps {
  slug: string;
  formTitle: string;
  onClose: () => void;
}

function FormPreview({ slug, formTitle, onClose }: FormPreviewProps) {
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const { toast } = useToast();

  // Fetch form data
  const { data: formData, isLoading, error } = useQuery({
    queryKey: ['/api/leads/public', slug],
    queryFn: async () => {
      const response = await fetch(`/api/leads/public/${slug}`);
      if (!response.ok) {
        throw new Error('Form not found');
      }
      return response.json();
    },
  });

  const handleInputChange = (questionId: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handlePreviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'Preview Mode',
      description: 'This is a preview - no data was actually submitted.',
      variant: 'default',
    });
  };

  const renderQuestion = (question: PreviewQuestion) => {
    const value = formValues[question.mapTo] || '';

    switch (question.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
      case 'date':
        return (
          <Input
            type={question.type}
            value={value}
            onChange={(e) => handleInputChange(question.mapTo, e.target.value)}
            required={question.required}
            data-testid={`preview-input-${question.mapTo}`}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleInputChange(question.mapTo, e.target.value)}
            required={question.required}
            rows={4}
            data-testid={`preview-textarea-${question.mapTo}`}
          />
        );

      case 'select':
        const selectOptions = question.options ? question.options.split(',').map(opt => opt.trim()) : [];
        return (
          <Select
            value={value}
            onValueChange={(val) => handleInputChange(question.mapTo, val)}
            required={question.required}
          >
            <SelectTrigger data-testid={`preview-select-${question.mapTo}`}>
              <SelectValue placeholder="Please select..." />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((option, idx) => (
                <SelectItem key={idx} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'venue':
      case 'address':
        return (
          <VenueAutocomplete
            onVenueSelect={(venue: { placeId: string; name: string; address: string; city?: string; state?: string; zipCode?: string; country?: string; latitude?: number; longitude?: number; }) => {
              // Build complete address including postcode
              const addressParts = [];
              if (venue.address || venue.name) {
                addressParts.push(venue.address || venue.name);
              }
              if (venue.city) {
                addressParts.push(venue.city);
              }
              if (venue.zipCode) {
                addressParts.push(venue.zipCode);
              }
              if (venue.country) {
                addressParts.push(venue.country);
              }
              
              const fullAddress = addressParts.join(', ');
              handleInputChange(question.mapTo, fullAddress);
            }}
            placeholder="Search for an address or venue..."
            className="w-full"
          />
        );

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(question.mapTo, e.target.value)}
            required={question.required}
            data-testid={`preview-input-${question.mapTo}`}
          />
        );
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center">Loading form preview...</div>;
  }

  if (error || !formData) {
    return <div className="p-4 text-center text-red-500">Error loading form preview</div>;
  }

  return (
    <div className="space-y-6">
      {/* Preview Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-700 font-medium">
          📋 Form Preview Mode - No data will be submitted
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{formData.form.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePreviewSubmit} className="space-y-4">
            {formData.questions
              .sort((a: PreviewQuestion, b: PreviewQuestion) => a.orderIndex - b.orderIndex)
              .map((question: PreviewQuestion) => (
                <div key={question.id} className="space-y-2">
                  <Label className="text-sm font-medium">
                    {question.label}
                    {question.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </Label>
                  {renderQuestion(question)}
                </div>
              ))}

            {/* Transparency text */}
            {formData.form.transparency && (
              <div className="mt-6 p-3 bg-gray-50 rounded text-xs text-gray-600">
                {formData.form.transparency}
              </div>
            )}

            {/* Submit button */}
            <div className="pt-4">
              <Button type="submit" className="w-full" data-testid="preview-submit-button">
                Submit Form (Preview)
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LeadCaptureBuilder() {
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formDetails, setFormDetails] = useState<FormDetails | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all forms
  const { data: forms = [], isLoading: formsLoading } = useQuery<LeadForm[]>({
    queryKey: ['/api/lead-forms'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/lead-forms');
      return response.json();
    },
  });

  // Fetch selected form details
  const { data: formData, isLoading: formLoading } = useQuery({
    queryKey: ['/api/lead-forms', selectedFormId],
    queryFn: async () => {
      if (!selectedFormId) return null;
      const response = await apiRequest('GET', `/api/lead-forms/${selectedFormId}`);
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
      const response = await apiRequest('POST', '/api/lead-forms', { title });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-forms'] });
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
      const response = await apiRequest('PATCH', `/api/lead-forms/${selectedFormId}`, {
        form: formDetails,
        questions: questions
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-forms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/lead-forms', selectedFormId] });
      toast({ title: 'Form saved successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to save form', variant: 'destructive' });
    },
  });

  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: async (formId: string) => {
      const response = await apiRequest('DELETE', `/api/lead-forms/${formId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-forms'] });
      if (selectedFormId === deleteFormMutation.variables) {
        setSelectedFormId(null);
        setFormDetails(null);
        setQuestions([]);
      }
      toast({ title: 'Form deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete form', variant: 'destructive' });
    },
  });

  const handleCreateForm = () => {
    createFormMutation.mutate('New Capture Form');
  };

  const handleSaveForm = () => {
    saveFormMutation.mutate();
  };

  const handleDeleteForm = (formId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent form selection when clicking delete
    deleteFormMutation.mutate(formId);
  };

  const handlePreview = () => {
    if (formDetails?.slug) {
      setShowPreview(true);
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

  const handleDragStart = (e: React.DragEvent, questionId: string) => {
    setDraggedQuestionId(questionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', questionId);
    
    // Create a custom drag image
    const dragElement = e.currentTarget as HTMLElement;
    const rect = dragElement.getBoundingClientRect();
    e.dataTransfer.setDragImage(dragElement, rect.width / 2, rect.height / 2);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(targetIndex);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (!draggedQuestionId) {
      return;
    }

    setQuestions(prev => {
      const sortedQuestions = [...prev].sort((a, b) => a.orderIndex - b.orderIndex);
      const draggedIndex = sortedQuestions.findIndex(q => q.id === draggedQuestionId);
      
      if (draggedIndex === -1) {
        return prev;
      }

      // Don't move if dropping in the same position or adjacent position
      if (draggedIndex === targetIndex || draggedIndex === targetIndex - 1) {
        return prev;
      }

      // Remove the dragged question
      const [draggedQuestion] = sortedQuestions.splice(draggedIndex, 1);
      
      // Adjust target index if dragging from above
      let insertIndex = targetIndex;
      if (draggedIndex < targetIndex) {
        insertIndex = targetIndex - 1;
      }
      
      // Insert at new position
      sortedQuestions.splice(insertIndex, 0, draggedQuestion);

      // Update orderIndex for all questions
      return sortedQuestions.map((question, index) => ({
        ...question,
        orderIndex: index
      }));
    });

    setDraggedQuestionId(null);
  };

  const handleDragEnd = () => {
    setDraggedQuestionId(null);
    setDragOverIndex(null);
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
                      className={`group p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedFormId === form.id 
                          ? 'bg-primary/10 border-primary' 
                          : 'hover:bg-muted/50'
                      }`}
                      data-testid={`form-item-${form.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{form.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            Updated {formatDate(form.updatedAt)}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                              data-testid={`button-delete-form-${form.id}`}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Form</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{form.title}"? This action cannot be undone and will permanently remove the form and all its submissions.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => handleDeleteForm(form.id, e)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-testid={`confirm-delete-form-${form.id}`}
                              >
                                Delete Form
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
                      <div className="space-y-1">
                        {questions
                          .sort((a, b) => a.orderIndex - b.orderIndex)
                          .map((question, index) => (
                            <div key={question.id}>
                              {/* Drop zone above each item */}
                              <div
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, index)}
                                className={`h-3 transition-all ${
                                  dragOverIndex === index && draggedQuestionId !== question.id
                                    ? 'bg-primary/20 border-2 border-dashed border-primary rounded'
                                    : ''
                                }`}
                              />
                              
                              {/* Question item */}
                              <div
                                className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                                  draggedQuestionId === question.id 
                                    ? 'opacity-30 scale-95 bg-muted' 
                                    : 'hover:shadow-md hover:border-primary/30'
                                }`}
                                data-testid={`question-${question.id}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, question.id || '')}
                                    onDragEnd={handleDragEnd}
                                    className="cursor-move p-1 hover:bg-muted rounded transition-colors"
                                    title="Drag to reorder"
                                  >
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>
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
                                    onClick={() => handleDeleteQuestion(question.id || '')}
                                    data-testid={`button-delete-question-${question.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Drop zone after last item */}
                              {index === questions.length - 1 && (
                                <div
                                  onDragOver={(e) => handleDragOver(e, questions.length)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, questions.length)}
                                  className={`h-3 transition-all ${
                                    dragOverIndex === questions.length
                                      ? 'bg-primary/20 border-2 border-dashed border-primary rounded'
                                      : ''
                                  }`}
                                />
                              )}
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

        {/* Form Preview Modal */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Form Preview: {formDetails?.title}</DialogTitle>
            </DialogHeader>
            {formDetails?.slug && (
              <FormPreview 
                slug={formDetails.slug}
                formTitle={formDetails.title}
                onClose={() => setShowPreview(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}