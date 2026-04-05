import { Switch, Route, Redirect } from "wouter";
import { Component, type ReactNode } from "react";
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
import EmailPage from "@/pages/email";
import Settings from "@/pages/settings";
import EmailSettings from "@/pages/settings/EmailSettings";
import Templates from "@/pages/settings/Templates";
import LeadAutomations from "@/pages/settings/Automations";
import WidgetSettings from "@/pages/settings/WidgetSettings";
import LeadCaptureBuilder from "@/pages/leads/LeadCaptureBuilder";
import LeadsInbox from "@/pages/leads/LeadsInbox";
import LeadFormHosted from "@/pages/public/LeadFormHosted";
import PublicQuote from "@/pages/public/PublicQuote";
import PublicContract from "@/pages/public/PublicContract";
import PublicChatWidget from "@/pages/public/PublicChatWidget";
import PublicBookingPage from "@/pages/public/PublicBookingPage";
import ProjectDetail from "@/pages/ProjectDetail";
import ContactDetail from "@/pages/ContactDetail";
import Members from "@/pages/members";
import Repertoire from "@/pages/repertoire";
import PerformerContracts from "@/pages/performer-contracts";
import Venues from "@/pages/venues";
import MusicianPortal from "@/pages/portal/musician-portal";
import ClientPortal from "@/pages/portal/client-portal";
import LoginPage from "@/pages/login";
import OnboardingPage from "@/pages/onboarding";
import MediaLibrary from "@/pages/media-library";
import Scheduler from "@/pages/scheduler";
import Sidebar from "@/components/layout/sidebar";
import TopNav from "@/components/layout/top-nav";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { AIAssistantButton } from "@/components/AIAssistant";

// Authentication wrapper component  
function AuthWrapper({ children, skipOnboardingCheck }: { children: React.ReactNode; skipOnboardingCheck?: boolean }) {
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

  // Check onboarding status
  const { data: onboardingStatus, isLoading: isLoadingOnboarding } = useQuery({
    queryKey: ['/api/ai-onboarding/status'],
    enabled: !skipOnboardingCheck && !!user?.user,
    retry: false,
  });

  if (isLoading || (!skipOnboardingCheck && isLoadingOnboarding)) {
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

  // Redirect to onboarding if not complete and not skipped
  // Also redirect if no onboarding status exists (first-time user)
  if (!skipOnboardingCheck && onboardingStatus) {
    const status = onboardingStatus.status;
    const needsOnboarding = !status || (!status.isCompleted && !status.isSkipped);
    
    if (needsOnboarding && typeof window !== 'undefined') {
      window.location.href = '/onboarding';
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }
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
      
      {/* Public Chat Widget Routes - No Authentication Required */}
      <Route path="/contact/:slug">
        {(params) => <PublicChatWidget slug={params.slug} />}
      </Route>
      
      {/* Public Booking Routes - No Authentication Required */}
      <Route path="/book/:slug">
        {(params) => <PublicBookingPage slug={params.slug} />}
      </Route>
      
      {/* Onboarding Route - Authenticated but skip onboarding check */}
      <Route path="/onboarding">
        {() => (
          <AuthWrapper skipOnboardingCheck={true}>
            <OnboardingPage />
          </AuthWrapper>
        )}
      </Route>
      
      {/* Protected Routes - Require Authentication */}
      <Route>
        {() => (
          <AuthWrapper>
            <div className="flex h-screen bg-background print:h-auto print:block">
              <div className="print:hidden">
                <Sidebar />
              </div>
              <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:block">
                <div className="print:hidden">
                  <ImpersonationBanner />
                  <TopNav />
                </div>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/leads/capture" component={LeadCaptureBuilder} />
                  <Route path="/leads/urgency" component={Leads} />
                  <Route path="/leads/inbox" component={LeadsInbox} />
                  <Route path="/leads">
                    <Redirect to="/leads/urgency" replace />
                  </Route>
                  <Route path="/contacts/:id" component={ContactDetail} />
                  <Route path="/contacts" component={Contacts} />
                  <Route path="/projects/:id" component={ProjectDetail} />
                  <Route path="/projects" component={Projects} />
                  <Route path="/members" component={Members} />
                  <Route path="/repertoire" component={Repertoire} />
                  <Route path="/performer-contracts" component={PerformerContracts} />
                  <Route path="/venues" component={Venues} />
                  <Route path="/documents" component={Documents} />
                  <Route path="/media-library" component={MediaLibrary} />
                  <Route path="/scheduler" component={Scheduler} />
                  <Route path="/quotes" component={Quotes} />
                  <Route path="/contracts/:id/preview" component={ContractPreview} />
                  <Route path="/contracts" component={Contracts} />
                  <Route path="/invoices" component={Invoices} />
                  <Route path="/calendar" component={Calendar} />
                  <Route path="/email" component={EmailPage} />
                  <Route path="/automations" component={Automations} />
                  <Route path="/portal/client" component={ClientPortal} />
                  <Route path="/portal" component={ClientPortal} />
                  <Route path="/settings/email" component={EmailSettings} />
                  <Route path="/settings/email-and-calendar" component={EmailSettings} />
                  <Route path="/settings/templates" component={Templates} />
                  <Route path="/settings/automations" component={LeadAutomations} />
                  <Route path="/settings/widget" component={WidgetSettings} />
                  <Route path="/settings/enquiry-forms" component={LeadCaptureBuilder} />
                  <Route path="/settings" component={Settings} />
                  <Route component={NotFound} />
                </Switch>
              </div>
              <AIAssistantButton />
            </div>
          </AuthWrapper>
        )}
      </Route>
    </Switch>
  );
}

// Root error boundary — prevents a single component crash from blanking the whole app
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Uncaught error in React tree:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              An unexpected error occurred. Try refreshing the page.
            </p>
            <pre className="text-xs text-left bg-muted p-3 rounded-md overflow-auto max-h-40">
              {this.state.error?.message}
            </pre>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
