import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Calendar, Music, Clock, DollarSign, MapPin,
  CheckCircle, XCircle, FileText, Users, Plus, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import type { Project, ProjectMember, Member, MemberAvailability, PerformerContract } from "@shared/schema";

type GigWithAssignment = Project & { assignment: ProjectMember };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  pending: "secondary",
  declined: "destructive",
};

const PAYMENT_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  paid: "default",
  invoiced: "secondary",
  unpaid: "outline",
};

export default function MusicianPortal() {
  const [selectedGig, setSelectedGig] = useState<GigWithAssignment | null>(null);
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false);
  const [availDate, setAvailDate] = useState(new Date().toISOString().split("T")[0]);
  const [availType, setAvailType] = useState("available");
  const [availNotes, setAvailNotes] = useState("");
  const { toast } = useToast();

  // Fetch current user's member profile to get memberId
  const { data: currentMember, isLoading: memberLoading } = useQuery<Member>({
    queryKey: ["/api/members/me"],
    queryFn: async () => {
      // Get all members and find the one matching logged in user
      const res = await apiRequest("/api/members", "GET");
      const data = await res.json();
      // For portal context, return the first active member — in full implementation
      // this would be scoped to the authenticated musician's own record
      return Array.isArray(data) ? data[0] : data;
    },
    retry: false,
  });

  const memberId = currentMember?.id;

  const { data: myGigs = [], isLoading: gigsLoading } = useQuery<GigWithAssignment[]>({
    queryKey: ["/api/portal/musician/gigs", memberId],
    queryFn: async () => {
      const res = await apiRequest(`/api/portal/musician/gigs?memberId=${memberId}`, "GET");
      return res.json();
    },
    enabled: !!memberId,
  });

  const { data: myContracts = [] } = useQuery<PerformerContract[]>({
    queryKey: ["/api/portal/musician/contracts", memberId],
    queryFn: async () => {
      const res = await apiRequest(`/api/portal/musician/contracts?memberId=${memberId}`, "GET");
      return res.json();
    },
    enabled: !!memberId,
  });

  const { data: myAvailability = [] } = useQuery<MemberAvailability[]>({
    queryKey: ["/api/portal/musician/availability", memberId],
    queryFn: async () => {
      const res = await apiRequest(`/api/portal/musician/availability?memberId=${memberId}`, "GET");
      return res.json();
    },
    enabled: !!memberId,
  });

  const respondMutation = useMutation({
    mutationFn: ({ projectId, status }: { projectId: string; status: string }) =>
      apiRequest(`/api/portal/musician/gigs/${projectId}/respond`, "PATCH", { memberId, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/musician/gigs", memberId] });
      setSelectedGig(null);
      toast({ title: "Response sent" });
    },
    onError: () => toast({ title: "Failed to respond", variant: "destructive" }),
  });

  const setAvailabilityMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/portal/musician/availability", "POST", {
        memberId,
        date: availDate,
        availabilityType: availType,
        notes: availNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/musician/availability", memberId] });
      setShowAvailabilityForm(false);
      setAvailNotes("");
      toast({ title: "Availability updated" });
    },
    onError: () => toast({ title: "Failed to update availability", variant: "destructive" }),
  });

  const upcomingGigs = myGigs.filter(g => {
    const date = (g as any).eventDate || (g as any).date || (g as any).startDate;
    return date && new Date(date) >= new Date();
  });

  const pendingOffers = myGigs.filter(g => g.assignment.status === "pending");
  const confirmedGigs = myGigs.filter(g => g.assignment.status === "confirmed");

  const totalEarned = myGigs
    .filter(g => (g.assignment as any).paymentStatus === "paid" && g.assignment.fee)
    .reduce((sum, g) => sum + parseFloat(g.assignment.fee || "0"), 0);

  const pendingPayment = myGigs
    .filter(g => (g.assignment as any).paymentStatus !== "paid" && g.assignment.status === "confirmed" && g.assignment.fee)
    .reduce((sum, g) => sum + parseFloat(g.assignment.fee || "0"), 0);

  const getGigTitle = (gig: GigWithAssignment) =>
    (gig as any).title || (gig as any).name || `Project ${gig.id.slice(0, 8)}`;

  const getGigDate = (gig: GigWithAssignment) => {
    const d = (gig as any).eventDate || (gig as any).date || (gig as any).startDate;
    return d ? format(new Date(d), "d MMM yyyy") : "TBC";
  };

  if (memberLoading) return (
    <div className="container mx-auto py-12 flex items-center justify-center">
      <p className="text-muted-foreground">Loading your portal...</p>
    </div>
  );

  if (!currentMember) return (
    <div className="container mx-auto py-12">
      <Card><CardContent className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No musician profile found</h3>
        <p className="text-muted-foreground text-center">Ask your agency to set up your musician profile and portal access.</p>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Hey, {currentMember.firstName} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Your musician portal — gigs, availability and contracts</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{upcomingGigs.length}</p>
                <p className="text-sm text-muted-foreground">Upcoming gigs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{pendingOffers.length}</p>
                <p className="text-sm text-muted-foreground">Pending offers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">£{totalEarned.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Total earned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">£{pendingPayment.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Awaiting payment</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending offers banner */}
      {pendingOffers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  You have {pendingOffers.length} gig offer{pendingOffers.length > 1 ? "s" : ""} waiting for your response
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSelectedGig(pendingOffers[0])}>
                View offer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="gigs">
        <TabsList>
          <TabsTrigger value="gigs">My Gigs ({myGigs.length})</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="contracts">Contracts ({myContracts.length})</TabsTrigger>
        </TabsList>

        {/* Gigs tab */}
        <TabsContent value="gigs">
          {gigsLoading ? (
            <p className="text-muted-foreground py-8 text-center">Loading gigs...</p>
          ) : myGigs.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-12">
              <Music className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No gigs yet</h3>
              <p className="text-muted-foreground">Your upcoming gigs will appear here once assigned.</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gig</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Offer Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myGigs.map((gig) => (
                      <TableRow key={gig.id}>
                        <TableCell className="font-medium">{getGigTitle(gig)}</TableCell>
                        <TableCell>{getGigDate(gig)}</TableCell>
                        <TableCell>{gig.assignment.role || "—"}</TableCell>
                        <TableCell>
                          {gig.assignment.fee ? `£${gig.assignment.fee}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[gig.assignment.status || "pending"]}>
                            {gig.assignment.status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={PAYMENT_VARIANT[(gig.assignment as any).paymentStatus || "unpaid"]}>
                            {(gig.assignment as any).paymentStatus || "unpaid"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedGig(gig)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Availability tab */}
        <TabsContent value="availability" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {myAvailability.length} availability record{myAvailability.length !== 1 ? "s" : ""} logged
            </p>
            <Button onClick={() => setShowAvailabilityForm(true)}>
              <Plus className="mr-2 h-4 w-4" />Log Availability
            </Button>
          </div>

          {showAvailabilityForm && (
            <Card>
              <CardHeader><CardTitle className="text-base">Log Availability</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={availDate} onChange={e => setAvailDate(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={availType} onValueChange={setAvailType}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                        <SelectItem value="tentative">Tentative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea value={availNotes} onChange={e => setAvailNotes(e.target.value)} rows={2} placeholder="Any relevant details..." className="mt-1" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowAvailabilityForm(false)}>Cancel</Button>
                  <Button onClick={() => setAvailabilityMutation.mutate()} disabled={setAvailabilityMutation.isPending}>
                    {setAvailabilityMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {myAvailability.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myAvailability.slice().sort((a, b) => new Date((b as any).date || b.createdAt!).getTime() - new Date((a as any).date || a.createdAt!).getTime()).map((av) => (
                      <TableRow key={av.id}>
                        <TableCell>{(av as any).date ? format(new Date((av as any).date), "d MMM yyyy") : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={(av as any).availabilityType === "available" ? "default" : (av as any).availabilityType === "unavailable" ? "destructive" : "secondary"}>
                            {(av as any).availabilityType || (av.available ? "available" : "unavailable")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{av.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              No availability logged yet. Use the button above to let the agency know when you're free.
            </CardContent></Card>
          )}
        </TabsContent>

        {/* Contracts tab */}
        <TabsContent value="contracts">
          {myContracts.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No contracts yet</h3>
              <p className="text-muted-foreground">Your performer contracts will appear here once issued.</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Call Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myContracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">{contract.title}</TableCell>
                        <TableCell>{contract.fee ? `£${contract.fee}` : "—"}</TableCell>
                        <TableCell>{contract.callTime ? format(new Date(contract.callTime), "d MMM HH:mm") : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={contract.status === "signed" ? "default" : contract.status === "sent" ? "secondary" : "outline"}>
                            {contract.status || "draft"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Gig detail dialog */}
      <Dialog open={!!selectedGig} onOpenChange={(o) => { if (!o) setSelectedGig(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedGig && getGigTitle(selectedGig)}</DialogTitle>
          </DialogHeader>
          {selectedGig && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Date</p><p className="font-medium">{getGigDate(selectedGig)}</p></div>
                <div><p className="text-muted-foreground">Your role</p><p className="font-medium">{selectedGig.assignment.role || "—"}</p></div>
                <div><p className="text-muted-foreground">Fee</p><p className="font-medium">{selectedGig.assignment.fee ? `£${selectedGig.assignment.fee}` : "TBC"}</p></div>
                <div><p className="text-muted-foreground">Offer type</p><p className="font-medium capitalize">{(selectedGig.assignment as any).offerType || "Direct"}</p></div>
              </div>

              {selectedGig.assignment.status === "pending" && (
                <div className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/20 space-y-3">
                  <p className="text-sm font-medium">This gig offer is waiting for your response</p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => respondMutation.mutate({ projectId: selectedGig.id, status: "confirmed" })}
                      disabled={respondMutation.isPending}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />Accept
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => respondMutation.mutate({ projectId: selectedGig.id, status: "declined" })}
                      disabled={respondMutation.isPending}
                    >
                      <XCircle className="mr-2 h-4 w-4" />Decline
                    </Button>
                  </div>
                </div>
              )}

              {selectedGig.assignment.status !== "pending" && (
                <div className="flex gap-2">
                  <Badge variant={STATUS_VARIANT[selectedGig.assignment.status || "pending"]} className="text-sm">
                    {selectedGig.assignment.status}
                  </Badge>
                  <Badge variant={PAYMENT_VARIANT[(selectedGig.assignment as any).paymentStatus || "unpaid"]} className="text-sm">
                    Payment: {(selectedGig.assignment as any).paymentStatus || "unpaid"}
                  </Badge>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedGig(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
