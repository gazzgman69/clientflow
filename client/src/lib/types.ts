export interface DashboardMetrics {
  totalLeads: number;
  activeProjects: number;
  revenue: number;
  pendingInvoices: number;
}

export interface EmailSummary {
  unread: number;
  sentToday: number;
  pendingReplies: number;
}
