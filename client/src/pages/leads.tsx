import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, ChevronDown, Clock } from "lucide-react";
import LeadCaptureModal from "@/components/modals/lead-capture-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lead } from "@shared/schema";
import { formatDistanceToNow, addDays, format } from "date-fns";

// Spec-aligned lead statuses
const LEAD_STATUSES = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'hold', label: 'Hold / Pencilled', color: 'bg-orange-100 text-orange-800' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-purple-100 text-purple-800' },
  { value: 'converted', label: 'Converted', color: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800' },
] as const;

const LOST_REASONS = [
  { value: 'price_too_high', label: 'Price too high' },
  { value: 'date_unavailable', label: 'Date unavailable' },
  { value: 'went_with_another', label: 'Went with another act' },
  { value: 'no_response', label: 'No response' },
  { value: 'other', label: 'Other' },
] as const;

function getStatusConfig(status: string) {
  // Map legacy statuses to new ones for display
  const mapped = status === 'follow-up' ? 'contacted' : status === 'qualified' ? 'contacted' : status;
  return LEAD_STATUSES.find(s => s.value === mapped) || LEAD_STATUSES[0];
}

export default function Leads() {
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [showLostReasonDialog, setShowLostReasonDialog] = useState(false);
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ leadId: string; status: string } | null>(null);
  const [lostReason, setLostReason] = useState<string>('');
  const [lostReasonNotes, setLostReasonNotes] = useState('');
  const [holdExpiryDays, setHoldExpiryDays] = useState('14');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (leadId: string) => {
      return await apiRequest("DELETE", `/api/leads/${leadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead deleted", description: "The lead has been successfully deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete lead. Please try again.", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (data: { leadId: string; status: string; lostReason?: string; lostReasonNotes?: string; holdExpiresAt?: string }) => {
      const { leadId, ...body } = data;
      return await apiRequest("PATCH", `/api/leads/${leadId}/status`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Status updated", description: "Lead status has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    },
  });

  const handleStatusChange = (leadId: string, newStatus: string) => {
    if (newStatus === 'lost') {
      setPendingStatusChange({ leadId, status: newStatus });
      setLostReason('');
      setLostReasonNotes('');
      setShowLostReasonDialog(true);
    } else if (newStatus === 'hold') {
      setPendingStatusChange({ leadId, status: newStatus });
      setHoldExpiryDays('14');
      setShowHoldDialog(true);
    } else {
      statusMutation.mutate({ leadId, status: newStatus });
    }
  };

  const confirmLostReason = () => {
    if (!pendingStatusChange || !lostReason) return;
    statusMutation.mutate({
      leadId: pendingStatusChange.leadId,
      status: 'lost',
      lostReason,
      lostReasonNotes: lostReason === 'other' ? lostReasonNotes : undefined,
    });
    setShowLostReasonDialog(false);
    setPendingStatusChange(null);
  };

  const confirmHold = () => {
    if (!pendingStatusChange) return;
    const expiryDate = addDays(new Date(), parseInt(holdExpiryDays) || 14);
    statusMutation.mutate({
      leadId: pendingStatusChange.leadId,
      status: 'hold',
      holdExpiresAt: expiryDate.toISOString(),
    });
    setShowHoldDialog(false);
    setPendingStatusChange(null);
  };

  return (
    <>
      <Header
        title="Leads"
        subtitle="Manage and track your enquiries"
      />

      <main className="flex-1 overflow-auto p-6">
        <Card data-testid="leads-table-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Leads</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" asChild data-testid="button-lead-capture-forms">
                  <Link href="/leads/capture">Lead Capture Forms</Link>
                </Button>
                <Button onClick={() => setShowLeadCapture(true)} data-testid="button-add-lead">
                  <Plus className="h-4 w-4 mr-2" />
                  Quick Add
                </Button>
              </div>
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
            ) : !leads || leads.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-leads-state">
                <p className="text-muted-foreground mb-4">No leads yet</p>
                <Button onClick={() => setShowLeadCapture(true)} data-testid="button-add-first-lead">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Lead
                </Button>
              </div>
            ) : (
              <Table data-testid="leads-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => {
                    const statusConfig = getStatusConfig(lead.status);
                    return (
                      <TableRow key={lead.id} data-testid={`lead-row-${lead.id}`}>
                        <TableCell className="font-medium" data-testid={`lead-name-${lead.id}`}>
                          {lead.firstName} {lead.lastName}
                        </TableCell>
                        <TableCell data-testid={`lead-event-${lead.id}`}>
                          <div>
                            {lead.eventType || '-'}
                            {lead.projectDate && (
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(lead.projectDate), 'dd MMM yyyy')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`lead-email-${lead.id}`}>
                          {lead.email}
                        </TableCell>
                        <TableCell data-testid={`lead-source-${lead.id}`}>
                          {lead.referralSource || lead.leadSource || '-'}
                        </TableCell>
                        <TableCell data-testid={`lead-budget-${lead.id}`}>
                          {lead.budgetRange
                            ? `${lead.currency || '£'}${lead.budgetRange}`
                            : lead.estimatedValue
                              ? `${lead.currency || '£'}${parseFloat(lead.estimatedValue).toLocaleString()}`
                              : '-'}
                        </TableCell>
                        <TableCell data-testid={`lead-status-${lead.id}`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-1 cursor-pointer">
                                <Badge className={statusConfig.color}>
                                  {statusConfig.label}
                                </Badge>
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {LEAD_STATUSES.map((s) => (
                                <DropdownMenuItem
                                  key={s.value}
                                  onClick={() => handleStatusChange(lead.id, s.value)}
                                  disabled={s.value === lead.status}
                                >
                                  <Badge className={`${s.color} mr-2`} variant="outline">
                                    {s.label}
                                  </Badge>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {lead.status === 'hold' && lead.holdExpiresAt && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Expires {formatDistanceToNow(new Date(lead.holdExpiresAt), { addSuffix: true })}
                            </div>
                          )}
                          {lead.status === 'lost' && lead.lostReason && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {LOST_REASONS.find(r => r.value === lead.lostReason)?.label || lead.lostReason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell data-testid={`lead-created-${lead.id}`}>
                          {formatDistanceToNow(new Date(lead.createdAt!), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" data-testid={`edit-lead-${lead.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`delete-lead-${lead.id}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Lead</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{lead.firstName} {lead.lastName}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(lead.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                    data-testid={`confirm-delete-lead-${lead.id}`}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Lost Reason Dialog */}
      <Dialog open={showLostReasonDialog} onOpenChange={setShowLostReasonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why was this lead lost?</DialogTitle>
            <DialogDescription>
              Select a reason to help track your conversion patterns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lostReason === 'other' && (
              <div className="space-y-2">
                <Label>Details</Label>
                <Textarea
                  placeholder="Tell us more..."
                  value={lostReasonNotes}
                  onChange={(e) => setLostReasonNotes(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLostReasonDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmLostReason} disabled={!lostReason}>
              Mark as Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold/Pencilled Dialog */}
      <Dialog open={showHoldDialog} onOpenChange={setShowHoldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold / Pencil this lead</DialogTitle>
            <DialogDescription>
              Set how long to hold this date. The lead will be flagged when the hold expires.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Hold for</Label>
              <Select value={holdExpiryDays} onValueChange={setHoldExpiryDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="21">21 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Expires {format(addDays(new Date(), parseInt(holdExpiryDays) || 14), 'dd MMM yyyy')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHoldDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmHold}>
              Pencil In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadCaptureModal
        isOpen={showLeadCapture}
        onClose={() => setShowLeadCapture(false)}
      />
    </>
  );
}
