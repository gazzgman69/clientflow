import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, FileText, Edit, Trash, Send, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { PerformerContract, Member, Project } from "@shared/schema";

const contractSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  memberId: z.string().min(1, "Musician is required"),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Contract content is required"),
  fee: z.string().optional(),
  callTime: z.string().optional(),
  dresscode: z.string().optional(),
  specialInstructions: z.string().optional(),
  status: z.string().default("draft"),
});

type ContractFormData = z.infer<typeof contractSchema>;

const STATUS_COLOURS: Record<string, string> = {
  draft: "secondary",
  sent: "outline",
  signed: "default",
  cancelled: "destructive",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clock className="h-3 w-3" />,
  sent: <Send className="h-3 w-3" />,
  signed: <CheckCircle className="h-3 w-3" />,
};

export default function PerformerContractsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<PerformerContract | null>(null);
  const { toast } = useToast();

  const { data: contracts = [], isLoading } = useQuery<PerformerContract[]>({ queryKey: ["/api/performer-contracts"] });
  const { data: members = [] } = useQuery<Member[]>({ queryKey: ["/api/members"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: { projectId: "", memberId: "", title: "", content: "", fee: "", callTime: "", dresscode: "", specialInstructions: "", status: "draft" },
  });

  const createMutation = useMutation({
    mutationFn: (data: ContractFormData) => apiRequest("/api/performer-contracts", "POST", {
      ...data,
      fee: data.fee || undefined,
      callTime: data.callTime ? new Date(data.callTime).toISOString() : undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/performer-contracts"] }); setIsDialogOpen(false); form.reset(); toast({ title: "Contract created" }); },
    onError: () => toast({ title: "Failed to create contract", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContractFormData> }) => apiRequest(`/api/performer-contracts/${id}`, "PATCH", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/performer-contracts"] }); setIsDialogOpen(false); setSelectedContract(null); form.reset(); toast({ title: "Contract updated" }); },
    onError: () => toast({ title: "Failed to update contract", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/performer-contracts/${id}`, "DELETE"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/performer-contracts"] }); toast({ title: "Contract deleted" }); },
    onError: () => toast({ title: "Failed to delete contract", variant: "destructive" }),
  });

  const handleEdit = (contract: PerformerContract) => {
    setSelectedContract(contract);
    form.reset({
      projectId: contract.projectId,
      memberId: contract.memberId,
      title: contract.title,
      content: contract.content,
      fee: contract.fee || "",
      callTime: contract.callTime ? format(new Date(contract.callTime), "yyyy-MM-dd'T'HH:mm") : "",
      dresscode: contract.dresscode || "",
      specialInstructions: contract.specialInstructions || "",
      status: contract.status || "draft",
    });
    setIsDialogOpen(true);
  };

  const markAsSent = (id: string) => updateMutation.mutate({ id, data: { status: "sent" } as any });

  const closeDialog = () => { setIsDialogOpen(false); setSelectedContract(null); form.reset(); };

  const getMemberName = (id: string) => { const m = members.find(m => m.id === id); return m ? `${m.firstName} ${m.lastName}` : id; };
  const getProjectName = (id: string) => { const p = projects.find(p => p.id === id); return p ? (p as any).title || (p as any).name || id : id; };

  if (isLoading) return <div className="container mx-auto py-8">Loading...</div>;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performer Contracts</h1>
          <p className="text-muted-foreground mt-1">Per-gig contracts sent to musicians</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Contract</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedContract ? "Edit Contract" : "New Performer Contract"}</DialogTitle>
              <DialogDescription>Create a contract to send to a musician for a specific gig.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => selectedContract ? updateMutation.mutate({ id: selectedContract.id, data: d as any }) : createMutation.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="projectId" render={({ field }) => (
                    <FormItem><FormLabel>Project / Gig</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger></FormControl>
                        <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{getProjectName(p.id)}</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="memberId" render={({ field }) => (
                    <FormItem><FormLabel>Musician</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select musician..." /></SelectTrigger></FormControl>
                        <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Contract Title</FormLabel><FormControl><Input {...field} placeholder="e.g. Performance Agreement – Wedding 14 June" /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="fee" render={({ field }) => (<FormItem><FormLabel>Fee (£)</FormLabel><FormControl><Input {...field} type="number" step="0.01" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="callTime" render={({ field }) => (<FormItem><FormLabel>Call Time</FormLabel><FormControl><Input {...field} type="datetime-local" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="dresscode" render={({ field }) => (<FormItem><FormLabel>Dress Code</FormLabel><FormControl><Input {...field} placeholder="Black tie, smart casual..." /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="specialInstructions" render={({ field }) => (<FormItem><FormLabel>Special Instructions</FormLabel><FormControl><Textarea {...field} rows={2} placeholder="Parking, load-in details, dietary..." /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="content" render={({ field }) => (<FormItem><FormLabel>Contract Content</FormLabel><FormControl><Textarea {...field} rows={8} placeholder="Full contract terms..." /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="signed">Signed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : selectedContract ? "Update Contract" : "Create Contract"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {contracts.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No performer contracts yet</h3>
          <p className="text-muted-foreground text-center mb-4">Create contracts to send to musicians for each gig</p>
          <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Create First Contract</Button>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Musician</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Call Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.title}</TableCell>
                    <TableCell>{getMemberName(contract.memberId)}</TableCell>
                    <TableCell className="text-muted-foreground">{getProjectName(contract.projectId)}</TableCell>
                    <TableCell>{contract.fee && `£${contract.fee}`}</TableCell>
                    <TableCell>{contract.callTime && format(new Date(contract.callTime), "d MMM HH:mm")}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLOURS[contract.status || "draft"] as any} className="flex items-center gap-1 w-fit">
                        {STATUS_ICONS[contract.status || "draft"]}
                        {contract.status || "draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {contract.status === "draft" && (
                          <Button variant="outline" size="sm" onClick={() => markAsSent(contract.id)}>
                            <Send className="h-3 w-3 mr-1" />Send
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(contract)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(contract.id)}><Trash className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
