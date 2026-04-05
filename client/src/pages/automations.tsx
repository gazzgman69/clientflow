import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Bot, Zap, Play, Pause } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAutomationSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Automation } from "@shared/schema";
import { z } from "zod";

const automationFormSchema = insertAutomationSchema.extend({
  actions: z.array(z.string()).min(1, "At least one action is required"),
});

export default function Automations() {
  const [showAutomationModal, setShowAutomationModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: automations, isLoading } = useQuery<Automation[]>({
    queryKey: ["/api/automations"],
  });

  const form = useForm<z.infer<typeof automationFormSchema>>({
    resolver: zodResolver(automationFormSchema),
    defaultValues: {
      name: "",
      description: "",
      trigger: "",
      actions: [],
      isActive: true,
      createdBy: "", // This would be set to current user
    },
  });

  const createAutomationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof automationFormSchema>) => {
      const automationData = {
        ...data,
      };
      const response = await apiRequest("POST", "/api/automations", automationData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({
        title: "Success",
        description: "Automation created successfully!",
      });
      form.reset();
      setShowAutomationModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create automation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateAutomationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof automationFormSchema> }) => {
      const response = await apiRequest("PATCH", `/api/automations/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({ title: "Automation updated" });
      form.reset();
      setShowAutomationModal(false);
      setEditingAutomation(null);
    },
    onError: () => {
      toast({ title: "Failed to update automation", variant: "destructive" });
    },
  });

  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/automations/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({ title: "Automation updated" });
    },
    onError: () => {
      toast({ title: "Failed to update automation", variant: "destructive" });
    },
  });

  const deleteAutomationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({ title: "Automation deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete automation", variant: "destructive" });
    },
  });

  const handleEditAutomation = (automation: any) => {
    setEditingAutomation(automation);
    form.reset({
      name: automation.name,
      description: automation.description || "",
      trigger: automation.trigger,
      actions: automation.actions,
      isActive: automation.isActive,
    });
    setShowAutomationModal(true);
  };

  const onSubmit = (data: z.infer<typeof automationFormSchema>) => {
    if (editingAutomation) {
      updateAutomationMutation.mutate({ id: editingAutomation.id!, data });
    } else {
      createAutomationMutation.mutate(data);
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const handleAddAutomation = () => {
    setEditingAutomation(null);
    form.reset();
    setShowAutomationModal(true);
  };

  const triggerOptions = [
    { value: "project_created", label: "Project Created" },
    { value: "quote_sent", label: "Quote Sent" },
    { value: "quote_approved", label: "Quote Approved" },
    { value: "contract_signed", label: "Contract Signed" },
    { value: "invoice_overdue", label: "Invoice Overdue" },
    { value: "invoice_paid", label: "Invoice Paid" },
    { value: "project_completed", label: "Project Completed" },
    { value: "contact_added", label: "Contact Added" },
  ];

  const actionOptions = [
    { value: "send_email", label: "Send Email" },
    { value: "create_task", label: "Create Task" },
    { value: "update_status", label: "Update Status" },
    { value: "send_notification", label: "Send Notification" },
    { value: "assign_to_user", label: "Assign to User" },
    { value: "create_follow_up", label: "Create Follow-up" },
  ];

  return (
    <>
      <Header 
        title="Automations" 
        subtitle="Create and manage workflow automations"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Stats Cards */}
          <Card data-testid="automation-stats-active">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Automations</p>
                  <p className="text-3xl font-bold text-foreground">
                    {automations?.filter(a => a.isActive).length || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Play className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="automation-stats-total">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Automations</p>
                  <p className="text-3xl font-bold text-foreground">
                    {automations?.length || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="automation-stats-inactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Inactive Automations</p>
                  <p className="text-3xl font-bold text-foreground">
                    {automations?.filter(a => !a.isActive).length || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Pause className="h-6 w-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="automations-table-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Automations</CardTitle>
              <Button onClick={handleAddAutomation} data-testid="button-add-automation">
                <Plus className="h-4 w-4 mr-2" />
                Create Automation
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              </div>
            ) : !automations || automations.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-automations-state">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No automations found</p>
                <Button onClick={handleAddAutomation} data-testid="button-add-first-automation">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Automation
                </Button>
              </div>
            ) : (
              <Table data-testid="automations-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automations.map((automation) => (
                    <TableRow key={automation.id} data-testid={`automation-row-${automation.id}`}>
                      <TableCell className="font-medium" data-testid={`automation-name-${automation.id}`}>
                        {automation.name}
                      </TableCell>
                      <TableCell data-testid={`automation-trigger-${automation.id}`}>
                        <Badge variant="outline">
                          {triggerOptions.find(t => t.value === automation.trigger)?.label || automation.trigger}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`automation-actions-${automation.id}`}>
                        <div className="flex flex-wrap gap-1">
                          {automation.actions.slice(0, 2).map((action, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {actionOptions.find(a => a.value === action)?.label || action}
                            </Badge>
                          ))}
                          {automation.actions.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{automation.actions.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`automation-status-${automation.id}`}>
                        <Badge className={getStatusColor(automation.isActive || false)}>
                          {automation.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`automation-created-${automation.id}`}>
                        {formatDistanceToNow(new Date(automation.createdAt!), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" data-testid={`toggle-automation-${automation.id}`} onClick={() => toggleAutomationMutation.mutate({ id: automation.id!, isActive: !automation.isActive })}>
                            {automation.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`edit-automation-${automation.id}`} onClick={() => handleEditAutomation(automation)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`delete-automation-${automation.id}`} onClick={() => deleteAutomationMutation.mutate(automation.id!)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add/Edit Automation Modal */}
      <Dialog open={showAutomationModal} onOpenChange={(open) => { if (!open) { setShowAutomationModal(false); setEditingAutomation(null); form.reset(); } else setShowAutomationModal(true); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAutomation ? 'Edit Automation' : 'Create New Automation'}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Automation Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-automation-name" />
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
                      <Textarea 
                        rows={3} 
                        placeholder="Describe what this automation does..." 
                        {...field} 
                        value={field.value || ""}
                        data-testid="textarea-automation-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="trigger"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trigger *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-automation-trigger">
                          <SelectValue placeholder="Select a trigger..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {triggerOptions.map((trigger) => (
                          <SelectItem key={trigger.value} value={trigger.value}>
                            {trigger.label}
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
                name="actions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actions *</FormLabel>
                    <div className="space-y-2">
                      {actionOptions.map((action) => (
                        <div key={action.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={action.value}
                            checked={field.value?.includes(action.value) || false}
                            onChange={(e) => {
                              const currentActions = field.value || [];
                              if (e.target.checked) {
                                field.onChange([...currentActions, action.value]);
                              } else {
                                field.onChange(currentActions.filter(a => a !== action.value));
                              }
                            }}
                            className="rounded border-border"
                            data-testid={`checkbox-action-${action.value}`}
                          />
                          <label htmlFor={action.value} className="text-sm font-medium">
                            {action.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Enable Automation</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value || false}
                        onCheckedChange={field.onChange}
                        data-testid="switch-automation-active"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setShowAutomationModal(false); setEditingAutomation(null); form.reset(); }}
                  data-testid="button-cancel-automation"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAutomationMutation.isPending || updateAutomationMutation.isPending}
                  data-testid="button-save-automation"
                >
                  {(createAutomationMutation.isPending || updateAutomationMutation.isPending)
                    ? "Saving..."
                    : editingAutomation ? "Update Automation" : "Create Automation"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
