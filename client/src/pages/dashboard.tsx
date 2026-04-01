import Header from "@/components/layout/header";
import CalendarWeekView from "@/components/dashboard/calendar-week-view";
import RecentClientActivity from "@/components/dashboard/recent-client-activity";
import PendingItems from "@/components/dashboard/pending-items";
import BusinessPriorities from "@/components/dashboard/business-priorities";
import EmailThreadsWidget from "@/components/dashboard/email-threads-widget";
import CompactMetrics from "@/components/dashboard/compact-metrics";

export default function Dashboard() {
  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with your business today."
      />

      <main className="flex-1 overflow-auto p-6 space-y-5">
        {/* Financial KPI cards — full width across top */}
        <CompactMetrics />

        {/* Main grid: Action Required | Activity Feed | Calendar */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Column 1: Action Required + Business Priorities */}
          <div className="space-y-5">
            <PendingItems />
            <BusinessPriorities />
          </div>

          {/* Column 2: Recent Activity + Email threads */}
          <div className="space-y-5">
            <RecentClientActivity />
            <EmailThreadsWidget />
          </div>

          {/* Column 3: Calendar */}
          <div>
            <CalendarWeekView />
          </div>
        </div>
      </main>
    </>
  );
}
