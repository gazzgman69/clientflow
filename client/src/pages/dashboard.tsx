import Header from "@/components/layout/header";
import MetricsCards from "@/components/dashboard/metrics-cards";
import RecentLeads from "@/components/dashboard/recent-leads";
import RecentActivity from "@/components/dashboard/recent-activity";
import QuickActions from "@/components/dashboard/quick-actions";
import MiniCalendar from "@/components/dashboard/mini-calendar";
import TodayTasks from "@/components/dashboard/today-tasks";
import EmailSummary from "@/components/dashboard/email-summary";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Project } from "@shared/schema";

export default function Dashboard() {
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const activeProjects = projects?.filter(p => p.status === 'active').slice(0, 3) || [];

  const getProjectImage = (index: number) => {
    const images = [
      "https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80",
      "https://images.unsplash.com/photo-1497366412874-3415097a27e7?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80"
    ];
    return images[index % images.length];
  };

  // Mock projects for demonstration
  const mockProjects = [
    {
      id: "1",
      name: "Website Redesign",
      clientId: "1",
      status: "active",
      progress: 65,
      client: "Tech Solutions Inc."
    },
    {
      id: "2", 
      name: "Brand Identity",
      clientId: "2",
      status: "active", 
      progress: 85,
      client: "Creative Agency"
    },
    {
      id: "3",
      name: "Mobile App Development",
      clientId: "3", 
      status: "active",
      progress: 25,
      client: "Marketing Pro"
    }
  ];

  const displayProjects = activeProjects.length > 0 ? activeProjects : mockProjects;

  return (
    <>
      <Header 
        title="Dashboard" 
        subtitle="Welcome back, John. Here's what's happening with your business today."
      />
      
      <main className="flex-1 overflow-auto p-6">
        <MetricsCards />
        
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Recent Activity & Tasks */}
          <div className="lg:col-span-2 space-y-6">
            <RecentLeads />
            <RecentActivity />
            
            {/* Active Projects */}
            <Card data-testid="active-projects-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Active Projects</h3>
                  <Button variant="ghost" size="sm" data-testid="button-view-all-projects">
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {projectsLoading ? (
                  <div className="animate-pulse space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-muted-foreground/20 rounded-lg"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-muted-foreground/20 rounded w-32"></div>
                            <div className="h-3 bg-muted-foreground/20 rounded w-24"></div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="w-24 h-2 bg-muted-foreground/20 rounded-full"></div>
                          <div className="h-3 bg-muted-foreground/20 rounded w-16"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayProjects.map((project, index) => (
                      <div 
                        key={project.id} 
                        className="flex items-center justify-between p-4 bg-muted rounded-lg"
                        data-testid={`project-item-${project.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <img 
                            src={getProjectImage(index)} 
                            alt="Project thumbnail" 
                            className="w-12 h-12 rounded-lg object-cover"
                            data-testid={`project-image-${project.id}`}
                          />
                          <div>
                            <p className="font-medium text-foreground" data-testid={`project-name-${project.id}`}>
                              {project.name}
                            </p>
                            <p className="text-sm text-muted-foreground" data-testid={`project-client-${project.id}`}>
                              {'client' in project ? project.client : 'Unknown Client'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="w-24 bg-secondary rounded-full h-2 mb-2">
                            <div 
                              className="progress-bar h-2 rounded-full" 
                              style={{ width: `${project.progress || 0}%` }}
                              data-testid={`project-progress-bar-${project.id}`}
                            ></div>
                          </div>
                          <p className="text-xs text-muted-foreground" data-testid={`project-progress-text-${project.id}`}>
                            {project.progress || 0}% complete
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <QuickActions />
          </div>

          {/* Right Column - Calendar & Tasks */}
          <div className="space-y-6">
            <MiniCalendar />
            <TodayTasks />
            <EmailSummary />
          </div>
        </div>
      </main>
    </>
  );
}
