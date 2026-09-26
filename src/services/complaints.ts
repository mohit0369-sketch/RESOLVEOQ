import { Complaint, ComplaintStatus, Severity, Sentiment } from '../types';
import { api } from './api';

interface BackendComplaint {
  complaint_id: string;
  customer_id: string;
  order_id: string | null;
  text: string;
  timestamp: string;
  status: string;
}

interface IntelligenceComplaint {
  complaint_id: string;
  clean_text: string;
  issue_type: string;
  sentiment: Sentiment;
  severity: Severity;
  cluster: string;
  cluster_id: number | null;
  customer_id: string;
  order_id: string | null;
  created_at: string;
}

interface IntelligenceResponse {
  analyzed_complaints: IntelligenceComplaint[];
  trends?: unknown[];
  clusters?: unknown[];
  metadata?: unknown;
  diagnostics?: unknown;
}

function mapComplaintStatus(status: string): ComplaintStatus {
  switch (status.toLowerCase()) {
    case 'open':
      return 'New';

    case 'investigating':
      return 'Investigating';

    case 'pending approval':
    case 'pending_approval':
      return 'Pending Approval';

    case 'resolved':
    case 'closed':
      return 'Resolved';

    case 'escalated':
      return 'Escalated';

    default:
      return 'New';
  }
}

function mapBackendComplaint(
  c: BackendComplaint,
  intelligence?: IntelligenceComplaint
): Complaint {
  return {
    complaint_id: c.complaint_id,
    text: c.text,
    customer_id: c.customer_id,
    order_id: c.order_id || '',
    timestamp: c.timestamp,
    channel: 'web',

    issue_type: intelligence?.issue_type,
    sentiment: intelligence?.sentiment,
    severity: intelligence?.severity,
    cluster: intelligence?.cluster,

    status: mapComplaintStatus(c.status),

    attachment_url: undefined,
  };
}

function classifyComplaint(text: string): {
  issue_type: string;
  cluster: string;
  severity: Severity;
  sentiment: Sentiment;
} {
  const lower = text.toLowerCase();

  let issue_type = 'Other';
  let cluster = 'General Inquiries';
  let severity: Severity = 'Low';
  let sentiment: Sentiment = 'Neutral';

  if (
    lower.includes('charged twice') ||
    lower.includes('unauthorized') ||
    lower.includes('fraud')
  ) {
    issue_type = 'Payment Failure';
    cluster = 'Payment Problem';
    severity = 'Critical';
    sentiment = 'Negative';
  } else if (
    lower.includes('refund') ||
    lower.includes('money back')
  ) {
    issue_type = 'Refund Pending';
    cluster = 'Refund Pending';
    severity = 'High';
    sentiment = 'Negative';
  } else if (
    lower.includes('damaged') ||
    lower.includes('broken') ||
    lower.includes('cracked')
  ) {
    issue_type = 'Damaged Product';
    cluster = 'Damaged Product';
    severity = 'High';
    sentiment = 'Negative';
  } else if (
    lower.includes('late') ||
    lower.includes('not arrived') ||
    lower.includes('tracking')
  ) {
    issue_type = 'Late Delivery';
    cluster = 'Late Delivery';
    severity = 'Medium';
    sentiment = 'Negative';
  } else if (
    lower.includes('wrong') ||
    lower.includes('mismatched') ||
    lower.includes('different color')
  ) {
    issue_type = 'Wrong Product';
    cluster = 'Wrong Product';
    severity = 'Medium';
    sentiment = 'Negative';
  } else if (
    lower.includes('thank') ||
    lower.includes('great') ||
    lower.includes('exceptional')
  ) {
    issue_type = 'Product Inquiry';
    sentiment = 'Positive';
    severity = 'Low';
  }

  return {
    issue_type,
    cluster,
    severity,
    sentiment,
  };
}

export const complaintService = {
  async getComplaints(filter?: {
    search?: string;
    issue_type?: string;
    severity?: Severity | 'All';
    status?: ComplaintStatus | 'All';
    sentiment?: Sentiment | 'All';
  }): Promise<Complaint[]> {
    let endpoint = '/complaints';

    if (filter?.status && filter.status !== 'All') {
      endpoint += `?status=${encodeURIComponent(filter.status)}`;
    }

    /*
     * Get the actual complaints from FastAPI.
     */
    const response = await api.get<BackendComplaint[]>(endpoint);

    if (response.error) {
      throw new Error(response.error);
    }

    const backendComplaints = response.data || [];

    /*
     * Get Student 2's real intelligence analysis.
     *
     * This endpoint analyzes the complaints stored in the backend.
     */
    let intelligenceMap = new Map<string, IntelligenceComplaint>();

    try {
      const intelligenceResponse =
        await api.get<IntelligenceResponse>('/intelligence/analyze');

      if (
        !intelligenceResponse.error &&
        intelligenceResponse.data?.analyzed_complaints
      ) {
        intelligenceMap = new Map(
          intelligenceResponse.data.analyzed_complaints.map((item) => [
            item.complaint_id,
            item,
          ])
        );
      }
    } catch (error) {
      /*
       * If Student 2 is temporarily unavailable, keep the complaints
       * visible instead of breaking the entire dashboard.
       */
      console.warn(
        'Student 2 intelligence analysis unavailable:',
        error
      );
    }

    /*
     * Merge the backend complaint with Student 2's analysis.
     */
    let complaints = backendComplaints.map((complaint) =>
      mapBackendComplaint(
        complaint,
        intelligenceMap.get(complaint.complaint_id)
      )
    );

    if (!filter) {
      return complaints;
    }

    /*
     * Search filter.
     */
    if (filter.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();

      complaints = complaints.filter(
        (c) =>
          c.complaint_id.toLowerCase().includes(q) ||
          c.text.toLowerCase().includes(q) ||
          c.customer_id.toLowerCase().includes(q) ||
          c.order_id.toLowerCase().includes(q) ||
          (c.issue_type &&
            c.issue_type.toLowerCase().includes(q)) ||
          (c.cluster &&
            c.cluster.toLowerCase().includes(q))
      );
    }

    /*
     * Issue type filter.
     */
    if (filter.issue_type && filter.issue_type !== 'All') {
      complaints = complaints.filter(
        (c) => c.issue_type === filter.issue_type
      );
    }

    /*
     * Severity filter.
     */
    if (filter.severity && filter.severity !== 'All') {
      complaints = complaints.filter(
        (c) => c.severity === filter.severity
      );
    }

    /*
     * Status filter.
     */
    if (filter.status && filter.status !== 'All') {
      complaints = complaints.filter(
        (c) => c.status === filter.status
      );
    }

    /*
     * Sentiment filter.
     */
    if (filter.sentiment && filter.sentiment !== 'All') {
      complaints = complaints.filter(
        (c) => c.sentiment === filter.sentiment
      );
    }

    return complaints;
  },

  async getComplaintById(
    complaintId: string
  ): Promise<Complaint | null> {
    const response = await api.get<BackendComplaint>(
      `/complaints/${complaintId}`
    );

    if (response.error) {
      if (response.status === 404) {
        return null;
      }

      throw new Error(response.error);
    }

    if (!response.data) {
      return null;
    }

    /*
     * Fetch Student 2 analysis so the individual complaint also
     * gets its real intelligence fields.
     */
    let intelligence: IntelligenceComplaint | undefined;

    try {
      const intelligenceResponse =
        await api.get<IntelligenceResponse>(
          '/intelligence/analyze'
        );

      intelligence =
        intelligenceResponse.data?.analyzed_complaints?.find(
          (item) => item.complaint_id === complaintId
        );
    } catch (error) {
      console.warn(
        'Student 2 intelligence unavailable for complaint:',
        error
      );
    }

    return mapBackendComplaint(response.data, intelligence);
  },

  async createComplaint(data: {
    text: string;
    customer_id: string;
    order_id: string;
    channel?: 'web' | 'email' | 'mobile' | 'whatsapp';
    attachment_url?: string;
  }): Promise<{ complaint: Complaint; case_id: string }> {
    const response = await api.post<BackendComplaint>(
  '/complaints',
  {
    customer_id: data.customer_id,
    order_id: data.order_id,
    text: data.text,
    timestamp: new Date().toISOString(),
  }
);

    if (response.error) {
      throw new Error(response.error);
    }

    if (!response.data) {
      throw new Error('Failed to create complaint');
    }

    const baseComplaint = mapBackendComplaint(
      response.data
    );

    /*
     * Keep the existing frontend fallback classification for
     * newly-created complaints.
     *
     * The backend/Student 2 analysis can be used after the
     * complaint is analyzed.
     */
    const classification = classifyComplaint(data.text);

    const enrichedComplaint: Complaint = {
      ...baseComplaint,

      channel: data.channel || 'web',

      clean_text: data.text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),

      issue_type: classification.issue_type,
      sentiment: classification.sentiment,
      severity: classification.severity,
      cluster: classification.cluster,

      status:
        classification.severity === 'High' ||
        classification.severity === 'Critical'
          ? 'Investigating'
          : 'New',

      attachment_url: data.attachment_url,
    };

    return {
      complaint: enrichedComplaint,
      case_id: '',
    };
  },
};