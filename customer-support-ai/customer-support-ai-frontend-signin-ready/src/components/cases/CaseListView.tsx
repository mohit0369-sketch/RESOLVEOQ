import React, { useState, useEffect } from 'react';
import { Briefcase, ArrowRight, Search, CheckCircle } from 'lucide-react';
import { Case, ComplaintStatus } from '../../types';
import { caseService } from '../../services/cases';
import { SeverityBadge, StatusBadge } from '../ui/Badges';

interface CaseListViewProps {
  onNavigate: (route: string, entityId?: string) => void;
}

export const CaseListView: React.FC<CaseListViewProps> = ({ onNavigate }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'All'>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const data = await caseService.getCases({ status: statusFilter });
      setCases(data);
    }
    load();
  }, [statusFilter]);

  const filteredCases = cases.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.case_id.toLowerCase().includes(q) ||
      c.complaint_id.toLowerCase().includes(q) ||
      c.customer.name.toLowerCase().includes(q) ||
      c.recommendation.action.toLowerCase().includes(q) ||
      (c.complaint.issue_type && c.complaint.issue_type.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-[#141414]">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-normal tracking-[-0.03em] text-white">
            Case history
          </h1>
          <p className="text-sm font-normal text-[#9a9a9a]">
            Structured investigations, evidence packs, and decision records.
          </p>
        </div>

        {/* Status segmented filters */}
        <div className="flex items-center gap-1 bg-[#0a0a0a] border border-[#222222] p-1 rounded-full text-xs">
          {(['All', 'Investigating', 'Pending Approval', 'Resolved', 'Escalated'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full font-mono text-[11px] transition-colors ${
                statusFilter === s
                  ? 'bg-[#8052ff] text-white font-medium'
                  : 'text-[#9a9a9a] hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-[#9a9a9a]" />
        <input
          type="text"
          placeholder="Search cases, customers, actions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0a0a0a] border border-[#222222] rounded-full py-2 pl-9 pr-4 text-xs text-white placeholder-[#9a9a9a] focus:outline-none focus:border-[#8052ff]"
        />
      </div>

      {/* Cases Table */}
      <div className="w-full overflow-x-auto rounded-2xl border border-[#1a1a1a] bg-[#000000]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-[#9a9a9a] font-mono text-[10px] uppercase">
              <th className="py-3 px-4">Case ID</th>
              <th className="py-3 px-4">Complaint</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Issue</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Recommended Action</th>
              <th className="py-3 px-4">Execution Status</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]">
            {filteredCases.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-[#9a9a9a]">
                  No cases match your filters.
                </td>
              </tr>
            ) : (
              filteredCases.map((c) => (
                <tr
                  key={c.case_id}
                  onClick={() => onNavigate('case_detail', c.case_id)}
                  className="hover:bg-[#0a0a0a] transition-colors cursor-pointer group"
                >
                  <td className="py-4 px-4 font-mono text-white tabular-nums">
                    {c.case_id}
                  </td>
                  <td className="py-4 px-4 font-mono text-[#9a9a9a] tabular-nums">
                    {c.complaint_id}
                  </td>
                  <td className="py-4 px-4 text-[#bdbdbd]">
                    {c.customer.name}
                  </td>
                  <td className="py-4 px-4 text-white font-medium">
                    {c.complaint.issue_type}
                  </td>
                  <td className="py-4 px-4">
                    <SeverityBadge severity={c.complaint.severity} />
                  </td>
                  <td className="py-4 px-4 text-[#bdbdbd]">
                    {c.recommendation.action}
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px]">
                    {c.recommendation.executed ? (
                      <span className="text-[#15846e]">Executed</span>
                    ) : (
                      <span className="text-[#ffb829]">Pending Approval</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <StatusBadge status={c.complaint.status} />
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-[#8052ff] group-hover:translate-x-0.5 inline-flex items-center gap-1 transition-transform">
                      Open <ArrowRight className="h-3 w-3" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
