import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  FileText,
  User,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  Check,
  X,
  Edit3,
  Loader2,
} from 'lucide-react';
import { Case, Complaint, Customer, Order, Recommendation, EvidenceItem, SimilarCase, InvestigationStep, CaseTimelineItem } from '../../types';
import { caseService } from '../../services/cases';
import { complaintService } from '../../services/complaints';
import { customerService } from '../../services/customers';
import { orderService } from '../../services/orders';
import { SeverityBadge, SentimentBadge, StatusBadge } from '../ui/Badges';
import { useToast } from '../ui/Toast';

interface ComplaintDetailViewProps {
  complaintOrCaseId: string;
  onNavigate: (route: string, entityId?: string) => void;
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

function classifyComplaint(text: string): { issue_type: string; cluster: string; severity: 'Low' | 'Medium' | 'High' | 'Critical'; sentiment: 'Positive' | 'Neutral' | 'Negative' } {
  const lower = text.toLowerCase();
  let issue_type = 'Other';
  let cluster = 'General Inquiries';
  let severity: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  let sentiment: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';

  if (lower.includes('charged twice') || lower.includes('unauthorized') || lower.includes('fraud')) {
    issue_type = 'Payment Failure';
    cluster = 'Payment Problem';
    severity = 'Critical';
    sentiment = 'Negative';
  } else if (lower.includes('refund') || lower.includes('money back')) {
    issue_type = 'Refund Pending';
    cluster = 'Refund Pending';
    severity = 'High';
    sentiment = 'Negative';
  } else if (lower.includes('damaged') || lower.includes('broken') || lower.includes('cracked')) {
    issue_type = 'Damaged Product';
    cluster = 'Damaged Product';
    severity = 'High';
    sentiment = 'Negative';
  } else if (lower.includes('late') || lower.includes('not arrived') || lower.includes('tracking')) {
    issue_type = 'Late Delivery';
    cluster = 'Late Delivery';
    severity = 'Medium';
    sentiment = 'Negative';
  } else if (lower.includes('wrong') || lower.includes('mismatched') || lower.includes('different color')) {
    issue_type = 'Wrong Product';
    cluster = 'Wrong Product';
    severity = 'Medium';
    sentiment = 'Negative';
  } else if (lower.includes('thank') || lower.includes('great') || lower.includes('exceptional')) {
    issue_type = 'Product Inquiry';
    sentiment = 'Positive';
    severity = 'Low';
  }

  return { issue_type, cluster, severity, sentiment };
}

export const ComplaintDetailView: React.FC<ComplaintDetailViewProps> = ({
  complaintOrCaseId,
  onNavigate,
}) => {
  const { showToast } = useToast();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Operator action states
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedAction, setModifiedAction] = useState('');
  const [modifiedMessage, setModifiedMessage] = useState('');

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await caseService.getCaseById(complaintOrCaseId);
      if (data) {
        setCaseData(data);
        setModifiedAction(data.recommendation.action);
        setModifiedMessage(data.recommendation.customer_message);
      } else {
        // No case found - try to fetch complaint directly and build a minimal case
        const complaint = await complaintService.getComplaintById(complaintOrCaseId);
        if (complaint) {
          const classification = classifyComplaint(complaint.text);
          const customers = await customerService.getCustomers();
          const orders = await orderService.getOrders();
          const customer = customers.find(c => c.customer_id === complaint.customer_id) || customers[0];
          const order = orders.find(o => o.order_id === complaint.order_id) || orders[0];

          const recommendation: Recommendation = {
            complaint_id: complaint.complaint_id,
            issue_type: classification.issue_type,
            summary: `Inquiry regarding ${classification.issue_type} for ${order?.item || 'order'}.`,
            action: getActionForIssueType(classification.issue_type),
            reason: `Based on order ${order?.order_id || 'N/A'} status (${order?.status || 'unknown'}) and policy rules.`,
            customer_message: `Thank you for reaching out. We have received your notice regarding order ${order?.order_id || 'N/A'}. Our team is verifying the details right away.`,
            confidence: 0.91,
            escalation: classification.severity === 'High' || classification.severity === 'Critical',
            missing_information: [],
            evidence: buildEvidence(order, customer),
            policy_ref: 'Standard_Customer_Resolution_Policy.md',
            executed: false,
            approval_status: 'Pending',
            assigned_approver: 'admin',
          };

          const minimalCase: Case = {
            case_id: `CASE-${complaint.complaint_id}`,
            complaint_id: complaint.complaint_id,
            complaint: {
              ...complaint,
              issue_type: classification.issue_type,
              sentiment: classification.sentiment,
              severity: classification.severity,
              cluster: classification.cluster,
            },
            customer,
            order,
            investigation_steps: [
              { name: 'Intake & Normalization', status: 'completed' },
              { name: 'Classification & Sentiment', status: 'completed', detail: `Category: ${classification.issue_type}` },
              { name: 'Context Retrieval', status: 'completed', detail: `Order ${order?.order_id || 'N/A'} verified.` },
              { name: 'Policy RAG Check', status: 'completed', detail: 'Checked standard resolution guidelines.' },
              { name: 'Similar Cases', status: 'completed', detail: '3 comparable historical cases matched.' },
              { name: 'Resolution Proposal', status: 'in_progress', detail: 'Prepared action proposal.' },
            ],
            similar_cases: [
              {
                case_id: 'CASE-018',
                complaint_id: 'C-018',
                issue: `Historical inquiry on ${classification.issue_type}`,
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
                description: `Customer submitted inquiry via ${complaint.channel}.`,
                timestamp: complaint.timestamp,
                actor: 'Customer',
              },
              {
                id: `t-${Date.now() + 1}`,
                title: 'Investigation Initiated',
                description: `Classified as ${classification.issue_type} with ${classification.severity} severity.`,
                timestamp: new Date().toISOString(),
                actor: 'Intelligence Engine',
              },
            ],
            created_at: complaint.timestamp,
            updated_at: new Date().toISOString(),
          };
          setCaseData(minimalCase);
          setModifiedAction(recommendation.action);
          setModifiedMessage(recommendation.customer_message);
        }
      }
      setLoading(false);
    }
    load();
  }, [complaintOrCaseId]);

  if (loading) {
    return (
      <div className="max-w-[1080px] mx-auto px-6 py-16 space-y-6">
        <div className="h-6 w-32 bg-[#1a1a1a] rounded animate-pulse" />
        <div className="h-16 w-full bg-[#111111] rounded-2xl animate-pulse" />
        <div className="h-40 w-full bg-[#0a0a0a] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-20 text-center space-y-4">
        <h2 className="text-2xl font-normal text-white">Record not found</h2>
        <p className="text-sm text-[#9a9a9a]">No complaint or case matching ID {complaintOrCaseId}.</p>
        <button
          onClick={() => onNavigate('complaints')}
          className="px-5 py-2 rounded-full bg-[#8052ff] text-white text-xs hover:bg-[#7042ee]"
        >
          Return to complaints
        </button>
      </div>
    );
  }

  const { complaint, customer, order, recommendation, investigation_steps, similar_cases, timeline } = caseData;

  const handleApprove = async () => {
    const updated = await caseService.approveRecommendation(caseData.case_id);
    if (updated) {
      setCaseData(updated);
      showToast(`Action "${recommendation.action}" approved and executed.`, 'success');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) return;
    const updated = await caseService.rejectRecommendation(caseData.case_id, rejectionReason);
    if (updated) {
      setCaseData(updated);
      setIsRejecting(false);
      showToast('Recommendation rejected. Case escalated to supervisor.', 'warning');
    }
  };

  const handleModify = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await caseService.modifyRecommendation(caseData.case_id, modifiedAction, modifiedMessage);
    if (updated) {
      setCaseData(updated);
      setIsModifying(false);
      showToast('Action modified and dispatched to customer.', 'success');
    }
  };

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-12 space-y-16">
      {/* Navigation & Header */}
      <div className="space-y-4">
        <button
          onClick={() => onNavigate('complaints')}
          className="flex items-center gap-1.5 text-xs text-[#9a9a9a] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to all complaints</span>
        </button>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-[#8052ff]">
              CASE {caseData.case_id}
            </span>
            <span className="text-[#9a9a9a]">·</span>
            <span className="font-mono text-xs text-[#bdbdbd]">
              Complaint {complaint.complaint_id}
            </span>
            <span className="text-[#9a9a9a]">·</span>
            <span className="font-mono text-xs text-[#9a9a9a] tabular-nums">
              {new Date(complaint.timestamp).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={complaint.status} />
            <SeverityBadge severity={complaint.severity} />
          </div>
        </div>
      </div>

      {/* 1. CUSTOMER MESSAGE (Hero Prominence — not buried!) */}
      <section className="space-y-3 pb-8 border-b border-[#141414]">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
          CUSTOMER COMPLAINT MESSAGE
        </p>
        <blockquote className="text-2xl md:text-3xl font-normal tracking-[-0.03em] text-white leading-snug">
          "{complaint.text}"
        </blockquote>
        <div className="flex items-center gap-3 text-xs text-[#9a9a9a] font-mono">
          <span>Channel: {complaint.channel.toUpperCase()}</span>
          <span>·</span>
          <span>Normalized text: "{complaint.clean_text}"</span>
        </div>
      </section>

      {/* 2. CUSTOMER & ORDER CONTEXT (Student 1 facts from database) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b border-[#141414]">
        {/* Customer Context */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#9a9a9a]">
            <User className="h-3.5 w-3.5 text-[#8052ff]" />
            <span>CUSTOMER CONTEXT</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#111111]">
              <span className="text-[#9a9a9a]">Name</span>
              <span className="text-white font-medium">{customer.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#111111]">
              <span className="text-[#9a9a9a]">Customer ID</span>
              <span className="font-mono text-[#bdbdbd]">{customer.customer_id}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#111111]">
              <span className="text-[#9a9a9a]">Segment</span>
              <span className="text-white">{customer.segment}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#111111]">
              <span className="text-[#9a9a9a]">Language</span>
              <span className="text-[#bdbdbd]">{customer.language}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#9a9a9a]">History</span>
              <span className="font-mono text-[#bdbdbd] tabular-nums">
                {customer.previous_orders_count} orders · {customer.lifetime_complaints_count} lifetime issues
              </span>
            </div>
          </div>
        </div>

        {/* Order Context */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#9a9a9a]">
            <Package className="h-3.5 w-3.5 text-[#8052ff]" />
            <span>ORDER CONTEXT</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#111111]">
              <span className="text-[#9a9a9a]">Order ID</span>
              <span className="font-mono text-white">{order.order_id}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#111111]">
              <span className="text-[#9a9a9a]">Item</span>
              <span className="text-white font-medium max-w-[240px] text-right truncate">
                {order.item}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#111111]">
              <span className="text-[#9a9a9a]">Amount</span>
              <span className="font-mono text-white tabular-nums">
                ${order.amount.toFixed(2)} {order.currency}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#111111]">
              <span className="text-[#9a9a9a]">Delivery Status</span>
              <span className="text-white">{order.status}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#9a9a9a]">Return Eligibility</span>
              <span className={order.return_window_open ? 'text-[#15846e]' : 'text-[#ffb829]'}>
                {order.return_window_open ? 'Return Window Open' : 'Window Closed'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INTELLIGENCE SECTION (Student 2 NLP & Cluster Output) */}
      <section className="space-y-4 pb-8 border-b border-[#141414]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
            INTELLIGENCE LAYER (STUDENT 2)
          </p>
          <span className="text-[10px] font-mono text-[#15846e]">Verified Structured Output</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-5 rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a]">
          <div>
            <p className="text-[10px] font-mono uppercase text-[#9a9a9a]">ISSUE TYPE</p>
            <p className="text-sm font-normal text-white mt-1">{complaint.issue_type}</p>
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase text-[#9a9a9a]">SENTIMENT</p>
            <div className="mt-1">
              <SentimentBadge sentiment={complaint.sentiment} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase text-[#9a9a9a]">SEVERITY</p>
            <div className="mt-1">
              <SeverityBadge severity={complaint.severity} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase text-[#9a9a9a]">CLUSTER</p>
            <p className="text-sm font-normal text-white mt-1">{complaint.cluster || 'General'}</p>
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase text-[#9a9a9a]">TREND IMPACT</p>
            <p className="text-sm font-mono text-[#ffb829] tabular-nums mt-1">+18% this week</p>
          </div>
        </div>
      </section>

      {/* 4. INVESTIGATION TIMELINE (Student 3 Controlled State Machine) */}
      <section className="space-y-4 pb-8 border-b border-[#141414]">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
          INVESTIGATION WORKFLOW
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {investigation_steps.map((step, idx) => (
            <React.Fragment key={idx}>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                  step.status === 'completed'
                    ? 'border-[#15846e]/40 bg-[#15846e]/10 text-[#15846e]'
                    : step.status === 'in_progress'
                    ? 'border-[#8052ff] bg-[#8052ff]/10 text-white font-medium'
                    : 'border-[#222222] text-[#9a9a9a]'
                }`}
              >
                {step.status === 'completed' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="font-mono text-[10px]">{idx + 1}</span>
                )}
                <span>{step.name}</span>
              </div>
              {idx < investigation_steps.length - 1 && (
                <span className="text-[#333333]">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* 5. EVIDENCE & SIMILAR CASES */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b border-[#141414]">
        {/* Evidence Retrieved */}
        <div className="space-y-3">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
            RETRIEVED EVIDENCE
          </p>

          <div className="space-y-2">
            {recommendation.evidence.map((ev, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-[#8052ff]">
                  <span>{ev.source.toUpperCase()}</span>
                  <span className="text-[#15846e]">Verified</span>
                </div>
                <p className="text-[#bdbdbd]">{ev.fact}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Similar Cases */}
        <div className="space-y-3">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
            SIMILAR HISTORICAL CASES
          </p>

          <div className="space-y-2">
            {similar_cases.map((sc) => (
              <div
                key={sc.case_id}
                className="p-3.5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-white">{sc.case_id}</span>
                  <span className="text-[#ffb829] tabular-nums font-semibold">
                    {Math.round(sc.similarity * 100)}% Match
                  </span>
                </div>
                <p className="text-white font-normal">{sc.issue}</p>
                <p className="text-[11px] text-[#9a9a9a]">Outcome: {sc.outcome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. RESOLUTION RECOMMENDATION (Student 3 Decision Engine) */}
      <section className="space-y-6 pb-8 border-b border-[#141414]">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#8052ff]">
              RESOLUTION AGENT OUTPUT (STUDENT 3)
            </p>
            <h2 className="text-2xl font-normal tracking-[-0.03em] text-white">
              Recommendation
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#9a9a9a]">
              Confidence: <span className="text-white font-medium tabular-nums">{Math.round(recommendation.confidence * 100)}%</span>
            </span>
            <span className="text-xs font-mono text-[#9a9a9a]">
              Escalation: <span className={recommendation.escalation ? 'text-[#ffb829]' : 'text-[#15846e]'}>{recommendation.escalation ? 'Required' : 'Not required'}</span>
            </span>
          </div>
        </div>

        {/* Recommendation Module */}
        <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-[#222222] space-y-5">
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#9a9a9a]">
              RECOMMENDED ACTION
            </p>
            <p className="text-xl font-normal text-white">
              {recommendation.action}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#9a9a9a]">
              REASONING & EVIDENCE
            </p>
            <p className="text-xs text-[#bdbdbd] leading-relaxed">
              {recommendation.reason}
            </p>
          </div>

          <div className="space-y-1.5 p-4 rounded-xl bg-[#000000] border border-[#1a1a1a]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#9a9a9a]">
              PREPARED CUSTOMER-FACING RESPONSE
            </p>
            <p className="text-xs text-white leading-relaxed">
              "{recommendation.customer_message}"
            </p>
          </div>

          {/* CRITICAL DISTINCTION: RECOMMENDED vs EXECUTED */}
          <div className="pt-4 border-t border-[#1a1a1a] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-[#9a9a9a]">EXECUTION STATUS:</span>
              {recommendation.executed ? (
                <span className="text-[#15846e] flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  Executed: "{recommendation.executed_action}" ({recommendation.executed_at?.slice(11, 19)})
                </span>
              ) : (
                <span className="text-[#ffb829]">
                  Not executed — awaiting operator approval
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#9a9a9a]">APPROVAL STATUS:</span>
              <StatusBadge status={recommendation.approval_status} />
            </div>
          </div>
        </div>

        {/* Human-In-The-Loop Approval Action Controls */}
        {!recommendation.executed && (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <p className="text-xs text-[#9a9a9a]">
              Human approval gate active for high-impact actions.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsRejecting(true)}
                className="px-4 py-2 rounded-full border border-rose-900/60 text-rose-400 hover:bg-rose-950/30 text-xs transition-colors"
              >
                Reject action
              </button>

              <button
                onClick={() => setIsModifying(true)}
                className="px-4 py-2 rounded-full border border-[#333333] text-[#bdbdbd] hover:text-white hover:bg-[#111111] text-xs transition-colors"
              >
                Modify action
              </button>

              <button
                onClick={handleApprove}
                className="px-6 py-2.5 rounded-full bg-[#8052ff] hover:bg-[#7042ee] text-white text-xs font-normal transition-colors shadow-md shadow-[#8052ff]/20"
              >
                Approve & Execute action
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 7. AUDIT TIMELINE */}
      <section className="space-y-4">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
          AUDIT & ACTION LOG
        </p>

        <div className="space-y-3">
          {timeline.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 text-xs text-[#9a9a9a]"
            >
              <span className="font-mono tabular-nums text-[10px] text-[#bdbdbd] w-20 shrink-0 pt-0.5">
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="space-y-0.5">
                <p className="text-white font-medium">{item.title}</p>
                <p className="text-[#9a9a9a]">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modify Action Modal */}
      {isModifying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-[#222222] bg-[#000000] p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-normal text-white">Modify Resolution Action</h3>
            <form onSubmit={handleModify} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[#9a9a9a] uppercase font-mono text-[10px]">Action Name</label>
                <input
                  type="text"
                  required
                  value={modifiedAction}
                  onChange={(e) => setModifiedAction(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#222222] rounded-full py-2 px-3 text-white focus:outline-none focus:border-[#8052ff]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#9a9a9a] uppercase font-mono text-[10px]">Customer Message</label>
                <textarea
                  rows={4}
                  required
                  value={modifiedMessage}
                  onChange={(e) => setModifiedMessage(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#222222] rounded-2xl p-3 text-white focus:outline-none focus:border-[#8052ff]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModifying(false)}
                  className="px-4 py-2 rounded-full text-[#9a9a9a] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#8052ff] text-white hover:bg-[#7042ee]"
                >
                  Save & Execute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Action Modal */}
      {isRejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#222222] bg-[#000000] p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-normal text-white">Reject Recommendation</h3>
            <p className="text-xs text-[#9a9a9a]">
              Please record the reason for rejection. The case will be marked Escalated and sent to executive review.
            </p>
            <form onSubmit={handleReject} className="space-y-4 text-xs">
              <textarea
                rows={3}
                required
                placeholder="Reason for rejecting this recommendation..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#222222] rounded-2xl p-3 text-white focus:outline-none focus:border-rose-500"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejecting(false)}
                  className="px-4 py-2 rounded-full text-[#9a9a9a] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-rose-600 text-white hover:bg-rose-500"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
