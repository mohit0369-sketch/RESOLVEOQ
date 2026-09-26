import React, { useState, useEffect } from 'react';
import { Search, Filter, ArrowRight, RotateCcw, Plus } from 'lucide-react';
import { Complaint, Severity, ComplaintStatus, Sentiment } from '../../types';
import { complaintService } from '../../services/complaints';
import { SeverityBadge, SentimentBadge, StatusBadge } from '../ui/Badges';

interface ComplaintListViewProps {
  onNavigate: (route: string, entityId?: string) => void;
  initialFilterCluster?: string;
}

export const ComplaintListView: React.FC<ComplaintListViewProps> = ({
  onNavigate,
  initialFilterCluster,
}) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [search, setSearch] = useState(initialFilterCluster || '');
  const [selectedIssueType, setSelectedIssueType] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'All'>('All');
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus | 'All'>('All');
  const [selectedSentiment, setSelectedSentiment] = useState<Sentiment | 'All'>('All');

  useEffect(() => {
    async function load() {
      const data = await complaintService.getComplaints({
        search,
        issue_type: selectedIssueType,
        severity: selectedSeverity,
        status: selectedStatus,
        sentiment: selectedSentiment,
      });
      setComplaints(data);
    }
    load();
  }, [search, selectedIssueType, selectedSeverity, selectedStatus, selectedSentiment]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedIssueType('All');
    setSelectedSeverity('All');
    setSelectedStatus('All');
    setSelectedSentiment('All');
  };

  const isFiltered =
    search !== '' ||
    selectedIssueType !== 'All' ||
    selectedSeverity !== 'All' ||
    selectedStatus !== 'All' ||
    selectedSentiment !== 'All';

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-[#141414]">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-normal tracking-[-0.03em] text-white">
            Complaints
          </h1>
          <p className="text-sm font-normal text-[#9a9a9a]">
            Review and investigate incoming customer issues.
          </p>
        </div>

        <button
          onClick={() => onNavigate('new_complaint')}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#8052ff] text-white text-xs font-normal hover:bg-[#7042ee] transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New complaint</span>
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-[#9a9a9a]" />
            <input
              type="text"
              placeholder="Search complaints, IDs, text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded-full py-2 pl-9 pr-4 text-xs text-white placeholder-[#9a9a9a] focus:outline-none focus:border-[#8052ff] transition-colors"
            />
          </div>

          {/* Issue Type */}
          <div>
            <select
              value={selectedIssueType}
              onChange={(e) => setSelectedIssueType(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded-full py-2 px-3 text-xs text-white focus:outline-none focus:border-[#8052ff]"
            >
              <option value="All">All Categories</option>
              <option value="Damaged Product">Damaged Product</option>
              <option value="Late Delivery">Late Delivery</option>
              <option value="Refund Pending">Refund Pending</option>
              <option value="Payment Failure">Payment Failure</option>
              <option value="Wrong Product">Wrong Product</option>
              <option value="Product Inquiry">Product Inquiry</option>
            </select>
          </div>

          {/* Severity */}
          <div>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as any)}
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded-full py-2 px-3 text-xs text-white focus:outline-none focus:border-[#8052ff]"
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded-full py-2 px-3 text-xs text-white focus:outline-none focus:border-[#8052ff]"
            >
              <option value="All">All Statuses</option>
              <option value="New">New</option>
              <option value="Investigating">Investigating</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Filter stats & Reset */}
        <div className="flex items-center justify-between text-xs text-[#9a9a9a] pt-1">
          <span className="font-mono tabular-nums">
            Showing {complaints.length} records
          </span>

          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-[#ffb829] hover:underline"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Clean Table Surface */}
      <div className="w-full overflow-x-auto rounded-2xl border border-[#1a1a1a] bg-[#000000]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-[#9a9a9a] font-mono text-[10px] uppercase">
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Issue Category</th>
              <th className="py-3 px-4">Complaint Snippet</th>
              <th className="py-3 px-4">Order</th>
              <th className="py-3 px-4">Sentiment</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]">
            {complaints.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-[#9a9a9a]">
                  No complaints match these filters.
                </td>
              </tr>
            ) : (
              complaints.map((c) => (
                <tr
                  key={c.complaint_id}
                  onClick={() => onNavigate('complaint_detail', c.complaint_id)}
                  className="hover:bg-[#0a0a0a] transition-colors cursor-pointer group"
                >
                  <td className="py-4 px-4 font-mono text-white tabular-nums">
                    {c.complaint_id}
                  </td>
                  <td className="py-4 px-4 text-[#bdbdbd] font-mono tabular-nums">
                    {c.customer_id}
                  </td>
                  <td className="py-4 px-4 text-white font-medium">
                    {c.issue_type || 'Unclassified'}
                  </td>
                  <td className="py-4 px-4 text-[#9a9a9a] max-w-sm truncate font-normal">
                    {c.text}
                  </td>
                  <td className="py-4 px-4 font-mono text-[#9a9a9a] tabular-nums">
                    {c.order_id}
                  </td>
                  <td className="py-4 px-4">
                    <SentimentBadge sentiment={c.sentiment} />
                  </td>
                  <td className="py-4 px-4">
                    <SeverityBadge severity={c.severity} />
                  </td>
                  <td className="py-4 px-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-[#8052ff] group-hover:translate-x-0.5 inline-flex items-center gap-1 transition-transform">
                      View <ArrowRight className="h-3 w-3" />
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
