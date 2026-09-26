import React from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';

export type StoryScene = {
  id: 'problem' | 'signals' | 'intelligence' | 'insight' | 'investigation' | 'recommendation' | 'resolution';
  eyebrow: string;
  title: React.ReactNode;
  body: React.ReactNode;
  side: 'left' | 'right';
  kicker?: string;
  metric?: React.ReactNode;
};

export const storyScenes: StoryScene[] = [
  {
    id: 'problem',
    eyebrow: 'Customer intelligence + resolution',
    title: <>Turn customer<br /><span className="intro-violet">complaints</span><br />into decisions.</>,
    body: <>Customer signals are scattered across complaints, reviews, tickets and orders. We turn them into actionable intelligence and evidence-backed resolution workflows.</>,
    side: 'left',
  },
  {
    id: 'signals',
    eyebrow: 'The problem',
    title: <>Thousands of signals.<br />One hidden pattern.</>,
    body: <>A refund request. A delivery delay. A damaged item. A failed payment. Individually small. Collectively meaningful.</>,
    side: 'right',
    kicker: 'Raw customer signals',
  },
  {
    id: 'intelligence',
    eyebrow: 'Intelligence engine',
    title: <>From noise<br />to <span className="intro-violet">intelligence.</span></>,
    body: <>Classify complaints, understand sentiment and severity, group semantically similar issues, and surface emerging trends.</>,
    side: 'left',
    metric: <><span>CLASSIFY</span><span>SENTIMENT</span><span>SEVERITY</span><span>CLUSTER</span><span>TREND</span></>,
  },
  {
    id: 'insight',
    eyebrow: 'Emerging insight',
    title: <>Patterns become<br /><span className="intro-amber">visible.</span></>,
    body: <>Recurring complaints reveal problems that individual tickets can hide.</>,
    side: 'right',
    metric: <><strong>REFUND PENDING</strong><br /><span>184 complaints · +34% this week</span></>,
  },
  {
    id: 'investigation',
    eyebrow: 'Individual investigation',
    title: <>Now investigate<br />one case.</>,
    body: <>The Resolution Agent combines the complaint with customer context, order information, approved policy, and similar historical cases.</>,
    side: 'left',
    metric: <><em>“My headphones arrived damaged and I need a replacement.”</em></>,
  },
  {
    id: 'recommendation',
    eyebrow: 'Recommendation + human approval',
    title: <>Recommend.<br /><span className="intro-violet">Don't guess.</span></>,
    body: <>The system turns evidence into a proposed action, then uses human approval when a decision is consequential or uncertain.</>,
    side: 'right',
    metric: <><strong>OFFER RETURN / REPLACEMENT</strong><br /><span>Confidence 91% · Human review when required</span></>,
  },
  {
    id: 'resolution',
    eyebrow: 'Closed loop',
    title: <>From complaint<br />to <span className="intro-teal">resolution.</span></>,
    body: <>Resolve the individual case, capture the outcome, and feed that signal back into the intelligence cycle.</>,
    side: 'left',
    metric: <><span>COMPLAINT → INTELLIGENCE → INVESTIGATION → RECOMMENDATION → APPROVAL → RESOLUTION → FEEDBACK</span></>,
  },
];

interface StoryCopyProps {
  scene: StoryScene;
  index: number;
  active: boolean;
  onExplore: () => void;
  onEnterApp: () => void;
}

export const StoryCopy: React.FC<StoryCopyProps> = ({ scene, index, active, onExplore, onEnterApp }) => {
  return (
    <div className={`intro-copy ${scene.side === 'right' ? 'intro-copy-right' : 'intro-copy-left'} ${active ? 'is-active' : ''}`}>
      <div className="intro-eyebrow"><span>{String(index + 1).padStart(2, '0')}</span><span>/</span>{scene.eyebrow}</div>
      <h1 className="intro-title">{scene.title}</h1>
      <p className="intro-body">{scene.body}</p>
      {scene.metric && <div className="intro-metric">{scene.metric}</div>}
      {scene.id === 'problem' && (
        <div className="intro-actions">
          <button className="intro-button intro-button-light" onClick={onExplore}>
            Explore the system <ArrowDown size={17} />
          </button>
          <button className="intro-button intro-button-ghost" onClick={onEnterApp}>
            Enter application <ArrowRight size={17} />
          </button>
        </div>
      )}
      {scene.id === 'resolution' && (
        <div className="intro-actions">
          <button className="intro-button intro-button-violet" onClick={onEnterApp}>
            Enter application <ArrowRight size={17} />
          </button>
        </div>
      )}
    </div>
  );
};
