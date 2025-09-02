import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Calendar, Music, Clock, DollarSign, MapPin, 
  CheckCircle, XCircle, FileText, Users 
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { 
  Project, ProjectMember, Member, 
  MemberAvailability, ProjectFile, Client 
} from "@shared/schema";

const availabilitySchema = z.object({
  date: z.string(),
  available: z.boolean(),
  notes: z.string().optional(),
});

type AvailabilityFormData = z.infer<typeof availabilitySchema>;

export default function MusicianPortal() {
  const [selectedGig, setSelectedGig] = useState<Project | null>(null);
  const [showGigDetails, setShowGigDetails] = useState(false);
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false);
  const { toast } = useToast();

  // Mock current musician ID - in real app, this would come from auth context
  const currentMusicianId = "musician-1";

  const { data: myGigs = [], isLoading: gigsLoading } = useQuery<(Project & { assignment: ProjectMember })[]>({
    queryKey: ["/api/portal/musician/gigs"],
    // Mock data for now - in real implementation, this would be a proper API endpoint
    queryFn: async () => {
      // This would be replaced with actual API call
      const projects = await apiRequest("/api/projects", "GET");
      const members = await apiRequest("/api/projects/members", "GET");
      // Filter and combine data for current musician
      return [];
    }
  });

  const { data: myAvailability = [] } = useQuery<MemberAvailability[]>({
    queryKey: ["/api/members", currentMusicianId, "availability"],
  });

  const { data: upcomingGigs = [] } = useQuery({
    queryKey: ["/api/portal/musician/upcoming"],
    queryFn: async () => {
      // Mock upcoming gigs
      return [
        {
          id: "1",
          name: "Wedding Reception - Johnson",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          venue: "Grand Ballroom",
          fee: 300,
          status: "confirmed"
        },
        {
          id: "2", 
          name: "Corporate Event - Tech Corp",
          date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          venue: "Downtown Convention Center",
          fee: 450,
          status: "pending"
        }
      ];
    }
  });

  const { data: recentEarnings = [] } = useQuery({
    queryKey: ["/api/portal/musician/earnings"],
    queryFn: async () => {
      return {
        thisMonth: 1200,
        lastMonth: 950,
        thisYear: 8400,
        pendingPayments: 750
      };
    }
  });

  const availabilityForm = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      available: true,
      notes: "",
    },
  });

  const setAvailabilityMutation = useMutation({
    mutationFn: (data: AvailabilityFormData) =>
      apiRequest(`/api/members/${currentMusicianId}/availability`, "POST", {
        date: new Date(data.date),
        available: data.available,
        notes: data.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", currentMusicianId, "availability"] });
      setShowAvailabilityForm(false);
      availabilityForm.reset();
      toast({
        title: "Success",
        description: "Availability updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to update availability",
        variant: "destructive",
      });
    },
  });

  const respondToGigMutation = useMutation({
    mutationFn: ({ gigId, response }: { gigId: string; response: 'confirmed' | 'declined' }) =>
      apiRequest(`/api/projects/${gigId}/members/${currentMusicianId}`, "PATCH", { status: response }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/musician/gigs"] });
      toast({
        title: "Success",
        description: "Response sent successfully",
      });
    },
  });

  const handleGigResponse = (gigId: string, response: 'confirmed' | 'declined') => {
    respondToGigMutation.mutate({ gigId, response });
  };

  const handleViewGigDetails = (gig: Project) => {
    setSelectedGig(gig);
    setShowGigDetails(true);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Musician Portal</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back! Here's your gig schedule and updates.
        </p>
      </div>

      {/* Dashboard Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Upcoming Gigs</p>
                <p className="text-2xl font-bold" data-testid="text-upcoming-gigs-count">
                  {upcomingGigs.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">This Month</p>
                <p className="text-2xl font-bold" data-testid="text-month-earnings">
                  ${recentEarnings.thisMonth}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold" data-testid="text-pending-payments">
                  ${recentEarnings.pendingPayments}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Music className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Year Total</p>
                <p className="text-2xl font-bold" data-testid="text-year-earnings">
                  ${recentEarnings.thisYear}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="gigs" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="gigs">My Gigs</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
        </TabsList>

        {/* Gigs Tab */}
        <TabsContent value="gigs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Gigs
              </CardTitle>
              <CardDescription>
                Gigs you've been assigned to and their current status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingGigs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingGigs.map((gig: any) => (
                      <TableRow key={gig.id}>
                        <TableCell className="font-medium" data-testid={`text-gig-name-${gig.id}`}>
                          {gig.name}
                        </TableCell>
                        <TableCell>
                          {new Date(gig.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {gig.venue}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {gig.fee}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={gig.status === 'confirmed' ? 'default' : 'secondary'}
                            data-testid={`badge-status-${gig.id}`}
                          >
                            {gig.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {gig.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleGigResponse(gig.id, 'confirmed')}
                                  data-testid={`button-accept-${gig.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGigResponse(gig.id, 'declined')}
                                  data-testid={`button-decline-${gig.id}`}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Decline
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewGigDetails(gig)}
                              data-testid={`button-details-${gig.id}`}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No upcoming gigs</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    My Availability
                  </CardTitle>
                  <CardDescription>
                    Set your availability for upcoming dates
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowAvailabilityForm(true)}
                  data-testid="button-set-availability"
                >
                  Set Availability
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {myAvailability.length > 0 ? (
                <div className="space-y-4">
                  {myAvailability.map((availability) => (
                    <div
                      key={availability.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(availability.date).toLocaleDateString()}
                        </p>
                        {availability.notes && (
                          <p className="text-sm text-muted-foreground">
                            {availability.notes}
                          </p>
                        )}
                      </div>
                      <Badge 
                        variant={availability.available ? 'default' : 'destructive'}
                        data-testid={`badge-available-${availability.id}`}
                      >
                        {availability.available ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No availability set</p>
                  <Button onClick={() => setShowAvailabilityForm(true)}>
                    Set Your Availability
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Earnings Summary
              </CardTitle>
              <CardDescription>
                Track your earnings and payment history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">This Month</h3>
                    <p className="text-2xl font-bold text-green-600">
                      ${recentEarnings.thisMonth}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Last Month</h3>
                    <p className="text-2xl font-bold">
                      ${recentEarnings.lastMonth}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Year to Date</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      ${recentEarnings.thisYear}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Pending Payments</h3>
                    <p className="text-2xl font-bold text-orange-600">
                      ${recentEarnings.pendingPayments}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Availability Form Modal */}
      <Dialog open={showAvailabilityForm} onOpenChange={setShowAvailabilityForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Availability</DialogTitle>
          </DialogHeader>
          <form 
            onSubmit={availabilityForm.handleSubmit((data) => setAvailabilityMutation.mutate(data))}
            className="space-y-4"
          >
            <div>
              <Label>Date</Label>
              <input
                type="date"
                className="w-full mt-1 px-3 py-2 border rounded-md"
                {...availabilityForm.register("date")}
                data-testid="input-availability-date"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                {...availabilityForm.register("available")}
                data-testid="checkbox-available"
              />
              <Label>Available</Label>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any special notes..."
                {...availabilityForm.register("notes")}
                data-testid="textarea-availability-notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAvailabilityForm(false)}
                data-testid="button-cancel-availability"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={setAvailabilityMutation.isPending}
                data-testid="button-save-availability"
              >
                {setAvailabilityMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Gig Details Modal - simplified for now */}
      <Dialog open={showGigDetails} onOpenChange={setShowGigDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedGig?.name}</DialogTitle>
          </DialogHeader>
          {selectedGig && (
            <div className="space-y-4">
              <p className="text-muted-foreground">{selectedGig.description}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium">Status</Label>
                  <p>{selectedGig.status}</p>
                </div>
                <div>
                  <Label className="font-medium">Progress</Label>
                  <p>{selectedGig.progress}%</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}