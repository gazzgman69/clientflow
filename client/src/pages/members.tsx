import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Phone, Mail, Music, DollarSign, Star, Edit, Trash, Users, ListMusic } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Member, MemberGroup } from "@shared/schema";

const memberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  primaryInstrument: z.string().optional(),
  instruments: z.string().optional(),
  hourlyRate: z.string().optional(),
  feeNotes: z.string().optional(),
  taxNumber: z.string().optional(),
  paymentDetails: z.string().optional(),
  callOrder: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  preferredStatus: z.boolean().default(false),
  isActive: z.boolean().default(true),
  portalAccess: z.boolean().default(false),
  portalEmail: z.string().optional(),
  notes: z.string().optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;

const groupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
  colour: z.string().optional(),
});

type GroupFormData = z.infer<typeof groupSchema>;

function MemberTable({ members, onEdit, onDelete }: { members: Member[]; onEdit: (m: Member) => void; onDelete: (id: string) => void }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Role / Instruments</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Call #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.firstName} {member.lastName}</TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {member.email && <div className="flex items-center gap-1 text-sm"><Mail className="h-3 w-3" />{member.email}</div>}
                    {member.phone && <div className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{member.phone}</div>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {(member as any).primaryInstrument && <div className="text-sm font-medium">{(member as any).primaryInstrument}</div>}
                    {member.instruments && member.instruments.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {member.instruments.map((i, idx) => <Badge key={idx} variant="secondary" className="text-xs">{i}</Badge>)}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {member.hourlyRate && <div className="flex items-center gap-1 text-sm"><DollarSign className="h-3 w-3" />£{member.hourlyRate}</div>}
                </TableCell>
                <TableCell>
                  {(member as any).callOrder && <Badge variant="outline">#{(member as any).callOrder}</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {member.preferredStatus && <Badge className="flex items-center gap-1 w-fit"><Star className="h-3 w-3" />Preferred</Badge>}
                    {(member as any).portalAccess && <Badge variant="outline" className="text-xs">Portal</Badge>}
                    {(member as any).isActive === false && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(member)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(member.id)}><Trash className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function MembersPage() {
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<MemberGroup | null>(null);
  const { toast } = useToast();

  const { data: members = [], isLoading } = useQuery<Member[]>({ queryKey: ["/api/members"] });
  const { data: groups = [] } = useQuery<MemberGroup[]>({ queryKey: ["/api/member-groups"] });

  const memberForm = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", phone: "", primaryInstrument: "",
      instruments: "", hourlyRate: "", feeNotes: "", taxNumber: "", paymentDetails: "",
      callOrder: "", address: "", city: "", state: "", zipCode: "",
      preferredStatus: false, isActive: true, portalAccess: false, portalEmail: "", notes: "",
    },
  });

  const groupForm = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", description: "", colour: "#6366f1" },
  });

  const buildMemberPayload = (data: MemberFormData) => ({
    ...data,
    instruments: data.instruments ? data.instruments.split(",").map(i => i.trim()).filter(Boolean) : [],
    hourlyRate: data.hourlyRate || undefined,
    callOrder: data.callOrder ? parseInt(data.callOrder) : undefined,
  });

  const createMemberMutation = useMutation({
    mutationFn: (data: MemberFormData) => apiRequest("POST", "/api/members", buildMemberPayload(data)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/members"] }); setIsMemberDialogOpen(false); memberForm.reset(); toast({ title: "Member added" }); },
    onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MemberFormData }) => apiRequest("PATCH", `/api/members/${id}`, buildMemberPayload(data)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/members"] }); setIsMemberDialogOpen(false); setSelectedMember(null); memberForm.reset(); toast({ title: "Member updated" }); },
    onError: () => toast({ title: "Failed to update member", variant: "destructive" }),
  });

  const deleteMemberMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/members/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/members"] }); toast({ title: "Member deleted" }); },
    onError: () => toast({ title: "Failed to delete member", variant: "destructive" }),
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: GroupFormData) => apiRequest("POST", "/api/member-groups", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/member-groups"] }); setIsGroupDialogOpen(false); groupForm.reset(); toast({ title: "Group created" }); },
    onError: () => toast({ title: "Failed to create group", variant: "destructive" }),
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GroupFormData }) => apiRequest("PATCH", `/api/member-groups/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/member-groups"] }); setIsGroupDialogOpen(false); setSelectedGroup(null); groupForm.reset(); toast({ title: "Group updated" }); },
    onError: () => toast({ title: "Failed to update group", variant: "destructive" }),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/member-groups/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/member-groups"] }); toast({ title: "Group deleted" }); },
    onError: () => toast({ title: "Failed to delete group", variant: "destructive" }),
  });

  const handleEditMember = (member: Member) => {
    setSelectedMember(member);
    memberForm.reset({
      firstName: member.firstName, lastName: member.lastName, email: member.email,
      phone: member.phone || "", primaryInstrument: (member as any).primaryInstrument || "",
      instruments: member.instruments?.join(", ") || "", hourlyRate: member.hourlyRate || "",
      feeNotes: (member as any).feeNotes || "", taxNumber: (member as any).taxNumber || "",
      paymentDetails: (member as any).paymentDetails || "",
      callOrder: (member as any).callOrder?.toString() || "",
      address: member.address || "", city: member.city || "",
      state: member.state || "", zipCode: member.zipCode || "",
      preferredStatus: member.preferredStatus || false,
      isActive: (member as any).isActive ?? true,
      portalAccess: (member as any).portalAccess || false,
      portalEmail: (member as any).portalEmail || "", notes: member.notes || "",
    });
    setIsMemberDialogOpen(true);
  };

  const handleEditGroup = (group: MemberGroup) => {
    setSelectedGroup(group);
    groupForm.reset({ name: group.name, description: group.description || "", colour: (group as any).colour || "#6366f1" });
    setIsGroupDialogOpen(true);
  };

  const closeMemberDialog = () => { setIsMemberDialogOpen(false); setSelectedMember(null); memberForm.reset(); };
  const closeGroupDialog = () => { setIsGroupDialogOpen(false); setSelectedGroup(null); groupForm.reset(); };

  const activeMembers = members.filter(m => (m as any).isActive !== false);
  const inactiveMembers = members.filter(m => (m as any).isActive === false);

  if (isLoading) return <div className="container mx-auto py-8">Loading...</div>;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground mt-1">Manage your musicians, band members and groups</p>
        </div>
        <div className="flex gap-2">
          <Link href="/repertoire">
            <Button variant="outline"><ListMusic className="mr-2 h-4 w-4" />Repertoire</Button>
          </Link>

          {/* Group dialog */}
          <Dialog open={isGroupDialogOpen} onOpenChange={(o) => { if (!o) closeGroupDialog(); else setIsGroupDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Users className="mr-2 h-4 w-4" />New Group</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedGroup ? "Edit Group" : "New Group"}</DialogTitle>
                <DialogDescription>Bundle musicians together for quick booking and messaging.</DialogDescription>
              </DialogHeader>
              <Form {...groupForm}>
                <form onSubmit={groupForm.handleSubmit((d) => selectedGroup ? updateGroupMutation.mutate({ id: selectedGroup.id, data: d }) : createGroupMutation.mutate(d))} className="space-y-4">
                  <FormField control={groupForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="Full Band, String Quartet..." /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={groupForm.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={groupForm.control} name="colour" render={({ field }) => (
                    <FormItem><FormLabel>Colour</FormLabel><FormControl><div className="flex items-center gap-3"><input type="color" value={field.value} onChange={field.onChange} className="h-9 w-16 cursor-pointer rounded border" /><span className="text-sm text-muted-foreground">Used for calendar colour coding</span></div></FormControl><FormMessage /></FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeGroupDialog}>Cancel</Button>
                    <Button type="submit" disabled={createGroupMutation.isPending || updateGroupMutation.isPending}>
                      {createGroupMutation.isPending || updateGroupMutation.isPending ? "Saving..." : selectedGroup ? "Update" : "Create Group"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Member dialog */}
          <Dialog open={isMemberDialogOpen} onOpenChange={(o) => { if (!o) closeMemberDialog(); else setIsMemberDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Member</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedMember ? "Edit Member" : "Add Member"}</DialogTitle>
                <DialogDescription>{selectedMember ? "Update member information" : "Add a new musician to your roster"}</DialogDescription>
              </DialogHeader>
              <Form {...memberForm}>
                <form onSubmit={memberForm.handleSubmit((d) => selectedMember ? updateMemberMutation.mutate({ id: selectedMember.id, data: d }) : createMemberMutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={memberForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={memberForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={memberForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={memberForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={memberForm.control} name="primaryInstrument" render={({ field }) => (<FormItem><FormLabel>Primary Role</FormLabel><FormControl><Input {...field} placeholder="Vocalist, Keys, Guitar..." /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={memberForm.control} name="instruments" render={({ field }) => (<FormItem><FormLabel>All Instruments</FormLabel><FormControl><Input {...field} placeholder="Guitar, Bass, Drums (comma separated)" /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={memberForm.control} name="hourlyRate" render={({ field }) => (<FormItem><FormLabel>Default Fee (£)</FormLabel><FormControl><Input {...field} type="number" step="0.01" placeholder="150.00" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={memberForm.control} name="callOrder" render={({ field }) => (<FormItem><FormLabel>Call Order</FormLabel><FormControl><Input {...field} type="number" placeholder="1 = first call" /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={memberForm.control} name="feeNotes" render={({ field }) => (<FormItem><FormLabel>Fee Notes</FormLabel><FormControl><Input {...field} placeholder="e.g. Flat rate only, no % deals" /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={memberForm.control} name="taxNumber" render={({ field }) => (<FormItem><FormLabel>UTR / Tax Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={memberForm.control} name="paymentDetails" render={({ field }) => (<FormItem><FormLabel>Payment Details</FormLabel><FormControl><Input {...field} placeholder="Bank / PayPal details" /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={memberForm.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={memberForm.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium">Status &amp; Access</p>
                    <FormField control={memberForm.control} name="preferredStatus" render={({ field }) => (
                      <FormItem className="flex items-center justify-between"><div><FormLabel>Preferred</FormLabel><p className="text-xs text-muted-foreground">First pick for gig offers</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <FormField control={memberForm.control} name="isActive" render={({ field }) => (
                      <FormItem className="flex items-center justify-between"><div><FormLabel>Active</FormLabel><p className="text-xs text-muted-foreground">Inactive members won't appear in booking lists</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <FormField control={memberForm.control} name="portalAccess" render={({ field }) => (
                      <FormItem className="flex items-center justify-between"><div><FormLabel>Portal Access</FormLabel><p className="text-xs text-muted-foreground">Can log into the musician portal</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    {memberForm.watch("portalAccess") && (
                      <FormField control={memberForm.control} name="portalEmail" render={({ field }) => (<FormItem><FormLabel>Portal Login Email</FormLabel><FormControl><Input {...field} type="email" placeholder="If different from contact email" /></FormControl><FormMessage /></FormItem>)} />
                    )}
                  </div>

                  <FormField control={memberForm.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeMemberDialog}>Cancel</Button>
                    <Button type="submit" disabled={createMemberMutation.isPending || updateMemberMutation.isPending}>
                      {createMemberMutation.isPending || updateMemberMutation.isPending ? "Saving..." : selectedMember ? "Update Member" : "Add Member"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Musicians ({activeMembers.length})</TabsTrigger>
          <TabsTrigger value="groups">Groups ({groups.length})</TabsTrigger>
          {inactiveMembers.length > 0 && <TabsTrigger value="inactive">Inactive ({inactiveMembers.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="members">
          {activeMembers.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-12">
              <Music className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No members yet</h3>
              <p className="text-muted-foreground text-center mb-4">Add your first musician to get started</p>
              <Button onClick={() => setIsMemberDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Add First Member</Button>
            </CardContent></Card>
          ) : (
            <MemberTable members={activeMembers} onEdit={handleEditMember} onDelete={(id) => deleteMemberMutation.mutate(id)} />
          )}
        </TabsContent>

        <TabsContent value="groups">
          {groups.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
              <p className="text-muted-foreground text-center mb-4">Create a group to bundle musicians for quick booking</p>
              <Button onClick={() => setIsGroupDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Create First Group</Button>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <Card key={group.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {(group as any).colour && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: (group as any).colour }} />}
                        <CardTitle className="text-base">{group.name}</CardTitle>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditGroup(group)}><Edit className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteGroupMutation.mutate(group.id)}><Trash className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    {group.description && <CardDescription className="text-xs mt-1">{group.description}</CardDescription>}
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {inactiveMembers.length > 0 && (
          <TabsContent value="inactive">
            <MemberTable members={inactiveMembers} onEdit={handleEditMember} onDelete={(id) => deleteMemberMutation.mutate(id)} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
