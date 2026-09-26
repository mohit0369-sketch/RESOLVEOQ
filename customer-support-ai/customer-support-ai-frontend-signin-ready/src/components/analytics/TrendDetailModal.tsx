import React from 'react';
import { X, TrendingUp, AlertTriangle, Lightbulb, MessageSquare, ArrowUpRight } from 'lucide-react';
import { TrendCluster } from '../../types';
import { SeverityBadge } from '../ui/Badges';

interface TrendDetailModalProps {
  trend: TrendCluster | null;
  onClose: () => void;
  onViewComplaints: (clusterName: string) => void;
}

export const TrendDetailModal: React.FC<TrendDetailModalProps> = ({
  trend,
  onClose,
  onViewComplaints,
}) => {
  if (!trend) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl border border-[#222222] bg-[#000000] p-7 space-y-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#9a9a9a]">
              <span>CLUSTER DETAIL</span>
              <span>·</span>
              <span className="text-[#8052ff]">{trend.category}</span>
            </div>
            <h2 className="text-2xl font-normal tracking-[-0.03em] text-white">
              {trend.cluster_name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#9a9a9a] hover:text-white hover:bg-[#141414] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 p-4 rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a]">
          <div>
            <p className="text-[11px] font-mono text-[#9a9a9a]">TOTAL COMPLAINTS</p>
            <p className="text-xl font-mono tabular-nums text-white mt-1">
              {trend.count}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-mono text-[#9a9a9a]">7-DAY GROWTH</p>
            <p className={`text-xl font-mono tabular-nums mt-1 flex items-center gap-1 ${
              trend.growth_percent > 0 ? 'text-[#ffb829]' : 'text-[#15846e]'
            }`}>
              <TrendingUp className="h-4 w-4" />
              {trend.growth_percent > 0 ? `+${trend.growth_percent}%` : `${trend.growth_percent}%`}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-mono text-[#9a9a9a]">SEVERITY</p>
            <div className="mt-1.5">
              <SeverityBadge severity={trend.severity} />
            </div>
          </div>
        </div>

        {/* Contributing Factors (Hypotheses) */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-mono text-[#ffb829]">
            <Lightbulb className="h-4 w-4" />
            <span>POSSIBLE CONTRIBUTING FACTORS (HYPOTHESES)</span>
          </div>
          <p className="text-[11px] text-[#9a9a9a]">
            These correlation signals are generated as investigation hypotheses, not confirmed root causes.
          </p>

          <div className="space-y-2">
            {trend.hypotheses.map((hyp, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-[#0e0e0e] border border-white/5 text-xs text-[#bdbdbd] flex items-start gap-2.5"
              >
                <span className="text-[#8052ff] font-mono">0{i + 1}.</span>
                <span>{hyp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Representative Complaints */}
        <div className="space-y-2.5">
          <p className="text-xs font-mono text-[#9a9a9a]">REPRESENTATIVE COMPLAINT EXAMPLES</p>
          <div className="space-y-2">
            {trend.representative_complaints.map((c, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-[#ffffff] font-normal"
              >
                "{c}"
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1a1a1a]">
          <span className="text-xs text-[#9a9a9a]">
            Signal detection: Student 2 Intelligence Engine
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs text-[#9a9a9a] hover:text-white"
            >
              Close
            </button>
            <button
              onClick={() => {
                onViewComplaints(trend.cluster_name);
                onClose();
              }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#8052ff] text-white text-xs hover:bg-[#7042ee] transition-colors"
            >
              <span>View related complaints</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
