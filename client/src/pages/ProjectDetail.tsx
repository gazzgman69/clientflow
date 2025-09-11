import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Mail, Phone, Calendar, Briefcase, MessageSquare, ExternalLink, Shield, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUserPrefs } from "@/hooks/useUserPrefs";
import type { Project, Client } from "@shared/schema";
import ProjectEmailPanel from "@/components/email/ProjectEmailPanel";

export default function ProjectDetail() {
  const [match, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const projectId = params?.id;
  const { toast } = useToast();
  
  // Get portal status for this project (tenant setting + project override)
  const { data: portalStatus } = useQuery({
    queryKey: ['/api/projects', projectId, 'portal-status'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/portal-status`);
      return response.json();
    },
    enabled: !!projectId,
  });
  
  const tenantPortalEnabled = portalStatus?.tenantDefault ?? true;
  const effectivePortalStatus = portalStatus?.effectiveStatus ?? true;
  
  // Mutation for updating project portal override
  const updatePortalMutation = useMutation({
    mutationFn: async ({ portalEnabledOverride }: { portalEnabledOverride: boolean | null }) => {
      const response = await apiRequest('PATCH', `/api/projects/${projectId}`, {
        portalEnabledOverride
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Portal Settings Updated",
        description: "Project portal settings have been saved successfully.",
      });
      // Invalidate project data and portal status to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'portal-status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update portal settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle "new" project creation case - redirect to projects page
  useEffect(() => {
    if (projectId === "new") {
      setLocation("/projects");
    }
  }, [projectId, setLocation]);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${projectId}`);
      return response.json();
    },
    enabled: !!projectId,
  });

  const { data: client } = useQuery<Client>({
    queryKey: ["/api/clients", project?.clientId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/clients/${project?.clientId}`);
      return response.json();
    },
    enabled: !!project?.clientId,
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <>
        <Header title="Project Details" subtitle="Loading..." />
        <main className="flex-1 overflow-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-24 bg-muted rounded"></div>
          </div>
        </main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Header title="Project Not Found" subtitle="The requested project could not be found" />
        <main className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-4">Project with ID "{projectId}" not found.</p>
              <Button asChild>
                <Link href="/projects">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header 
        title={project.name} 
        subtitle={`Project #${project.id}`}
      />
      
      <main className="flex-1 overflow-auto p-6" data-testid="project-detail">
        <div className="space-y-6">
          {/* Back Button */}
          <div>
            <Button variant="outline" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Link>
            </Button>
          </div>

          {/* Project Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Project Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Project Overview
                    </CardTitle>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium mb-2">Project Details</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span> {project.name}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Description:</span> {project.description || 'No description'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Estimated Value:</span> 
                          {project.estimatedValue ? `£${project.estimatedValue.toLocaleString()}` : 'Not specified'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Progress:</span> {project.progress || 0}%
                        </div>
                      </div>
                      {project.progress !== null && (
                        <div className="mt-3">
                          <Progress value={project.progress || 0} className="w-full" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">Timeline</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Start Date:</span> {formatDate(project.startDate?.toString() || null)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">End Date:</span> {formatDate(project.endDate?.toString() || null)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Created:</span> {formatDate(project.createdAt?.toString() || null)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Updated:</span> {formatDate(project.updatedAt?.toString() || null)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client Information */}
              {client && (
                <Card>
                  <CardHeader>
                    <CardTitle>Client Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <span className="font-medium">{client.firstName} {client.lastName}</span>
                      </div>
                      {client.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a 
                            href={`mailto:${client.email}`} 
                            className="text-primary hover:underline"
                          >
                            {client.email}
                          </a>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a 
                            href={`tel:${client.phone}`} 
                            className="text-primary hover:underline"
                          >
                            {client.phone}
                          </a>
                        </div>
                      )}
                      {client.address && (
                        <div>
                          <span className="text-muted-foreground">Address:</span> {client.address}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Client Portal Settings */}
              <Card data-testid="project-portal-settings-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Client Portal Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Portal Status Overview */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Portal Access Status</Label>
                        <p className="text-sm text-muted-foreground">
                          Current portal access status for this project
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={
                          effectivePortalStatus
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        }
                        data-testid="portal-status-badge"
                      >
                        {effectivePortalStatus ? "Portal Enabled" : "Portal Disabled"}
                      </Badge>
                    </div>

                    <Alert data-testid="portal-status-alert">
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        {tenantPortalEnabled ? (
                          portalStatus?.projectOverride === false ? (
                            <>
                              <strong>Portal disabled for this project.</strong> While your organization has the client portal enabled, 
                              this specific project has been set to disable portal access.
                            </>
                          ) : portalStatus?.projectOverride === true ? (
                            <>
                              <strong>Portal explicitly enabled for this project.</strong> This project overrides your organization settings 
                              to ensure portal access is available.
                            </>
                          ) : (
                            <>
                              <strong>Portal enabled via organization settings.</strong> This project inherits your organization's portal settings. 
                              Clients can access their portal for this project.
                            </>
                          )
                        ) : (
                          portalStatus?.projectOverride === true ? (
                            <>
                              <strong>Portal enabled for this project only.</strong> While your organization has the client portal disabled, 
                              this specific project allows portal access.
                            </>
                          ) : (
                            <>
                              <strong>Portal disabled via organization settings.</strong> Your organization has disabled the client portal, 
                              so clients cannot access portals for any projects.
                            </>
                          )
                        )}
                      </AlertDescription>
                    </Alert>
                  </div>

                  <Separator />

                  {/* Project-specific Override Controls */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Project Override Settings</Label>
                    
                    <div className="space-y-3">
                      {/* Use Organization Default */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Use Organization Default</p>
                          <p className="text-sm text-muted-foreground">
                            Follow the organization-wide portal setting ({tenantPortalEnabled ? 'enabled' : 'disabled'})
                          </p>
                        </div>
                        <Switch 
                          checked={portalStatus?.projectOverride === null}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updatePortalMutation.mutate({ portalEnabledOverride: null });
                            }
                          }}
                          disabled={updatePortalMutation.isPending}
                          data-testid="switch-use-default"
                        />
                      </div>

                      {/* Enable for This Project */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Enable for This Project</p>
                          <p className="text-sm text-muted-foreground">
                            Force enable portal access for this specific project
                          </p>
                        </div>
                        <Switch 
                          checked={portalStatus?.projectOverride === true}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updatePortalMutation.mutate({ portalEnabledOverride: true });
                            }
                          }}
                          disabled={updatePortalMutation.isPending}
                          data-testid="switch-enable-override"
                        />
                      </div>

                      {/* Disable for This Project */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Disable for This Project</p>
                          <p className="text-sm text-muted-foreground">
                            Force disable portal access for this specific project
                          </p>
                        </div>
                        <Switch 
                          checked={portalStatus?.projectOverride === false}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updatePortalMutation.mutate({ portalEnabledOverride: false });
                            }
                          }}
                          disabled={updatePortalMutation.isPending}
                          data-testid="switch-disable-override"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Portal Link Preview */}
                  {effectivePortalStatus && (
                    <div className="space-y-3">
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Portal Link</Label>
                          <p className="text-sm text-muted-foreground">
                            Share this link with your client to access their portal
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          asChild
                          data-testid="button-open-portal"
                        >
                          <Link href={`/portal/${projectId}`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Portal
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email" className="space-y-6">
              <ProjectEmailPanel projectId={projectId!} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}