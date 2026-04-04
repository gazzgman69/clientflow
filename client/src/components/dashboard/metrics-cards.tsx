import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Briefcase, DollarSign, Clock } from "lucide-react";
import type { DashboardMetrics } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

export default function MetricsCards() {
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metricItems = [
    {
      title: "Total Leads",
      value: metrics?.totalLeads || 0,
      icon: UserPlus,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
      change: "+12%",
      changeText: "from last month",
      changeColor: "text-green-600",
      testId: "metric-total-leads"
    },
    {
      title: "Active Projects",
      value: metrics?.activeProjects || 0,
      icon: Briefcase,
      iconColor: "text-accent",
      iconBg: "bg-accent/10",
      change: "+3",
      changeText: "this week",
      changeColor: "text-green-600",
      testId: "metric-active-projects"
    },
    {
      title: "Revenue This Month",
      value: formatCurrency(metrics?.revenue || 0, 'GBP'),
      icon: DollarSign,
      iconColor: "text-green-600",
      iconBg: "bg-green-100",
      change: "+8%",
      changeText: "vs last month",
      changeColor: "text-green-600",
      testId: "metric-revenue"
    },
    {
      title: "Pending Invoices",
      value: metrics?.pendingInvoices || 0,
      icon: Clock,
      iconColor: "text-yellow-600",
      iconBg: "bg-yellow-100",
      change: "$8,420",
      changeText: "total value",
      changeColor: "text-yellow-600",
      testId: "metric-pending-invoices"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metricItems.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="metric-card shadow-sm" data-testid={item.testId}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{item.title}</p>
                  <p className="text-3xl font-bold text-foreground" data-testid={`${item.testId}-value`}>
                    {item.value}
                  </p>
                </div>
                <div className={`w-12 h-12 ${item.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${item.iconColor} h-6 w-6`} />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className={`text-sm font-medium ${item.changeColor}`}>{item.change}</span>
                <span className="text-sm text-muted-foreground ml-2">{item.changeText}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
