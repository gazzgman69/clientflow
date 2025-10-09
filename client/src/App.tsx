import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import Contacts from "@/pages/clients";
import Projects from "@/pages/projects";
import Quotes from "@/pages/quotes";
import Contracts from "@/pages/contracts";
import ContractPreview from "@/pages/ContractPreview";
import Invoices from "@/pages/invoices";
import Documents from "@/pages/documents";
import Calendar from "@/pages/calendar";
import Automations from "@/pages/automations";
import Settings from "@/pages/settings";
import EmailSettings from "@/pages/settings/EmailSettings";
import Templates from "@/pages/settings/Templates";
import LeadAutomations from "@/pages/settings/Automations";
import LeadCaptureBuilder from "@/pages/leads/LeadCaptureBuilder";
import LeadsKanban from "@/pages/leads/LeadsKanban";
import LeadsInbox from "@/pages/leads/LeadsInbox";
import LeadFormHosted from "@/pages/public/LeadFormHosted";
import PublicQuote from "@/pages/public/PublicQuote";
import PublicContract from "@/pages/public/PublicContract";
import ProjectDetail from "@/pages/ProjectDetail";
import ContactDetail from "@/pages/ContactDetail";
import Members from "@/pages/members";
import Venues from "@/pages/venues";
import MusicianPortal from "@/pages/portal/musician-portal";
import ClientPortal from "@/pages/portal/client-portal";
import LoginPage from "@/pages/login";
import Sidebar from "@/components/layout/sidebar";
import { ImpersonationBanner } from "@/components/impersonation-banner";

// Authentication wrapper component  
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
    queryFn: async () => {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      
      // If 401, return null (not authenticated) instead of throwing
      if (res.status === 401) {
        return { user: null };
      }
      
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If authentication failed or no user data, show login page
  if (error || !user?.user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public Login Route */}
      <Route path="/login" component={LoginPage} />
      
      {/* Portal Routes - No Authentication Required */}
      <Route path="/portal/musician" component={MusicianPortal} />
      
      {/* Public Form Routes - No Authentication Required */}
      <Route path="/f/:slug">
        {(params) => <LeadFormHosted slug={params.slug} />}
      </Route>
      
      {/* Public Quote Routes - No Authentication Required */}
      <Route path="/q/:token">
        {(params) => <PublicQuote token={params.token} />}
      </Route>
      
      {/* Public Contract Routes - No Authentication Required */}
      <Route path="/c/:id">
        {(params) => <PublicContract id={params.id} />}
      </Route>
      
      {/* Protected Routes - Require Authentication */}
      <Route>
        {() => (
          <AuthWrapper>
            <div className="flex h-screen bg-background">
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-hidden">
                <ImpersonationBanner />
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/leads/capture" component={LeadCaptureBuilder} />
                  <Route path="/leads/board" component={LeadsKanban} />
                  <Route path="/leads/inbox" component={LeadsInbox} />
                  <Route path="/leads">
                    <Redirect to="/leads/board" replace />
                  </Route>
                  <Route path="/contacts/:id" component={ContactDetail} />
                  <Route path="/contacts" component={Contacts} />
                  <Route path="/projects/:id" component={ProjectDetail} />
                  <Route path="/projects" component={Projects} />
                  <Route path="/members" component={Members} />
                  <Route path="/venues" component={Venues} />
                  <Route path="/documents" component={Documents} />
                  <Route path="/quotes" component={Quotes} />
                  <Route path="/contracts/:id/preview" component={ContractPreview} />
                  <Route path="/contracts" component={Contracts} />
                  <Route path="/invoices" component={Invoices} />
                  <Route path="/calendar" component={Calendar} />
                  <Route path="/automations" component={Automations} />
                  <Route path="/portal/client" component={ClientPortal} />
                  <Route path="/portal" component={ClientPortal} />
                  <Route path="/settings/email" component={EmailSettings} />
                  <Route path="/settings/email-and-calendar" component={EmailSettings} />
                  <Route path="/settings/templates" component={Templates} />
                  <Route path="/settings/automations" component={LeadAutomations} />
                  <Route path="/settings" component={Settings} />
                  <Route component={NotFound} />
                </Switch>
              </div>
            </div>
          </AuthWrapper>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
