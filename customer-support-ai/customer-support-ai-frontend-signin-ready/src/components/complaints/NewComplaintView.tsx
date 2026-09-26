import React, { useState } from 'react';
import {
  Upload,
  ArrowRight,
  CheckCircle2,
  FileText,
  AlertCircle,
  Clock,
  Sparkles,
  Paperclip,
} from 'lucide-react';
import { complaintService } from '../../services/complaints';
import { useToast } from '../ui/Toast';

interface NewComplaintViewProps {
  onNavigate: (route: string, entityId?: string) => void;
}

export const NewComplaintView: React.FC<NewComplaintViewProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [complaintText, setComplaintText] = useState('');
  const [customerId, setCustomerId] = useState('U101');
  const [orderId, setOrderId] = useState('O501');
  const [channel, setChannel] = useState<'web' | 'email' | 'mobile' | 'whatsapp'>('web');
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  // Submission pipeline states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStep, setProcessingStep] = useState<number>(0);

  const processingSteps = [
    'Receiving complaint & stripping PII',
    'Classifying intent, sentiment & severity (Student 2)',
    'Synthesizing evidence & RAG retrieval (Student 3)',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintText.trim()) return;

    setIsSubmitting(true);
    setProcessingStep(0);

    // Realistic multi-step pipeline simulation
    setTimeout(() => setProcessingStep(1), 700);
    setTimeout(() => setProcessingStep(2), 1400);

    setTimeout(async () => {
      try {
        const { complaint, case_id } = await complaintService.createComplaint({
          text: complaintText.trim(),
          customer_id: customerId,
          order_id: orderId,
          channel,
          attachment_url: attachmentName ? `https://storage.mock.io/${attachmentName}` : undefined,
        });

        setIsSubmitting(false);
        showToast(`Complaint ${complaint.complaint_id} ingested successfully.`, 'success');
        onNavigate('complaint_detail', complaint.complaint_id);
      } catch (err) {
        setIsSubmitting(false);
        showToast('Failed to create complaint. Please try again.', 'warning');
      }
    }, 2200);
  };

  const handleSampleClick = (sampleText: string, sampleOrderId: string, sampleCustId: string) => {
    setComplaintText(sampleText);
    setOrderId(sampleOrderId);
    setCustomerId(sampleCustId);
  };

  return (
    <div className="max-w-[760px] mx-auto px-6 py-16 space-y-12">
      {/* Editorial Header */}
      <div className="space-y-3">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[#8052ff]">
          COMPLAINT INTAKE
        </p>
        <h1 className="text-4xl md:text-5xl font-normal tracking-[-0.04em] text-white">
          How can we help?
        </h1>
        <p className="text-base font-normal text-[#9a9a9a]">
          Submit a customer issue. The system normalizes the signal, retrieves order context, checks policies, and formulates an evidence-backed resolution.
        </p>
      </div>

      {/* Quick Test Samples */}
      <div className="space-y-2">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
          QUICK SCENARIO TEMPLATES (HACKATHON DEMO)
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              handleSampleClick(
                'My wireless headphones arrived with a cracked hinge and audio fails in the left ear. Need a replacement.',
                'O501',
                'U101'
              )
            }
            className="text-xs px-3 py-1.5 rounded-full bg-[#111111] border border-[#222222] text-[#bdbdbd] hover:text-white hover:border-[#8052ff] transition-colors"
          >
            Damaged Product (Returnable)
          </button>

          <button
            type="button"
            onClick={() =>
              handleSampleClick(
                'I was charged twice on my card for order O501 ($310.00 each) when the payment gateway timed out. Please reverse the second hold immediately.',
                'O501',
                'U101'
              )
            }
            className="text-xs px-3 py-1.5 rounded-full bg-[#111111] border border-[#222222] text-[#bdbdbd] hover:text-white hover:border-[#ffb829] transition-colors"
          >
            Duplicate Payment (Escalation)
          </button>

          <button
            type="button"
            onClick={() =>
              handleSampleClick(
                'Order O501 has been cancelled for over 8 business days, but the $1,250 refund has not hit my bank account.',
                'O501',
                'U101'
              )
            }
            className="text-xs px-3 py-1.5 rounded-full bg-[#111111] border border-[#222222] text-[#bdbdbd] hover:text-white hover:border-[#8052ff] transition-colors"
          >
            Refund Pending (Over SLA)
          </button>
        </div>
      </div>

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Description Textarea */}
        <div className="space-y-2">
          <label className="block text-xs font-mono uppercase tracking-wider text-[#bdbdbd]">
            Describe what happened *
          </label>
          <textarea
            required
            rows={5}
            value={complaintText}
            onChange={(e) => setComplaintText(e.target.value)}
            placeholder="Explain the issue with product, delivery, payment or refund..."
            className="w-full bg-[#0a0a0a] border border-[#222222] rounded-2xl p-4 text-sm text-white placeholder-[#9a9a9a] focus:outline-none focus:border-[#8052ff] transition-colors leading-relaxed"
          />
        </div>

        {/* Structured Context Fields (Connecting to Student 1 schema) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
              Customer ID
            </label>
            <input
              type="text"
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded-full py-2 px-3 text-xs font-mono text-white focus:outline-none focus:border-[#8052ff]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
              Order ID
            </label>
            <input
              type="text"
              required
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded-full py-2 px-3 text-xs font-mono text-white focus:outline-none focus:border-[#8052ff]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
              Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as any)}
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded-full py-2 px-3 text-xs text-white focus:outline-none focus:border-[#8052ff]"
            >
              <option value="web">Web Interface</option>
              <option value="email">Email</option>
              <option value="mobile">Mobile App</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </div>

        {/* Attachment Upload UI */}
        <div className="space-y-2">
          <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9a9a9a]">
            Supporting Attachments (Optional)
          </label>
          <div
            onClick={() => setAttachmentName(attachmentName ? null : 'photo_damaged_hinge_2026.png')}
            className={`p-6 rounded-2xl border border-dashed transition-colors cursor-pointer text-center space-y-2 ${
              attachmentName
                ? 'border-[#8052ff] bg-[#8052ff]/5'
                : 'border-[#222222] bg-[#050505] hover:border-[#444444]'
            }`}
          >
            {attachmentName ? (
              <div className="flex items-center justify-center gap-2 text-xs text-white">
                <FileText className="h-4 w-4 text-[#8052ff]" />
                <span className="font-mono">{attachmentName}</span>
                <span className="text-[#9a9a9a] text-[10px]">(Click to remove)</span>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-5 w-5 text-[#9a9a9a]" />
                <p className="text-xs text-[#bdbdbd]">
                  Click to attach bill screenshot or damaged item photo
                </p>
                <p className="text-[10px] text-[#9a9a9a]">PNG, JPG, PDF up to 10MB</p>
              </>
            )}
          </div>
        </div>

        {/* Processing State Simulator Overlay */}
        {isSubmitting && (
          <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-[#8052ff]/40 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-mono text-[#8052ff]">
              <Sparkles className="h-4 w-4 animate-spin" />
              <span>RUNNING RESOLUTION PIPELINE...</span>
            </div>

            <div className="space-y-2 text-xs">
              {processingSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  {processingStep > idx ? (
                    <CheckCircle2 className="h-4 w-4 text-[#15846e]" />
                  ) : processingStep === idx ? (
                    <span className="h-2 w-2 rounded-full bg-[#8052ff] animate-ping ml-1 mr-1" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-[#333333] ml-1 mr-1" />
                  )}
                  <span
                    className={
                      processingStep >= idx ? 'text-white font-normal' : 'text-[#9a9a9a]'
                    }
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !complaintText.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#8052ff] text-white text-xs font-normal hover:bg-[#7042ee] disabled:opacity-40 transition-colors shadow-lg shadow-[#8052ff]/20"
          >
            <span>{isSubmitting ? 'Processing Pipeline...' : 'Submit complaint'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
