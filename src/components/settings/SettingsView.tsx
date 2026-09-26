import React, { useState } from 'react';
import {
  Sliders,
  Shield,
  Zap,
  Bell,
  Cpu,
  Save,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useToast } from '../ui/Toast';

interface SettingsViewProps {
  onNavigate: (route: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = () => {
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Guardrails config
  const [maxAutoRefund, setMaxAutoRefund] = useState(50);
  const [sentimentThreshold, setSentimentThreshold] = useState(-0.65);
  const [vipInstantEscalate, setVipInstantEscalate] = useState(true);
  const [requireCarrierPhoto, setRequireCarrierPhoto] = useState(true);

  // Intelligence engine config
  const [clusterSimilarityThreshold, setClusterSimilarityThreshold] = useState(0.78);
  const [spikeSensitivity, setSpikeSensitivity] = useState(25);
  const [minClusterSize, setMinClusterSize] = useState(5);

  // Notifications
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T00/B00/XXXX');
  const [pagerdutyKey, setPagerdutyKey] = useState('pd-live-key-support-ops');
  const [notifyOnSpike, setNotifyOnSpike] = useState(true);
  const [notifyOnHighSeverity, setNotifyOnHighSeverity] = useState(true);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('System configuration & guardrail rules updated successfully', 'success');
    }, 600);
  };

  const handleReset = () => {
    setMaxAutoRefund(50);
    setSentimentThreshold(-0.65);
    setVipInstantEscalate(true);
    setRequireCarrierPhoto(true);
    setClusterSimilarityThreshold(0.78);
    setSpikeSensitivity(25);
    setMinClusterSize(5);
    showToast('Settings restored to system baseline', 'info');
  };

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-[#141414]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#8052ff]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[#9a9a9a]">
              Operations & Engine Governance
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-white">
            System Settings
          </h1>
          <p className="text-sm text-[#9a9a9a]">
            Configure autonomous agent guardrails, human approval thresholds, and NLP clustering parameters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-xs text-[#9a9a9a] hover:text-white hover:border-white/20 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset Baseline</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#8052ff] hover:bg-[#7042ee] text-white text-xs font-medium transition-colors shadow-sm shadow-[#8052ff]/30"
          >
            {isSaving ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Grid of Configuration Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Module 1: Autonomous Resolution Guardrails */}
        <section className="p-6 rounded-2xl bg-[#080808] border border-white/5 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <div className="h-8 w-8 rounded-lg bg-[#8052ff]/10 border border-[#8052ff]/20 flex items-center justify-center text-[#8052ff]">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-medium text-white">Resolution Guardrails</h2>
              <p className="text-xs text-[#9a9a9a]">Policy bounds governing automated execution</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Auto refund cap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white">Max Auto-Approval Refund Limit</span>
                <span className="font-mono text-[#8052ff] tabular-nums font-semibold">
                  ${maxAutoRefund}.00 USD
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="250"
                step="5"
                value={maxAutoRefund}
                onChange={(e) => setMaxAutoRefund(Number(e.target.value))}
                className="w-full accent-[#8052ff] bg-[#1a1a1a] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[11px] text-[#9a9a9a]">
                Refunds exceeding this threshold automatically pause at the Human Approval Queue.
              </p>
            </div>

            {/* Sentiment trigger */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white">Sentiment Escalation Trigger</span>
                <span className="font-mono text-[#ffb829] tabular-nums font-semibold">
                  {sentimentThreshold} (Negative)
                </span>
              </div>
              <input
                type="range"
                min="-1"
                max="-0.2"
                step="0.05"
                value={sentimentThreshold}
                onChange={(e) => setSentimentThreshold(Number(e.target.value))}
                className="w-full accent-[#ffb829] bg-[#1a1a1a] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[11px] text-[#9a9a9a]">
                Customer messages with sentiment score below this trigger immediate supervisor alerting.
              </p>
            </div>

            {/* Toggle: VIP Instant Escalate */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs text-white">VIP Tier Auto-Escalation Priority</p>
                <p className="text-[11px] text-[#9a9a9a]">Prioritize Enterprise and VIP customer complaints to senior queue</p>
              </div>
              <button
                type="button"
                onClick={() => setVipInstantEscalate(!vipInstantEscalate)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  vipInstantEscalate ? 'bg-[#8052ff]' : 'bg-[#222222]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    vipInstantEscalate ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle: Carrier Proof */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs text-white">Require Carrier Tracking Mismatch for Re-dispatch</p>
                <p className="text-[11px] text-[#9a9a9a]">Verify logistics API telemetry before dispatching replacement package</p>
              </div>
              <button
                type="button"
                onClick={() => setRequireCarrierPhoto(!requireCarrierPhoto)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  requireCarrierPhoto ? 'bg-[#15846e]' : 'bg-[#222222]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    requireCarrierPhoto ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Module 2: Intelligence Engine (Student 2) */}
        <section className="p-6 rounded-2xl bg-[#080808] border border-white/5 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <div className="h-8 w-8 rounded-lg bg-[#ffb829]/10 border border-[#ffb829]/20 flex items-center justify-center text-[#ffb829]">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-medium text-white">NLP & Semantic Clustering</h2>
              <p className="text-xs text-[#9a9a9a]">Embedding and pattern detection hyperparameters</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Cluster distance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white">Cosine Similarity Threshold (HDBSCAN)</span>
                <span className="font-mono text-[#ffb829] tabular-nums font-semibold">
                  {clusterSimilarityThreshold}
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.01"
                value={clusterSimilarityThreshold}
                onChange={(e) => setClusterSimilarityThreshold(Number(e.target.value))}
                className="w-full accent-[#ffb829] bg-[#1a1a1a] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[11px] text-[#9a9a9a]">
                Higher values create narrower, tighter clusters; lower values group broader thematic topics.
              </p>
            </div>

            {/* Spike sensitivity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white">Trend Velocity Spike Alarm</span>
                <span className="font-mono text-white tabular-nums font-semibold">
                  +{spikeSensitivity}% in 24h
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={spikeSensitivity}
                onChange={(e) => setSpikeSensitivity(Number(e.target.value))}
                className="w-full accent-[#8052ff] bg-[#1a1a1a] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[11px] text-[#9a9a9a]">
                Clusters experiencing volume growth exceeding this rate are flagged as emerging systemic issues.
              </p>
            </div>

            {/* Active Model Info */}
            <div className="p-3.5 rounded-xl bg-[#0e0e0e] border border-white/5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#9a9a9a]">Active Embedding Model</span>
                <span className="font-mono text-white">text-embedding-004</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9a9a9a]">Dimension Space</span>
                <span className="font-mono text-white">768-dim Normalized</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9a9a9a]">Clustering Algorithm</span>
                <span className="font-mono text-[#15846e]">HDBSCAN + UMAP</span>
              </div>
            </div>
          </div>
        </section>

        {/* Module 3: Incident Notifications & Webhooks */}
        <section className="p-6 rounded-2xl bg-[#080808] border border-white/5 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <div className="h-8 w-8 rounded-lg bg-[#15846e]/10 border border-[#15846e]/20 flex items-center justify-center text-[#15846e]">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-medium text-white">Alerts & Integrations</h2>
              <p className="text-xs text-[#9a9a9a]">Outbound hooks for operations escalation</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-white">Slack Incident Channel Webhook</label>
              <input
                type="text"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                className="w-full bg-[#0e0e0e] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#8052ff]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-white">PagerDuty On-Call Routing Key</label>
              <input
                type="password"
                value={pagerdutyKey}
                onChange={(e) => setPagerdutyKey(e.target.value)}
                className="w-full bg-[#0e0e0e] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#8052ff]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs text-white">Trigger alert on Cluster Spike (+20%)</p>
                <p className="text-[11px] text-[#9a9a9a]">Notify on-call engineers of sudden defect patterns</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifyOnSpike(!notifyOnSpike)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  notifyOnSpike ? 'bg-[#8052ff]' : 'bg-[#222222]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    notifyOnSpike ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Module 4: API Service Contracts Status */}
        <section className="p-6 rounded-2xl bg-[#080808] border border-white/5 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-medium text-white">Team Integration Contracts</h2>
              <p className="text-xs text-[#9a9a9a]">Health status of Student microservices</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e0e0e] border border-white/5">
              <div className="space-y-0.5">
                <p className="text-xs text-white font-medium">Student 1 — FastAPI Database Service</p>
                <p className="text-[10px] font-mono text-[#9a9a9a]">POST /auth/login · GET /complaints</p>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#15846e]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>ONLINE</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e0e0e] border border-white/5">
              <div className="space-y-0.5">
                <p className="text-xs text-white font-medium">Student 2 — NLP Clustering Pipeline</p>
                <p className="text-[10px] font-mono text-[#9a9a9a]">POST /analyze · GET /trends</p>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#15846e]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>ONLINE</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e0e0e] border border-white/5">
              <div className="space-y-0.5">
                <p className="text-xs text-white font-medium">Student 3 — Resolution Reasoner</p>
                <p className="text-[10px] font-mono text-[#9a9a9a]">POST /resolve · POST /cases/:id/execute</p>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#15846e]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>ONLINE</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e0e0e] border border-white/5">
              <div className="space-y-0.5">
                <p className="text-xs text-white font-medium">Student 4 — Frontend Operations Cockpit</p>
                <p className="text-[10px] font-mono text-[#9a9a9a]">Client Interface & Operator Workflow</p>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#8052ff]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>ACTIVE</span>
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
