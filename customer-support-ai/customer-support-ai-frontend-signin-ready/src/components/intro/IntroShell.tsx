import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ParticleField3D } from './ParticleField3D';
import { StoryCopy, storyScenes } from './storyScenes';

interface IntroShellProps {
  onEnterApp: (route?: string, entityId?: string) => void;
}

export const IntroShell: React.FC<IntroShellProps> = ({ onEnterApp }) => {
  const [progress, setProgress] = useState(0);
  const [activeScene, setActiveScene] = useState(0);
  const sceneRefs = useRef<Array<HTMLElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const rawRef = useRef(0);
  const smoothRef = useRef(0);

  useEffect(() => {
    const updateRaw = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      rawRef.current = Math.max(0, Math.min(1, window.scrollY / max));
    };

    const tick = () => {
      smoothRef.current += (rawRef.current - smoothRef.current) * 0.1;
      setProgress(smoothRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    updateRaw();
    window.addEventListener('scroll', updateRaw, { passive: true });
    window.addEventListener('resize', updateRaw, { passive: true });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('scroll', updateRaw);
      window.removeEventListener('resize', updateRaw);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    sceneRefs.current.forEach((element, index) => {
      if (!element) return;
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) setActiveScene(index);
          }
        },
        { threshold: 0.5 },
      );
      observer.observe(element);
      observers.push(observer);
    });
    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  const scrollToScene = (index: number) => {
    sceneRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="intro-page">
      <ParticleField3D progress={progress} />
      <div className="intro-atmosphere" aria-hidden="true" />

      <header className="intro-header">
        <button className="intro-brand" onClick={() => scrollToScene(0)} aria-label="Back to start">
          <span className="intro-brand-mark" aria-hidden="true">
            <span className="intro-brand-dot" />
          </span>
<span>
            <strong>RESOLVE IQ</strong>
            <small>INTELLIGENCE & RESOLUTION</small>
          </span>
        </button>

        <button className="intro-enter-top" onClick={() => onEnterApp('login')}>
          Enter application <ArrowRight size={18} />
        </button>
      </header>

      <main className="intro-story">
        {storyScenes.map((scene, index) => (
          <section
            key={scene.id}
            ref={(element) => { sceneRefs.current[index] = element; }}
            className={`intro-section intro-section-${scene.side}`}
            aria-labelledby={`intro-${scene.id}`}
          >
            <div id={`intro-${scene.id}`} className="intro-anchor" aria-hidden="true" />
            <StoryCopy
              scene={scene}
              index={index}
              active={activeScene === index}
              onExplore={() => scrollToScene(Math.min(index + 1, storyScenes.length - 1))}
              onEnterApp={() => onEnterApp('login')}
            />
          </section>
        ))}
      </main>


      <div className="intro-scroll-note">
        <span /> Scroll to transform
      </div>
    </div>
  );
};
