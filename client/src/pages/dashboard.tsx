import Header from "@/components/layout/header";
import CalendarWeekView from "@/components/dashboard/calendar-week-view";
import RecentClientActivity from "@/components/dashboard/recent-client-activity";
import PendingItems from "@/components/dashboard/pending-items";
import BusinessPriorities from "@/components/dashboard/business-priorities";
import EnhancedEmails from "@/components/dashboard/enhanced-emails";
import EmailThreadsWidget from "@/components/dashboard/email-threads-widget";
import CompactMetrics from "@/components/dashboard/compact-metrics";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@shared/schema";

export default function Dashboard() {
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  return (
    <>
      <Header 
        title="Dashboard" 
        subtitle="Welcome back! Here's what's happening with your business today."
      />
      
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Top Row: Business Overview and Calendar side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CompactMetrics />
          <CalendarWeekView />
        </div>
        
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <BusinessPriorities />
            <PendingItems />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <RecentClientActivity />
            <EmailThreadsWidget />
          </div>
        </div>
      </main>
    </>
  );
}
