import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import Clients from "@/pages/clients";
import Projects from "@/pages/projects";
import Quotes from "@/pages/quotes";
import Contracts from "@/pages/contracts";
import Invoices from "@/pages/invoices";
import Email from "@/pages/email";
import Calendar from "@/pages/calendar";
import Automations from "@/pages/automations";
import Settings from "@/pages/settings";
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
      
      {/* Admin Routes - With Sidebar */}
      <Route>
        {() => (
          <div className="flex h-screen bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/leads" component={Leads} />
                <Route path="/clients" component={Clients} />
                <Route path="/projects" component={Projects} />
                <Route path="/members" component={Members} />
                <Route path="/venues" component={Venues} />
                <Route path="/quotes" component={Quotes} />
                <Route path="/contracts" component={Contracts} />
                <Route path="/invoices" component={Invoices} />
                <Route path="/email" component={Email} />
                <Route path="/calendar" component={Calendar} />
                <Route path="/automations" component={Automations} />
                <Route path="/settings" component={Settings} />
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
