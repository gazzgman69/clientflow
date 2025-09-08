import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import Contacts from "@/pages/clients";
import Projects from "@/pages/projects";
import Quotes from "@/pages/quotes";
import Contracts from "@/pages/contracts";
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
import ProjectDetail from "@/pages/ProjectDetail";
import Members from "@/pages/members";
import Venues from "@/pages/venues";
import MusicianPortal from "@/pages/portal/musician-portal";
import ClientPortal from "@/pages/portal/client-portal";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  return (
    <Switch>
      {/* Portal Routes - No Sidebar */}
      <Route path="/portal/musician" component={MusicianPortal} />
      <Route path="/portal/client" component={ClientPortal} />
      
      {/* Public Form Routes - No Sidebar */}
      <Route path="/f/:slug">
        {(params) => <LeadFormHosted slug={params.slug} />}
      </Route>
      
      {/* Admin Routes - With Sidebar */}
      <Route>
        {() => (
          <div className="flex h-screen bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/leads/capture" component={LeadCaptureBuilder} />
                <Route path="/leads/board" component={LeadsKanban} />
                <Route path="/leads/inbox" component={LeadsInbox} />
                <Route path="/leads">
                  <Redirect to="/leads/board" replace />
                </Route>
                <Route path="/contacts" component={Contacts} />
                <Route path="/projects/:id" component={ProjectDetail} />
                <Route path="/projects" component={Projects} />
                <Route path="/members" component={Members} />
                <Route path="/venues" component={Venues} />
                <Route path="/documents" component={Documents} />
                <Route path="/quotes" component={Quotes} />
                <Route path="/contracts" component={Contracts} />
                <Route path="/invoices" component={Invoices} />
                <Route path="/calendar" component={Calendar} />
                <Route path="/automations" component={Automations} />
                <Route path="/settings/email" component={EmailSettings} />
                <Route path="/settings/templates" component={Templates} />
                <Route path="/settings/automations" component={LeadAutomations} />
                <Route path="/settings" component={Templates} />
                <Route component={NotFound} />
              </Switch>
            </div>
          </div>
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
