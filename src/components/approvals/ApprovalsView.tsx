import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Check, X, Edit3, ArrowRight, ShieldCheck } from 'lucide-react';
import { Case } from '../../types';
import { caseService } from '../../services/cases';
import { SeverityBadge, StatusBadge } from '../ui/Badges';
import { useToast } from '../ui/Toast';

interface ApprovalsViewProps {
  onNavigate: (route: string, entityId?: string) => void;
  onApprovalsCountChange?: (count: number) => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  onNavigate,
  onApprovalsCountChange,
}) => {
  const { showToast } = useToast();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  // Rejection modal
  const [rejectingCaseId, setRejectingCaseId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    const all = await caseService.getCases();
    // Filter cases pending human approval where action is not executed yet
    const pending = all.filter((c) => !c.recommendation.executed && c.recommendation.approval_status === 'Pending');
    setCases(pending);
    if (onApprovalsCountChange) {
      onApprovalsCountChange(pending.length);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (caseId: string, actionName: string) => {
    const updated = await caseService.approveRecommendation(caseId);
    if (updated) {
      showToast(`Action approved: "${actionName}". Executed in backend.`, 'success');
      loadData();
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingCaseId || !rejectionReason.trim()) return;

    const updated = await caseService.rejectRecommendation(rejectingCaseId, rejectionReason);
    if (updated) {
      showToast('Recommendation rejected. Case routed to manual supervisor queue.', 'warning');
      setRejectingCaseId(null);
      setRejectionReason('');
      loadData();
    }
  };

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-[#141414]">
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#ffb829]">
            HUMAN APPROVAL GATE
          </p>
          <h1 className="text-4xl md:text-5xl font-normal tracking-[-0.03em] text-white">
            Pending approvals
          </h1>
          <p className="text-sm font-normal text-[#9a9a9a]">
            Review high-impact actions before execution. Autonomous actions are held behind authorization boundaries.
          </p>
        </div>

        <div className="text-xs font-mono text-[#9a9a9a]">
          Queue: <span className="text-white font-medium tabular-nums">{cases.length} pending</span>
        </div>
      </div>

      {/* Approvals List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-[#9a9a9a]">Loading approval queue...</div>
        ) : cases.length === 0 ? (
          <div className="p-16 rounded-3xl border border-[#1a1a1a] bg-[#000000] text-center space-y-3">
            <ShieldCheck className="mx-auto h-8 w-8 text-[#15846e]" />
            <h3 className="text-lg font-normal text-white">Zero pending approvals</h3>
            <p className="text-xs text-[#9a9a9a] max-w-sm mx-auto">
              All high-impact customer resolutions have been reviewed and executed.
            </p>
          </div>
        ) : (
          cases.map((c) => (
            <div
              key={c.case_id}
              className="p-6 rounded-3xl border border-[#1a1a1a] hover:border-[#2a2a2a] bg-[#000000] transition-colors space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-white font-medium">{c.case_id}</span>
                  <span className="text-[#9a9a9a]">·</span>
                  <span className="text-[#bdbdbd]">{c.customer.name} ({c.customer.segment})</span>
                  <span className="text-[#9a9a9a]">·</span>
                  <span className="text-[#9a9a9a]">Order {c.order.order_id} (${c.order.amount.toFixed(2)})</span>
                </div>

                <div className="flex items-center gap-2">
                  <SeverityBadge severity={c.complaint.severity} />
                  <span className="text-xs font-mono text-[#9a9a9a]">
                    Confidence: <span className="text-white font-medium tabular-nums">{Math.round(c.recommendation.confidence * 100)}%</span>
                  </span>
                </div>
              </div>

              {/* Customer Complaint Text */}
              <blockquote className="text-sm font-normal text-[#ffffff] bg-[#0a0a0a] p-3.5 rounded-xl border border-[#141414]">
                "{c.complaint.text}"
              </blockquote>

              {/* Recommended Action & Reason */}
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#8052ff]">
                  RECOMMENDED ACTION
                </p>
                <p className="text-lg font-normal text-white">
                  {c.recommendation.action}
                </p>
                <p className="text-xs text-[#9a9a9a] leading-relaxed">
                  {c.recommendation.reason}
                </p>
              </div>

              {/* Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#141414]">
                <button
                  onClick={() => onNavigate('case_detail', c.case_id)}
                  className="text-xs text-[#9a9a9a] hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>Inspect full evidence & context</span>
                  <ArrowRight className="h-3 w-3" />
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => {
                      setRejectingCaseId(c.case_id);
                      setRejectionReason('');
                    }}
                    className="px-4 py-2 rounded-full border border-rose-900/40 text-rose-400 hover:bg-rose-950/20 text-xs transition-colors"
                  >
                    Reject
                  </button>

                  <button
                    onClick={() => onNavigate('case_detail', c.case_id)}
                    className="px-4 py-2 rounded-full border border-[#2a2a2a] text-[#bdbdbd] hover:text-white text-xs transition-colors"
                  >
                    Modify
                  </button>

                  <button
                    onClick={() => handleApprove(c.case_id, c.recommendation.action)}
                    className="px-5 py-2 rounded-full bg-[#8052ff] hover:bg-[#7042ee] text-white text-xs font-normal transition-colors"
                  >
                    Approve action
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject Modal */}
      {rejectingCaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#222222] bg-[#000000] p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-normal text-white">Confirm Rejection</h3>
            <p className="text-xs text-[#9a9a9a]">
              Please state why this recommendation is being rejected before escalating to manual human review.
            </p>
            <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
              <textarea
                rows={3}
                required
                placeholder="Reason for rejection (e.g. Fraud flag check required, or return window expired)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#222222] rounded-2xl p-3 text-white focus:outline-none focus:border-rose-500"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingCaseId(null)}
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
