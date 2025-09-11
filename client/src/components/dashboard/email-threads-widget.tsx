import { useQuery } from '@tanstack/react-query';
import { Mail, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocation } from 'wouter';
import { useState } from 'react';
import ProjectDetailModal from '@/components/modals/project-detail-modal';
import type { Project } from '@shared/schema';

interface EmailThread {
  threadId: string;
  latest: {
    id: string;
    from: string;
    to: string;
    subject: string;
    dateISO: string;
    snippet: string;
  };
  count: number;
}

export default function EmailThreadsWidget() {
  const [, setLocation] = useLocation();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const { data: threadsResponse, isLoading, error } = useQuery({
    queryKey: ['/api/email/threads'],
    queryFn: async () => {
      const response = await fetch('/api/email/threads?limit=10', {
        headers: {
          'user-id': 'test-user' // TODO: Get from actual auth context
        }
      });
      return response.json();
    },
  });

  // Function to find project by contact email and open modal
  const findProjectByEmail = async (email: string) => {
    try {
      // Extract email from "Name <email@domain.com>" format
      const emailMatch = email.match(/<(.+)>/);
      const cleanEmail = emailMatch ? emailMatch[1] : email;
      
      const response = await fetch(`/api/contacts?email=${encodeURIComponent(cleanEmail)}`, {
        headers: {
          'user-id': 'test-user'
        }
      });
      const contacts = await response.json();
      
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        let projectId = contact.projectId;
        
        // If no direct project, look for projects with this contact
        if (!projectId) {
          const projectsResponse = await fetch(`/api/projects?contactId=${contact.id}`, {
            headers: {
              'user-id': 'test-user'
            }
          });
          const projects = await projectsResponse.json();
          if (projects && projects.length > 0) {
            projectId = projects[0].id;
          }
        }
        
        // Fetch the full project data and open modal
        if (projectId) {
          const projectResponse = await fetch(`/api/projects/${projectId}`, {
            headers: {
              'user-id': 'test-user'
            }
          });
          const project = await projectResponse.json();
          setSelectedProject(project);
          setShowDetailModal(true);
        }
      }
    } catch (error) {
      console.error('Error finding project:', error);
    }
  };

  const handleEmailClick = (threadId: string) => {
    setLocation(`/email?thread=${threadId}`);
  };

  const handleContactClick = (fromEmail: string) => {
    findProjectByEmail(fromEmail);
  };

  const formatDate = (dateISO: string) => {
    return new Date(dateISO).toLocaleDateString('en-GB');
  };

  const threads = threadsResponse?.threads || [];
  const needsReconnect = error || threadsResponse?.error?.includes?.('insufficientPermissions');

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedProject(null);
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Recent Email Threads
        </CardTitle>
      </CardHeader>
      <CardContent>
        {needsReconnect && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Gmail access is required to view email threads. 
              <Button 
                variant="link" 
                className="px-2" 
                onClick={() => window.location.href = '/auth/google'}
                data-testid="button-reconnect-google-dashboard"
              >
                Reconnect Google
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading email threads...
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No email threads found</p>
            <p className="text-sm">Connect Gmail to see recent email conversations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread: EmailThread) => (
              <div 
                key={thread.threadId}
                className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                data-testid={`thread-${thread.threadId}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span 
                        className="text-sm font-medium truncate hover:text-primary cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContactClick(thread.latest.from);
                        }}
                        data-testid={`contact-${thread.threadId}`}
                      >
                        {thread.latest.from}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(thread.latest.dateISO)}
                      </span>
                    </div>
                    <div 
                      className="group cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5 -mx-1 transition-colors"
                      onClick={() => handleEmailClick(thread.threadId)}
                      data-testid={`email-content-${thread.threadId}`}
                    >
                      <p className="text-sm font-medium mb-1 truncate group-hover:text-primary transition-colors">
                        {thread.latest.subject}
                      </p>
                      <p className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                        {thread.latest.snippet}
                      </p>
                    </div>
                  </div>
                  {thread.count > 1 && (
                    <span className="text-xs bg-muted px-2 py-1 rounded-full ml-2 flex-shrink-0">
                      {thread.count}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    {/* Project Detail Modal */}
    <ProjectDetailModal
      project={selectedProject}
      isOpen={showDetailModal}
      onClose={handleCloseDetailModal}
    />
    </>
  );
}