import Header from "@/components/layout/header";
import DashboardCalendar from "@/components/dashboard/dashboard-calendar";
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

      <main className="flex-1 overflow-auto p-5 space-y-4">
        {/* Row 1: Financial KPI cards */}
        <CompactMetrics />

        {/* Row 2: Two-column layout matching mockup */}
        <div className="flex gap-4 min-h-0" style={{ alignItems: "flex-start" }}>

          {/* LEFT: Action Required + Business Priorities (flexible width) */}
          <div className="flex-1 min-w-0 space-y-4">
            <PendingItems />
            <BusinessPriorities />
          </div>

          {/* RIGHT: Calendar + Activity + Email (~360px fixed) */}
          <div className="flex-shrink-0 space-y-4" style={{ width: 360 }}>
            <DashboardCalendar />
            <RecentClientActivity />
            <EmailThreadsWidget />
          </div>

        </div>
      </main>
    </>
  );
}
