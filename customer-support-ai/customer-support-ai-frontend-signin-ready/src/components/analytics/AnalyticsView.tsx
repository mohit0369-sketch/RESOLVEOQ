import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Layers,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import { TrendCluster, DashboardMetrics } from '../../types';
import { analyticsService } from '../../services/analytics';
import { TrendChart } from '../dashboard/TrendChart';
import { TrendDetailModal } from './TrendDetailModal';
import { SeverityBadge } from '../ui/Badges';

interface AnalyticsViewProps {
  onNavigate: (route: string, entityId?: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onNavigate }) => {
  const [trends, setTrends] = useState<TrendCluster[]>([]);
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | '90D'>('30D');
  const [selectedTrend, setSelectedTrend] = useState<TrendCluster | null>(null);

  useEffect(() => {
    async function load() {
      const data = await analyticsService.getTrends();
      setTrends(data);
    }
    load();
  }, []);

  const categoryMix = [
    { name: 'Billing & Payments', count: 262, percent: 38 },
    { name: 'Logistics & Delivery', count: 246, percent: 35 },
    { name: 'Quality & Packaging', count: 112, percent: 16 },
    { name: 'Fulfillment & Warehouse', count: 64, percent: 11 },
  ];

  const sentimentMix = [
    { name: 'Negative', percent: 74, color: '#ffb829' },
    { name: 'Neutral', percent: 18, color: '#9a9a9a' },
    { name: 'Positive', percent: 8, color: '#15846e' },
  ];

  const severityMix = [
    { name: 'High / Critical', percent: 38, color: '#f43f5e' },
    { name: 'Medium', percent: 45, color: '#ffb829' },
    { name: 'Low', percent: 17, color: '#9a9a9a' },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-16">
      {/* Header */}
      <div className="space-y-2 pb-6 border-b border-[#141414]">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[#8052ff]">
          STUDENT 2 INTELLIGENCE ENGINE OUTPUT
        </p>
        <h1 className="text-4xl md:text-5xl font-normal tracking-[-0.03em] text-white">
          Complaint intelligence
        </h1>
        <p className="text-sm font-normal text-[#9a9a9a] max-w-xl">
          Semantic clustering, anomaly detection, and recurring problem growth rates across thousands of normalized tickets.
        </p>
      </div>

      {/* Main Volume Chart */}
      <section className="space-y-4">
        <TrendChart
          timeframe={timeframe}
          onTimeframeChange={(tf) => setTimeframe(tf)}
        />
      </section>

      {/* Distribution Grids */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Category Mix */}
        <div className="space-y-4 p-6 rounded-3xl border border-[#1a1a1a] bg-[#000000]">
          <h3 className="text-xs uppercase font-mono tracking-wider text-[#9a9a9a]">
            Issue Category Distribution
          </h3>
          <p className="text-xs text-[#bdbdbd]">
            Which domains contribute the highest customer complaint friction?
          </p>

          <div className="space-y-3 pt-2">
            {categoryMix.map((cat) => (
              <div key={cat.name} className="space-y-1 text-xs">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-white">{cat.name}</span>
                  <span className="text-[#9a9a9a] tabular-nums">{cat.percent}% ({cat.count})</span>
                </div>
                <div className="h-1.5 w-full bg-[#111111] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#8052ff]"
                    style={{ width: `${cat.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment Distribution */}
        <div className="space-y-4 p-6 rounded-3xl border border-[#1a1a1a] bg-[#000000]">
          <h3 className="text-xs uppercase font-mono tracking-wider text-[#9a9a9a]">
            Sentiment Polarity Mix
          </h3>
          <p className="text-xs text-[#bdbdbd]">
            Emotional tone extracted by NLP text classification.
          </p>

          <div className="space-y-3 pt-2">
            {sentimentMix.map((s) => (
              <div key={s.name} className="space-y-1 text-xs">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-white">{s.name}</span>
                  <span className="text-[#9a9a9a] tabular-nums">{s.percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#111111] rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${s.percent}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="space-y-4 p-6 rounded-3xl border border-[#1a1a1a] bg-[#000000]">
          <h3 className="text-xs uppercase font-mono tracking-wider text-[#9a9a9a]">
            Severity & Urgency Mix
          </h3>
          <p className="text-xs text-[#bdbdbd]">
            Business risk priority assigned to incoming signals.
          </p>

          <div className="space-y-3 pt-2">
            {severityMix.map((sev) => (
              <div key={sev.name} className="space-y-1 text-xs">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-white">{sev.name}</span>
                  <span className="text-[#9a9a9a] tabular-nums">{sev.percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#111111] rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${sev.percent}%`, backgroundColor: sev.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Semantic Problem Clusters Table */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-normal tracking-[-0.03em] text-white">
            Recurring problem clusters
          </h2>
          <p className="text-xs text-[#9a9a9a]">
            Grouped semantically by vector embeddings. Click any cluster to inspect representative customer messages and contributing hypotheses.
          </p>
        </div>

        <div className="w-full overflow-x-auto rounded-2xl border border-[#1a1a1a] bg-[#000000]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-[#9a9a9a] font-mono text-[10px] uppercase">
                <th className="py-3 px-4">Cluster Name</th>
                <th className="py-3 px-4">Domain Category</th>
                <th className="py-3 px-4">Complaint Volume</th>
                <th className="py-3 px-4">Growth % (7D)</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Hypotheses</th>
                <th className="py-3 px-4 text-right">Drill down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]">
              {trends.map((t) => (
                <tr
                  key={t.cluster_name}
                  onClick={() => setSelectedTrend(t)}
                  className="hover:bg-[#0a0a0a] transition-colors cursor-pointer group"
                >
                  <td className="py-4 px-4 font-normal text-white">
                    {t.cluster_name}
                  </td>
                  <td className="py-4 px-4 text-[#9a9a9a]">
                    {t.category}
                  </td>
                  <td className="py-4 px-4 font-mono text-white tabular-nums">
                    {t.count}
                  </td>
                  <td className="py-4 px-4 font-mono tabular-nums">
                    <span
                      className={`flex items-center gap-1 ${
                        t.growth_percent > 0 ? 'text-[#ffb829]' : 'text-[#15846e]'
                      }`}
                    >
                      <TrendingUp className="h-3 w-3" />
                      {t.growth_percent > 0 ? `+${t.growth_percent}%` : `${t.growth_percent}%`}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <SeverityBadge severity={t.severity} />
                  </td>
                  <td className="py-4 px-4 text-[#bdbdbd] max-w-xs truncate">
                    {t.hypotheses[0] || 'Investigation pending'}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-[#8052ff] group-hover:translate-x-0.5 inline-flex items-center gap-1 transition-transform">
                      Inspect <ArrowRight className="h-3 w-3" />
                    </span>
                  </td>
                </tr>
              ))}
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
