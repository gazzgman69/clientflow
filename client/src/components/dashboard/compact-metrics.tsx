import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, AlertTriangle, Briefcase } from "lucide-react";

interface DashboardMetrics {
  paidThisMonth: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
  pipeline: number;
  activeProjects: number;
  unsignedContracts: number;
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `£${(value / 1000).toFixed(1)}k`;
  }
  return `£${value.toLocaleString()}`;
}

export default function CompactMetrics() {
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const cards = [
    {
      label: "Paid This Month",
      value: metrics ? formatCurrency(metrics.paidThisMonth) : "—",
      icon: DollarSign,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      valueColor: "text-green-700",
    },
    {
      label: "Outstanding",
      value: metrics ? formatCurrency(metrics.outstanding) : "—",
      icon: TrendingUp,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      valueColor: "text-amber-700",
    },
    {
      label: "Overdue",
      value: metrics ? formatCurrency(metrics.overdue) : "—",
      subLabel: metrics?.overdueCount ? `${metrics.overdueCount} invoice${metrics.overdueCount !== 1 ? 's' : ''}` : undefined,
      icon: AlertTriangle,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      valueColor: metrics && metrics.overdue > 0 ? "text-red-700" : "text-foreground",
    },
    {
      label: "Pipeline",
      value: metrics ? formatCurrency(metrics.pipeline) : "—",
      subLabel: metrics?.activeProjects ? `${metrics.activeProjects} active project${metrics.activeProjects !== 1 ? 's' : ''}` : undefined,
      icon: Briefcase,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      valueColor: "text-indigo-700",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-12 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-medium mb-1">{card.label}</p>
                  <p className={`text-xl font-bold leading-tight ${card.valueColor}`}>
                    {card.value}
                  </p>
                  {card.subLabel && (
                    <p className="text-xs text-muted-foreground mt-0.5">{card.subLabel}</p>
                  )}
                </div>
                <div className={`w-8 h-8 ${card.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 ml-2`}>
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
