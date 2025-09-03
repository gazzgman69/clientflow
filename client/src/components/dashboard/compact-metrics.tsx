import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarChart3, DollarSign, Clock, TrendingUp, Users, Target, Calendar, Zap } from "lucide-react";
import type { BusinessMetrics } from "@/lib/types";

export default function CompactMetrics() {
  const [selectedMetrics, setSelectedMetrics] = useState([
    'cashFlowForecast',
    'totalPotentialRevenue', 
    'responseTime'
  ]);
  const [isMetricDialogOpen, setIsMetricDialogOpen] = useState(false);
  const [changingMetricIndex, setChangingMetricIndex] = useState<number>(0);

  const { data: metrics, isLoading } = useQuery<BusinessMetrics>({
    queryKey: ["/api/business/metrics"],
  });

  const availableMetrics = {
    cashFlowForecast: {
      key: 'cashFlowForecast',
      title: 'Cash Flow Forecast',
      value: metrics?.cashFlowForecast ? `$${metrics.cashFlowForecast.toLocaleString()}` : '$0',
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-100'
    },
    totalPotentialRevenue: {
      key: 'totalPotentialRevenue',
      title: 'Potential Revenue',
      value: metrics?.totalPotentialRevenue ? `$${metrics.totalPotentialRevenue.toLocaleString()}` : '$0',
      icon: DollarSign,
      color: 'text-blue-600',
      bg: 'bg-blue-100'
    },
    responseTime: {
      key: 'responseTime',
      title: 'Avg Response Time',
      value: metrics?.responseTime ? `${metrics.responseTime}h` : '0h',
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-100'
    },
    leadConversionRate: {
      key: 'leadConversionRate',
      title: 'Lead Conversion',
      value: metrics?.leadConversionRate ? `${metrics.leadConversionRate}%` : '0%',
      icon: Target,
      color: 'text-purple-600',
      bg: 'bg-purple-100'
    },
    outstandingInvoices: {
      key: 'outstandingInvoices',
      title: 'Outstanding Invoices',
      value: metrics?.outstandingInvoices ? `$${metrics.outstandingInvoices.toLocaleString()}` : '$0',
      icon: Calendar,
      color: 'text-red-600',
      bg: 'bg-red-100'
    },
    activeProjects: {
      key: 'activeProjects',
      title: 'Active Projects',
      value: metrics?.activeProjects || 0,
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100'
    }
  };

  // Ensure only unique metrics and exactly 3 are displayed
  const uniqueSelectedMetrics = Array.from(new Set(selectedMetrics)).slice(0, 3);
  const displayedMetrics = uniqueSelectedMetrics.map(key => availableMetrics[key as keyof typeof availableMetrics]).filter(Boolean);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between animate-pulse">
            <div className="h-16 bg-muted rounded flex-1 mr-4"></div>
            <div className="h-16 bg-muted rounded flex-1 mr-4"></div>
            <div className="h-16 bg-muted rounded flex-1"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pt-2 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs">Business Overview</CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-5 px-1 text-[10px]" data-testid="view-full-analytics">
                <BarChart3 className="h-2.5 w-2.5 mr-0.5" />
                Analytics
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Complete Business Analytics</DialogTitle>
              </DialogHeader>
              <FullAnalytics metrics={metrics} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <div className="grid grid-cols-3 gap-2">
          {displayedMetrics.slice(0, 3).map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div 
                key={`${metric.key}-${index}`} 
                className="text-center cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors" 
                data-testid={`compact-metric-${metric.key}`}
                onClick={() => {
                  setChangingMetricIndex(index);
                  setIsMetricDialogOpen(true);
                }}
              >
                <div className={`w-6 h-6 ${metric.bg} rounded flex items-center justify-center mx-auto mb-0.5`}>
                  <Icon className={`${metric.color} h-3 w-3`} />
                </div>
                <p className="text-sm font-bold text-foreground leading-tight">{metric.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{metric.title}</p>
              </div>
            );
          })}
        </div>
        
        {/* Metric Selection Dialog */}
        <Dialog open={isMetricDialogOpen} onOpenChange={setIsMetricDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Choose Metric</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(availableMetrics).map((metric) => {
                const Icon = metric.icon;
                const isSelected = uniqueSelectedMetrics[changingMetricIndex] === metric.key;
                
                return (
                  <div
                    key={metric.key}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:bg-muted'
                    }`}
                    onClick={() => {
                      const newMetrics = [...uniqueSelectedMetrics];
                      newMetrics[changingMetricIndex] = metric.key;
                      setSelectedMetrics(newMetrics);
                      setIsMetricDialogOpen(false);
                    }}
                  >
                    <div className={`w-8 h-8 ${metric.bg} rounded flex items-center justify-center mx-auto mb-2`}>
                      <Icon className={`${metric.color} h-4 w-4`} />
                    </div>
                    <p className="text-xs font-medium text-center">{metric.title}</p>
                    <p className="text-lg font-bold text-center mt-1">{metric.value}</p>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function FullAnalytics({ metrics }: { metrics?: BusinessMetrics }) {
  const allMetrics = [
    { title: 'Pipeline & Conversion', items: [
      { label: 'Lead Conversion Rate', value: `${metrics?.leadConversionRate || 0}%`, trend: '+5%' },
      { label: 'Quote Success Rate', value: `${metrics?.quoteSuccessRate || 0}%`, trend: '+12%' },
      { label: 'Average Time to Close', value: `${metrics?.avgTimeToClose || 0} days`, trend: '-2 days' },
      { label: 'Pipeline Value', value: `$${(metrics?.pipelineValue || 0).toLocaleString()}`, trend: '+18%' }
    ]},
    { title: 'Financial Health', items: [
      { label: 'Monthly Recurring Revenue', value: `$${(metrics?.monthlyRecurringRevenue || 0).toLocaleString()}`, trend: '+8%' },
      { label: 'Outstanding Invoice Value', value: `$${(metrics?.outstandingInvoices || 0).toLocaleString()}`, trend: '-$2.4K' },
      { label: 'Average Project Value', value: `$${(metrics?.avgProjectValue || 0).toLocaleString()}`, trend: '+15%' },
      { label: 'Cash Flow Forecast', value: `$${(metrics?.cashFlowForecast || 0).toLocaleString()}`, trend: '+22%' }
    ]},
    { title: 'Operations', items: [
      { label: 'Response Time Average', value: `${metrics?.responseTime || 0} hours`, trend: '-30min' },
      { label: 'Overdue Items', value: metrics?.overdueItems || 0, trend: '-3' },
      { label: 'Project Completion Rate', value: `${metrics?.projectCompletionRate || 0}%`, trend: '+5%' },
      { label: 'Client Activity Score', value: `${metrics?.clientActivityScore || 0}/10`, trend: '+0.8' }
    ]},
    { title: 'Growth & Intelligence', items: [
      { label: 'Top Venue Performance', value: metrics?.topVenue || 'N/A', trend: '+25%' },
      { label: 'Member Utilization', value: `${metrics?.memberUtilization || 0}%`, trend: '+10%' },
      { label: 'Client Retention Rate', value: `${metrics?.clientRetentionRate || 0}%`, trend: '+3%' },
      { label: 'Referral Rate', value: `${metrics?.referralRate || 0}%`, trend: '+7%' }
    ]}
  ];

  return (
    <div className="space-y-6">
      {allMetrics.map((section) => (
        <div key={section.title}>
          <h3 className="text-lg font-semibold mb-3">{section.title}</h3>
          <div className="grid grid-cols-2 gap-4">
            {section.items.map((item) => (
              <div key={item.label} className="border rounded-lg p-3">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xl font-bold">{item.value}</p>
                  <span className="text-sm text-green-600">{item.trend}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}