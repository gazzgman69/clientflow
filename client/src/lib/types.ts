export interface DashboardMetrics {
  totalLeads: number;
  activeProjects: number;
  revenue: number;
  pendingInvoices: number;
}

export interface BusinessMetrics {
  // Financial
  cashFlowForecast: number;
  totalPotentialRevenue: number;
  monthlyRecurringRevenue: number;
  outstandingInvoices: number;
  avgProjectValue: number;
  pipelineValue: number;
  
  // Conversion & Pipeline
  leadConversionRate: number;
  quoteSuccessRate: number;
  avgTimeToClose: number;
  
  // Operations
  responseTime: number;
  overdueItems: number;
  projectCompletionRate: number;
  clientActivityScore: number;
  
  // Growth & Intelligence
  topVenue: string;
  memberUtilization: number;
  clientRetentionRate: number;
  referralRate: number;
  activeProjects: number;
}

export interface EmailSummary {
  unread: number;
  sentToday: number;
  pendingReplies: number;
}
