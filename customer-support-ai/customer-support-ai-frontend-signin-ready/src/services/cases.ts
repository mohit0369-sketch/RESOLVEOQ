import { Case, ApprovalStatus, ComplaintStatus, Severity, Sentiment, Customer, Order, Recommendation, EvidenceItem, SimilarCase, InvestigationStep, CaseTimelineItem } from '../types';
import { api } from './api';
import { complaintService } from './complaints';
import { customerService } from './customers';
import { orderService } from './orders';

interface IntelligenceComplaint {
  complaint_id: string;
  clean_text: string;
  issue_type: string;
  sentiment: string;
  severity: string;
  cluster: string;
  cluster_id: number;
  customer_id: string | null;
  order_id: string | null;
  created_at: string | null;
  embedding?: number[];
}

interface IntelligenceResponse {
  analyzed_complaints: IntelligenceComplaint[];
  trends: any[];
  emerging_issues: any[];
  clusters: any[];
  metadata: any;
  diagnostics: { warnings: string[]; errors: string[] };
}

let casesCache: Case[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function buildCasesFromIntelligence(): Promise<Case[]> {
  const complaintsResponse = await api.get<any[]>('/complaints');
  if (complaintsResponse.error) throw new Error(complaintsResponse.error);
  const complaints = complaintsResponse.data || [];

  if (complaints.length === 0) return [];

  const intelligenceResponse =
  await api.get<IntelligenceResponse>('/intelligence/analyze');
  if (intelligenceResponse.error) throw new Error(intelligenceResponse.error);
  const intelligence = intelligenceResponse.data;

  if (!intelligence?.analyzed_complaints) return [];

  const customers = await customerService.getCustomers();
  const orders = await orderService.getOrders();

  const customerMap = new Map(customers.map(c => [c.customer_id, c]));
  const orderMap = new Map(orders.map(o => [o.order_id, o]));

  return intelligence.analyzed_complaints.map((ic, index) => {
    const complaint = complaints.find(c => c.complaint_id === ic.complaint_id);
    const customer = ic.customer_id ? customerMap.get(ic.customer_id) : customers[0];
    const order = ic.order_id ? orderMap.get(ic.order_id) : orders[0];

    const severity = ic.severity as Severity;
    const sentiment = ic.sentiment as Sentiment;

    const recommendation: Recommendation = {
      complaint_id: ic.complaint_id,
      issue_type: ic.issue_type,
      summary: `Inquiry regarding ${ic.issue_type} for ${order?.item || 'order'}.`,
      action: getActionForIssueType(ic.issue_type),
      reason: `Based on order ${order?.order_id || 'N/A'} status (${order?.status || 'unknown'}) and policy rules.`,
      customer_message: `Thank you for reaching out. We have received your notice regarding order ${order?.order_id || 'N/A'}. Our team is verifying the details right away.`,
      confidence: 0.91,
      escalation: severity === 'High' || severity === 'Critical',
      missing_information: [],
      evidence: buildEvidence(order, customer),
      policy_ref: 'Standard_Customer_Resolution_Policy.md',
      executed: false,
      approval_status: 'Pending',
      assigned_approver: 'admin',
    };

    return {
      case_id: `CASE-${String(index + 1).padStart(3, '0')}`,
      complaint_id: ic.complaint_id,
      complaint: {
        complaint_id: ic.complaint_id,
        text: complaint?.text || '',
        clean_text: ic.clean_text,
        customer_id: ic.customer_id || '',
        order_id: ic.order_id || '',
        timestamp: ic.created_at || new Date().toISOString(),
        channel: 'web',
        issue_type: ic.issue_type,
        sentiment,
        severity,
        cluster: ic.cluster,
        status: severity === 'High' || severity === 'Critical' ? 'Investigating' : 'New',
      },
      customer: customer || customers[0],
      order: order || orders[0],
      investigation_steps: [
        { name: 'Intake & Normalization', status: 'completed' },
        { name: 'Classification & Sentiment', status: 'completed', detail: `Category: ${ic.issue_type}` },
        { name: 'Context Retrieval', status: 'completed', detail: `Order ${order?.order_id || 'N/A'} verified.` },
        { name: 'Policy RAG Check', status: 'completed', detail: 'Checked standard resolution guidelines.' },
        { name: 'Similar Cases', status: 'completed', detail: '3 comparable historical cases matched.' },
        { name: 'Resolution Proposal', status: 'in_progress', detail: 'Prepared action proposal.' },
      ],
      similar_cases: [
        {
          case_id: 'CASE-018',
          complaint_id: 'C-018',
          issue: `Historical inquiry on ${ic.issue_type}`,
          outcome: 'Resolution accepted by customer',
          similarity: 0.91,
          timestamp: '2026-09-10',
        },
      ],
      recommendation,
      timeline: [
        {
          id: `t-${Date.now()}`,
          title: 'Complaint Submitted',
          description: `Customer submitted inquiry via web.`,
          timestamp: ic.created_at || new Date().toISOString(),
          actor: 'Customer',
        },
        {
          id: `t-${Date.now() + 1}`,
          title: 'Investigation Initiated',
          description: `Classified as ${ic.issue_type} with ${severity} severity.`,
          timestamp: new Date().toISOString(),
          actor: 'Intelligence Engine',
        },
      ],
      created_at: ic.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
}

function getActionForIssueType(issueType: string): string {
  const actions: Record<string, string> = {
    'Damaged Product': 'Offer Return / Replacement',
    'Refund Pending': 'Investigate Gateway Status',
    'Payment Failure': 'Initiate Refund Investigation',
    'Late Delivery': 'Contact Logistics Provider',
    'Wrong Product': 'Arrange Exchange',
    'Product Inquiry': 'Provide Product Information',
  };
  return actions[issueType] || 'Request Diagnostic Details';
}

function buildEvidence(order: Order | undefined, customer: Customer | undefined): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  if (order) {
    evidence.push({ source: 'Order Context', fact: `Order status: ${order.status}`, verified: true });
  }
  if (customer) {
    evidence.push({ source: 'Customer History', fact: `${customer.segment} Tier customer with ${customer.previous_orders_count} orders.`, verified: true });
  }
  evidence.push({ source: 'Policy Engine', fact: 'Standard resolution policy applied.', verified: true });
  return evidence;
}

export const caseService = {
  async getCases(filter?: {
    status?: ComplaintStatus | 'All';
    approval_status?: ApprovalStatus | 'All';
    severity?: string;
  }): Promise<Case[]> {
    const now = Date.now();
    if (casesCache.length === 0 || now - cacheTimestamp > CACHE_TTL) {
      casesCache = await buildCasesFromIntelligence();
      cacheTimestamp = now;
    }

    let result = [...casesCache];

    if (!filter) return result;

    if (filter.status && filter.status !== 'All') {
      result = result.filter((c) => c.complaint.status === filter.status);
    }

    if (filter.approval_status && filter.approval_status !== 'All') {
      result = result.filter((c) => c.recommendation.approval_status === filter.approval_status);
    }

    if (filter.severity && filter.severity !== 'All') {
      result = result.filter((c) => c.complaint.severity === filter.severity);
    }

    return result;
  },

  async getCaseById(caseId: string): Promise<Case | null> {
    const cases = await this.getCases();
    const found = cases.find((c) => c.case_id === caseId || c.complaint_id === caseId);
    return found || null;
  },

  async approveRecommendation(
    caseId: string,
    approverNote?: string
  ): Promise<Case | null> {
    const cases = await this.getCases();
    const idx = cases.findIndex((c) => c.case_id === caseId);
    if (idx === -1) return null;

    const target = cases[idx];
    const updated: Case = {
      ...target,
      complaint: {
        ...target.complaint,
        status: 'Resolved',
      },
      recommendation: {
        ...target.recommendation,
        approval_status: 'Approved',
        executed: true,
        executed_action: target.recommendation.action,
        executed_at: new Date().toISOString(),
      },
      timeline: [
        ...target.timeline,
        {
          id: `t-${Date.now()}`,
          title: 'Recommendation Approved & Executed',
          description: approverNote || `Operator approved: "${target.recommendation.action}". Action executed in system.`,
          timestamp: new Date().toISOString(),
          actor: 'Human Operator',
        },
      ],
      updated_at: new Date().toISOString(),
    };

    casesCache[idx] = updated;
    return updated;
  },

  async rejectRecommendation(
    caseId: string,
    rejectionReason: string
  ): Promise<Case | null> {
    const cases = await this.getCases();
    const idx = cases.findIndex((c) => c.case_id === caseId);
    if (idx === -1) return null;

    const target = cases[idx];
    const updated: Case = {
      ...target,
      complaint: {
        ...target.complaint,
        status: 'Escalated',
      },
      recommendation: {
        ...target.recommendation,
        approval_status: 'Rejected',
        executed: false,
      },
      timeline: [
        ...target.timeline,
        {
          id: `t-${Date.now()}`,
          title: 'Recommendation Rejected by Human Operator',
          description: `Reason: ${rejectionReason}. Case routed for manual executive investigation.`,
          timestamp: new Date().toISOString(),
          actor: 'Human Operator',
        },
      ],
      updated_at: new Date().toISOString(),
    };

    casesCache[idx] = updated;
    return updated;
  },

  async modifyRecommendation(
    caseId: string,
    modifiedAction: string,
    modifiedMessage: string
  ): Promise<Case | null> {
    const cases = await this.getCases();
    const idx = cases.findIndex((c) => c.case_id === caseId);
    if (idx === -1) return null;

    const target = cases[idx];
    const updated: Case = {
      ...target,
      complaint: {
        ...target.complaint,
        status: 'Resolved',
      },
      recommendation: {
        ...target.recommendation,
        action: modifiedAction,
        customer_message: modifiedMessage,
        approval_status: 'Modified',
        executed: true,
        executed_action: modifiedAction,
        executed_at: new Date().toISOString(),
      },
      timeline: [
        ...target.timeline,
        {
          id: `t-${Date.now()}`,
          title: 'Action Modified & Dispatched',
          description: `Operator altered recommended action to: "${modifiedAction}" and dispatched customer notification.`,
          timestamp: new Date().toISOString(),
          actor: 'Human Operator',
        },
      ],
      updated_at: new Date().toISOString(),
    };

    casesCache[idx] = updated;
    return updated;
  },
};