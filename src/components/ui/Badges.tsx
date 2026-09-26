import React from 'react';
import { Severity, Sentiment, ComplaintStatus, ApprovalStatus } from '../../types';

export const SeverityBadge: React.FC<{ severity?: Severity }> = ({ severity = 'Low' }) => {
  const styles: Record<Severity, { dot: string; text: string; label: string }> = {
    Low: { dot: 'bg-slate-400', text: 'text-[#bdbdbd]', label: 'Low' },
    Medium: { dot: 'bg-[#ffb829]', text: 'text-[#ffb829]', label: 'Medium' },
    High: { dot: 'bg-rose-400', text: 'text-rose-400', label: 'High' },
    Critical: { dot: 'bg-rose-500 animate-pulse', text: 'text-rose-400', label: 'Critical' },
  };

  const current = styles[severity] || styles.Low;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums">
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      <span className={current.text}>{current.label}</span>
    </span>
  );
};

export const SentimentBadge: React.FC<{ sentiment?: Sentiment }> = ({ sentiment = 'Neutral' }) => {
  const styles: Record<Sentiment, { text: string; label: string }> = {
    Positive: { text: 'text-[#15846e]', label: 'Positive' },
    Neutral: { text: 'text-[#9a9a9a]', label: 'Neutral' },
    Negative: { text: 'text-[#ffb829]', label: 'Negative' },
  };

  const current = styles[sentiment] || styles.Neutral;

  return (
    <span className={`text-xs font-mono tabular-nums ${current.text}`}>
      {current.label}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: ComplaintStatus | ApprovalStatus }> = ({ status }) => {
  const styles: Record<string, { border: string; text: string }> = {
    New: { border: 'border-slate-800', text: 'text-[#ffffff]' },
    Investigating: { border: 'border-[#8052ff]/40', text: 'text-[#8052ff]' },
    'Pending Approval': { border: 'border-[#ffb829]/40', text: 'text-[#ffb829]' },
    Pending: { border: 'border-[#ffb829]/40', text: 'text-[#ffb829]' },
    Resolved: { border: 'border-[#15846e]/40', text: 'text-[#15846e]' },
    Approved: { border: 'border-[#15846e]/40', text: 'text-[#15846e]' },
    Modified: { border: 'border-[#8052ff]/40', text: 'text-[#8052ff]' },
    Rejected: { border: 'border-rose-900/60', text: 'text-rose-400' },
    Escalated: { border: 'border-rose-900/60', text: 'text-rose-400' },
  };

  const current = styles[status] || { border: 'border-slate-800', text: 'text-[#ffffff]' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-mono tracking-tight ${current.border} ${current.text} bg-black/60`}>
      {status}
    </span>
  );
};
