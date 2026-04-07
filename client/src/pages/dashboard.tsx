import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import DashboardCalendar from "@/components/dashboard/dashboard-calendar";
import RecentClientActivity from "@/components/dashboard/recent-client-activity";
import PendingItems from "@/components/dashboard/pending-items";
import EmailThreadsWidget from "@/components/dashboard/email-threads-widget";
import CompactMetrics from "@/components/dashboard/compact-metrics";

export default function Dashboard() {
  // Fetch email preferences to determine if email widget should show
  const { data: emailPrefs } = useQuery<{ showOnDashboard?: boolean }>({
    queryKey: ['/api/email/tenant-prefs'],
  });

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with your business today."
      />

      <main className="flex-1 overflow-auto p-5 space-y-4">
        {/* Row 1: Financial KPI cards */}
        <CompactMetrics />

        {/* Row 2: Two-column layout */}
        <div className="flex gap-4 min-h-0" style={{ alignItems: "flex-start" }}>

          {/* LEFT: Action Required (flexible width) */}
          <div className="flex-1 min-w-0 space-y-4">
            <PendingItems />
          </div>

          {/* RIGHT: Calendar + Activity (~360px fixed) */}
          <div className="flex-shrink-0 space-y-4" style={{ width: 360 }}>
            <DashboardCalendar />
            <RecentClientActivity />
          </div>

        </div>

        {/* Row 3: Email Threads — full width (conditional on settings) */}
        {emailPrefs?.showOnDashboard !== false && <EmailThreadsWidget />}
      </main>
    </>
  );
}
