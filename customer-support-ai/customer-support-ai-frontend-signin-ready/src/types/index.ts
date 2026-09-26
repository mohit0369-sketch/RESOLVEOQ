export type Sentiment = 'Positive' | 'Neutral' | 'Negative';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ComplaintStatus = 'New' | 'Investigating' | 'Pending Approval' | 'Resolved' | 'Escalated';
export type OrderStatus = 'Delivered' | 'In Transit' | 'Cancelled' | 'Processing' | 'Refund Initiated';
export type PaymentStatus = 'Paid' | 'Pending' | 'Refunded' | 'Failed' | 'Refund Initiated';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Modified' | 'Rejected';

export interface Customer {
  customer_id: string;
  name: string;
  email: string;
  segment: 'Standard' | 'Premium' | 'VIP';
  language: string;
  created_at: string;
  previous_orders_count: number;
  lifetime_complaints_count: number;
}

export interface Order {
  order_id: string;
  customer_id: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  item: string;
  delivery_date?: string;
  seller?: string;
  warehouse?: string;
  payment_status: PaymentStatus;
  return_window_open: boolean;
}

export interface Complaint {
  complaint_id: string;
  text: string;
  customer_id: string;
  order_id: string;
  timestamp: string;
  channel: 'web' | 'email' | 'mobile' | 'whatsapp';
  clean_text?: string;
  issue_type?: string;
  sentiment?: Sentiment;
  severity?: Severity;
  cluster?: string;
  status: ComplaintStatus;
  attachment_url?: string;
}

export interface EvidenceItem {
  source: 'Order Context' | 'Customer History' | 'Policy Engine' | 'Similar Cases' | 'Logistics API';
  fact: string;
  timestamp?: string;
  verified: boolean;
}

export interface SimilarCase {
  case_id: string;
  complaint_id: string;
  issue: string;
  outcome: string;
  similarity: number; // e.g. 0.92
  timestamp: string;
}

export interface Recommendation {
  complaint_id: string;
  issue_type: string;
  summary: string;
  action: string;
  reason: string;
  customer_message: string;
  confidence: number; // 0.0 to 1.0
  escalation: boolean;
  missing_information: string[];
  evidence: EvidenceItem[];
  policy_ref: string;
  executed: boolean;
  executed_action?: string;
  executed_at?: string;
  approval_status: ApprovalStatus;
  assigned_approver?: string;
}

export interface CaseTimelineItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  actor: 'Customer' | 'Intelligence Engine' | 'Resolution Agent' | 'Human Operator';
}

export interface InvestigationStep {
  name: string;
  status: 'completed' | 'in_progress' | 'pending';
  detail?: string;
}

export interface Case {
  case_id: string;
  complaint_id: string;
  complaint: Complaint;
  customer: Customer;
  order: Order;
  investigation_steps: InvestigationStep[];
  similar_cases: SimilarCase[];
  recommendation: Recommendation;
  timeline: CaseTimelineItem[];
  created_at: string;
  updated_at: string;
}

export interface TrendCluster {
  cluster_name: string;
  count: number;
  growth_percent: number;
  severity: Severity;
  category: string;
  representative_complaints: string[];
  hypotheses: string[];
  history_7d: { date: string; count: number }[];
  history_30d: { date: string; count: number }[];
  history_90d: { date: string; count: number }[];
}

export interface DashboardMetrics {
  total_tickets: number;
  open_tickets: number;
  high_severity_count: number;
  escalation_count: number;
  resolved_today_count: number;
  avg_resolution_time_hours: number;
  ticket_volume_growth_pct: number;
  weekly_trend: { date: string; count: number; previous_count: number }[];
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}
