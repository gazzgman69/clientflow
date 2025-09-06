import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Play } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  fromStatus: string | null;
  toStatus: string;
  triggerType: string;
  triggerConfig: string;
  ifConflictBlock: boolean;
  requireNoManualSinceMinutes: number | null;
  actionEmailTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

const ruleFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  enabled: z.boolean().default(true),
  fromStatus: z.string().nullable(),
  toStatus: z.string().min(1, "To status is required"),
  triggerType: z.string().min(1, "Trigger type is required"),
  triggerConfig: z.string().min(1, "Trigger configuration is required"),
  ifConflictBlock: z.boolean().default(false),
  requireNoManualSinceMinutes: z.number().nullable().optional(),
  actionEmailTemplateId: z.string().nullable().optional(),
});

type RuleFormData = z.infer<typeof ruleFormSchema>;

const STATUS_OPTIONS = [
  { value: "", label: "Any Status" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "archived", label: "Archived" }
];

const TRIGGER_TYPES = [
  { value: "TIME_SINCE_CREATED", label: "Time Since Created" },
  { value: "TIME_SINCE_LAST_CONTACT", label: "Time Since Last Contact" },
  { value: "PROJECT_DATE_IN_DAYS", label: "Project Date in Days" },
  { value: "FORM_ANSWER_EQUALS", label: "Form Answer Equals" }
];

export default function Automations() {
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [triggerType, setTriggerType] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: "",
      enabled: true,
      fromStatus: null,
      toStatus: "",
      triggerType: "",
      triggerConfig: "",
      ifConflictBlock: false,
      requireNoManualSinceMinutes: null,
      actionEmailTemplateId: null,
    },
  });

  // Fetch automation rules
  const { data: rules, isLoading } = useQuery<AutomationRule[]>({
    queryKey: ["/api/admin/lead-automation/rules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/lead-automation/rules");
      return response.json();
    },
  });

  // Create/update rule mutation
  const saveRuleMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      if (editingRule) {
        return await apiRequest("PATCH", `/api/admin/lead-automation/rules/${editingRule.id}`, data);
      } else {
        return await apiRequest("POST", "/api/admin/lead-automation/rules", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lead-automation/rules"] });
      setShowRuleDialog(false);
      setEditingRule(null);
      form.reset();
      toast({
        title: "Rule saved",
        description: "Automation rule has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save automation rule.",
        variant: "destructive",
      });
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/lead-automation/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lead-automation/rules"] });
      toast({
        title: "Rule deleted",
        description: "Automation rule has been deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete automation rule.",
        variant: "destructive",
      });
    },
  });

  // Run automation mutation
  const runAutomationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/lead-automation/run");
    },
    onSuccess: () => {
      toast({
        title: "Automation triggered",
        description: "Lead automation has been executed manually.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to run automation.",
        variant: "destructive",
      });
    },
  });

  const handleEditRule = (rule: AutomationRule) => {
    setEditingRule(rule);
    setTriggerType(rule.triggerType);
    
    // Parse trigger config for form
    let triggerConfig = rule.triggerConfig;
    try {
      const parsed = JSON.parse(rule.triggerConfig);
      if (rule.triggerType === "TIME_SINCE_CREATED" || rule.triggerType === "TIME_SINCE_LAST_CONTACT") {
        triggerConfig = parsed.minutes?.toString() || "";
      } else if (rule.triggerType === "PROJECT_DATE_IN_DAYS") {
        triggerConfig = parsed.days?.toString() || "";
      } else if (rule.triggerType === "FORM_ANSWER_EQUALS") {
        triggerConfig = `${parsed.field || ""}:${parsed.equals || ""}`;
      }
    } catch {
      // Keep as string if parsing fails
    }

    form.reset({
      name: rule.name,
      enabled: rule.enabled,
      fromStatus: rule.fromStatus || "",
      toStatus: rule.toStatus,
      triggerType: rule.triggerType,
      triggerConfig,
      ifConflictBlock: rule.ifConflictBlock,
      requireNoManualSinceMinutes: rule.requireNoManualSinceMinutes,
      actionEmailTemplateId: rule.actionEmailTemplateId,
    });
    setShowRuleDialog(true);
  };

  const handleNewRule = () => {
    setEditingRule(null);
    setTriggerType("");
    form.reset();
    setShowRuleDialog(true);
  };

  const onSubmit = (data: RuleFormData) => {
    // Format trigger config based on type
    let formattedConfig = data.triggerConfig;
    try {
      if (data.triggerType === "TIME_SINCE_CREATED" || data.triggerType === "TIME_SINCE_LAST_CONTACT") {
        formattedConfig = JSON.stringify({ minutes: parseInt(data.triggerConfig) || 0 });
      } else if (data.triggerType === "PROJECT_DATE_IN_DAYS") {
        formattedConfig = JSON.stringify({ days: parseInt(data.triggerConfig) || 0 });
      } else if (data.triggerType === "FORM_ANSWER_EQUALS") {
        const [field, equals] = data.triggerConfig.split(":");
        formattedConfig = JSON.stringify({ field: field?.trim(), equals: equals?.trim() });
      }
    } catch {
      // Keep original if formatting fails
    }

    saveRuleMutation.mutate({
      ...data,
      triggerConfig: formattedConfig,
      fromStatus: data.fromStatus || null,
    });
  };

  const getTriggerDescription = (rule: AutomationRule) => {
    try {
      const config = JSON.parse(rule.triggerConfig);
      switch (rule.triggerType) {
        case "TIME_SINCE_CREATED":
          return `${config.minutes || 0} minutes after creation`;
        case "TIME_SINCE_LAST_CONTACT":
          return `${config.minutes || 0} minutes since last contact`;
        case "PROJECT_DATE_IN_DAYS":
          return `Within ${config.days || 0} days of project date`;
        case "FORM_ANSWER_EQUALS":
          return `When ${config.field || "field"} = "${config.equals || "value"}"`;
        default:
          return rule.triggerType;
      }
    } catch {
      return rule.triggerType;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  return (
    <>
      <Header 
        title="Lead Automations" 
        subtitle="Manage automated lead status transitions"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Actions Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Automation Rules</CardTitle>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => runAutomationMutation.mutate()}
                    disabled={runAutomationMutation.isPending}
                    data-testid="run-automation"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run Now
                  </Button>
                  <Button onClick={handleNewRule} data-testid="new-rule">
                    <Plus className="h-4 w-4 mr-2" />
                    New Rule
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              ) : !rules || rules.length === 0 ? (
                <div className="text-center py-12" data-testid="empty-rules-state">
                  <p className="text-muted-foreground mb-4">No automation rules configured</p>
                  <Button onClick={handleNewRule}>Create your first rule</Button>
                </div>
              ) : (
                <Table data-testid="rules-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>From → To</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id} data-testid={`rule-row-${rule.id}`}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {rule.fromStatus || "Any"} → {rule.toStatus}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {getTriggerDescription(rule)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.enabled ? "default" : "secondary"}>
                            {rule.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(rule.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRule(rule)}
                              data-testid={`edit-rule-${rule.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              disabled={deleteRuleMutation.isPending}
                              data-testid={`delete-rule-${rule.id}`}
                            >
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

          {/* Rule Dialog */}
          <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
            <DialogContent className="max-w-2xl" data-testid="rule-dialog">
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? "Edit Rule" : "New Automation Rule"}
                </DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rule Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="rule-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0 pt-6">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="rule-enabled"
                            />
                          </FormControl>
                          <FormLabel className="text-sm">Enabled</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fromStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="from-status">
                                <SelectValue placeholder="Select from status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
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
                      name="toStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>To Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="to-status">
                                <SelectValue placeholder="Select to status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STATUS_OPTIONS.slice(1).map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="triggerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger Type</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            setTriggerType(value);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="trigger-type">
                              <SelectValue placeholder="Select trigger type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TRIGGER_TYPES.map((trigger) => (
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
                    name="triggerConfig"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {triggerType === "TIME_SINCE_CREATED" && "Minutes after creation"}
                          {triggerType === "TIME_SINCE_LAST_CONTACT" && "Minutes since last contact"}
                          {triggerType === "PROJECT_DATE_IN_DAYS" && "Days before/after project date"}
                          {triggerType === "FORM_ANSWER_EQUALS" && "Field:Value (e.g., service:Wedding)"}
                          {!triggerType && "Trigger Configuration"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={
                              triggerType === "FORM_ANSWER_EQUALS" 
                                ? "service:Wedding" 
                                : "Enter number"
                            }
                            data-testid="trigger-config"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ifConflictBlock"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="conflict-block"
                            />
                          </FormControl>
                          <FormLabel className="text-sm">Block if conflict detected</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requireNoManualSinceMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manual activity grace period (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                              data-testid="manual-grace-period"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRuleDialog(false)}
                      data-testid="cancel-rule"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={saveRuleMutation.isPending}
                      data-testid="save-rule"
                    >
                      {saveRuleMutation.isPending ? "Saving..." : "Save Rule"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </>
  );
}