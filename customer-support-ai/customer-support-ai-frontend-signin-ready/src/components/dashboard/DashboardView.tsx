import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ArrowRight,
  Filter,
  Plus,
  ArrowUpRight,
  Flame,
  Search,
} from 'lucide-react';
import { DashboardMetrics, TrendCluster, Complaint } from '../../types';
import { analyticsService } from '../../services/analytics';
import { complaintService } from '../../services/complaints';
import { TrendChart } from './TrendChart';
import { TrendDetailModal } from '../analytics/TrendDetailModal';
import { SeverityBadge, SentimentBadge, StatusBadge } from '../ui/Badges';

interface DashboardViewProps {
  onNavigate: (route: string, entityId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trends, setTrends] = useState<TrendCluster[]>([]);
  const [recentComplaints, setRecentComplaints] = useState<Complaint[]>([]);
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | '90D'>('7D');
  const [selectedTrend, setSelectedTrend] = useState<TrendCluster | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    async function loadData() {
      const [m, t, c] = await Promise.all([
        analyticsService.getDashboardMetrics(),
        analyticsService.getTrends(),
        complaintService.getComplaints(),
      ]);
      setMetrics(m);
      setTrends(t);
      setRecentComplaints(c.slice(0, 6));
    }
    loadData();
  }, []);

  const filteredComplaints = recentComplaints.filter((c) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.complaint_id.toLowerCase().includes(q) ||
      c.text.toLowerCase().includes(q) ||
      c.order_id.toLowerCase().includes(q) ||
      (c.issue_type && c.issue_type.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-16">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-[#141414]">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-normal tracking-[-0.03em] text-white">
            Overview
          </h1>
          <p className="text-sm font-normal text-[#9a9a9a] max-w-xl">
            Customer issues, emerging problems and resolution activity.
          </p>
        </div>

        <button
          onClick={() => onNavigate('new_complaint')}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#8052ff] text-white text-xs font-normal hover:bg-[#7042ee] transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New complaint</span>
        </button>
      </div>

      {/* Metrics Row (Typography-led, no heavy cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-2">
        <div className="space-y-1">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
            TOTAL TICKETS
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-normal font-mono tabular-nums text-white">
              {metrics ? metrics.total_tickets.toLocaleString() : '1,284'}
            </span>
            <span className="text-[11px] font-mono text-[#ffb829] tabular-nums">
              +8.4% this week
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
            OPEN TICKETS
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-normal font-mono tabular-nums text-white">
              {metrics ? metrics.open_tickets : '42'}
            </span>
            <span className="text-[11px] font-mono text-[#9a9a9a]">
              active triage
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
            HIGH SEVERITY
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-normal font-mono tabular-nums text-rose-400">
              {metrics ? metrics.high_severity_count : '14'}
            </span>
            <span className="text-[11px] font-mono text-[#9a9a9a]">
              priority queue
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
            ESCALATIONS
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-normal font-mono tabular-nums text-[#ffb829]">
              {metrics ? metrics.escalation_count : '9'}
            </span>
            <span className="text-[11px] font-mono text-[#9a9a9a]">
              require approval
            </span>
          </div>
        </div>
      </div>

      {/* Primary Trend Chart */}
      <section className="space-y-4">
        <TrendChart
          timeframe={timeframe}
          onTimeframeChange={(tf) => setTimeframe(tf)}
        />
      </section>

      {/* Emerging Issues Section */}
      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#ffb829]">
              INTELLIGENCE ENGINE
            </p>
            <h2 className="text-2xl font-normal tracking-[-0.03em] text-white">
              Emerging issues
            </h2>
          </div>
          <button
            onClick={() => onNavigate('analytics')}
            className="text-xs text-[#9a9a9a] hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>View all clusters</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Issue Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {trends.slice(0, 3).map((trend) => (
            <div
              key={trend.cluster_name}
              onClick={() => setSelectedTrend(trend)}
              className="p-5 rounded-2xl bg-[#000000] border border-[#1a1a1a] hover:border-[#333333] transition-all cursor-pointer group flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#9a9a9a]">
                    {trend.category}
                  </span>
                  <h3 className="text-base font-normal text-white group-hover:text-[#8052ff] transition-colors">
                    {trend.cluster_name}
                  </h3>
                </div>

                <SeverityBadge severity={trend.severity} />
              </div>

              <div className="flex items-baseline justify-between pt-2 border-t border-[#141414]">
                <div>
                  <span className="text-lg font-mono tabular-nums text-white">
                    {trend.count}
                  </span>
                  <span className="text-[11px] text-[#9a9a9a] ml-1">complaints</span>
                </div>

                <span
                  className={`text-xs font-mono tabular-nums flex items-center gap-1 ${
                    trend.growth_percent > 0 ? 'text-[#ffb829]' : 'text-[#15846e]'
                  }`}
                >
                  <TrendingUp className="h-3 w-3" />
                  {trend.growth_percent > 0 ? `+${trend.growth_percent}%` : `${trend.growth_percent}%`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Complaints Table */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-xl font-normal tracking-[-0.03em] text-white">
              Recent complaints
            </h2>
            <p className="text-xs text-[#9a9a9a]">
              Direct customer inbound signals with automated classification.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#9a9a9a]" />
              <input
                type="text"
                placeholder="Filter recent..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-[#0a0a0a] border border-[#222222] rounded-full py-1.5 pl-8 pr-3 text-xs text-white placeholder-[#9a9a9a] focus:outline-none focus:border-[#8052ff] w-48"
              />
            </div>
            <button
              onClick={() => onNavigate('complaints')}
              className="text-xs text-[#8052ff] hover:text-[#9e7bff] flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <span>View all ({recentComplaints.length})</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Clean Table Surface */}
        <div className="w-full overflow-x-auto rounded-2xl border border-[#1a1a1a] bg-[#000000]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-[#9a9a9a] font-mono text-[10px] uppercase">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Issue</th>
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Sentiment</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]">
              {filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#9a9a9a]">
                    No complaints match your query.
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((c) => (
                  <tr
                    key={c.complaint_id}
                    onClick={() => onNavigate('complaint_detail', c.complaint_id)}
                    className="hover:bg-[#0a0a0a] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono text-white tabular-nums">
                      {c.complaint_id}
                    </td>
                    <td className="py-3.5 px-4 text-[#bdbdbd]">
                      {c.customer_id}
                    </td>
                    <td className="py-3.5 px-4 text-white font-normal max-w-xs truncate">
                      {c.issue_type || c.text}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#9a9a9a] tabular-nums">
                      {c.order_id}
                    </td>
                    <td className="py-3.5 px-4">
                      <SentimentBadge sentiment={c.sentiment} />
                    </td>
                    <td className="py-3.5 px-4">
                      <SeverityBadge severity={c.severity} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[#8052ff] group-hover:translate-x-0.5 inline-flex items-center gap-1 transition-transform">
                        Investigate <ArrowRight className="h-3 w-3" />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Trend Detail Modal */}
      <TrendDetailModal
        trend={selectedTrend}
        onClose={() => setSelectedTrend(null)}
        onViewComplaints={(clusterName) => onNavigate('complaints', clusterName)}
      />
    </div>
  );
};
