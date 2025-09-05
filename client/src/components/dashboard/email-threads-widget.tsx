import { useQuery } from '@tanstack/react-query';
import { Mail, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

  const formatDate = (dateISO: string) => {
    return new Date(dateISO).toLocaleDateString('en-GB');
  };

  const threads = threadsResponse?.threads || [];
  const needsReconnect = error || threadsResponse?.error?.includes?.('insufficientPermissions');

  return (
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
            {threads.map((thread) => (
              <div 
                key={thread.threadId}
                className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                data-testid={`thread-${thread.threadId}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">
                        {thread.latest.from}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(thread.latest.dateISO)}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1 truncate">
                      {thread.latest.subject}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {thread.latest.snippet}
                    </p>
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
  );
}