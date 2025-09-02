import Header from "@/components/layout/header";
import CalendarWeekView from "@/components/dashboard/calendar-week-view";
import CombinedBusinessActivity from "@/components/dashboard/combined-business-activity";
import PendingItems from "@/components/dashboard/pending-items";
import EnhancedEmails from "@/components/dashboard/enhanced-emails";
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
        {/* Calendar Week View - Full Width at Top */}
        <CalendarWeekView />
        
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <CombinedBusinessActivity />
            <PendingItems />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <EnhancedEmails />
          </div>
        </div>
      </main>
    </>
  );
}
