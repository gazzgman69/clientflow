import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Link } from "wouter";
import { useEffect } from "react";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Mail, Phone, Calendar, Briefcase } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Project, Client } from "@shared/schema";

export default function ProjectDetail() {
  const [match, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const projectId = params?.id;

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
        </div>
      </main>
    </>
  );
}