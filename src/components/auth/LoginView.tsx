import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { authService } from '../../services/auth';
import { useToast } from '../ui/Toast';
import { ParticleField3D } from '../intro/ParticleField3D';

interface LoginViewProps {
  onNavigate: (route: string) => void;
  onSuccess: () => void;
}

const BrandMark: React.FC = () => (
  <span className="auth-brand-mark" aria-hidden="true">
    <span className="auth-brand-dot" />
  </span>
);

export const LoginView: React.FC<LoginViewProps> = ({ onNavigate, onSuccess }) => {
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.login(username.trim(), password);
      showToast('Signed in successfully.', 'success');
      onSuccess();
    } catch {
      showToast('Authentication failed. Check your credentials.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <ParticleField3D progress={0.165} />
      <div className="auth-atmosphere" aria-hidden="true" />
      <div className="auth-noise" aria-hidden="true" />

      <header className="auth-header">
        <button className="auth-brand" onClick={() => onNavigate('landing')} aria-label="Back to intro experience">
          <BrandMark />
<span>
            <strong>RESOLVE IQ</strong>
            <small>INTELLIGENCE & RESOLUTION</small>
          </span>
        </button>

        <button className="auth-back" onClick={() => onNavigate('landing')}>
          Back to intro
        </button>
      </header>

      <main className="auth-main">
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-panel-rail" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <div className="auth-kicker">
            <span className="auth-kicker-index">01</span>
            <span>/</span>
            <span>Secure operator access</span>
          </div>

          <div className="auth-heading">
            <div className="auth-icon-wrap" aria-hidden="true">
              <LockKeyhole size={16} />
            </div>
<h1 id="auth-title">Welcome back.</h1>
            <p>Sign in to continue to the RESOLVE IQ Intelligence & Resolution workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field">
              <span>
                Operator ID
                <small>Required</small>
              </span>
              <div className="auth-input-wrap">
                <UserRound size={15} aria-hidden="true" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your operator ID"
                  aria-label="Operator ID"
                />
              </div>
            </label>

            <label className="auth-field">
              <span>
                Password
                <small>Required</small>
              </span>
              <div className="auth-input-wrap">
                <LockKeyhole size={15} aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  aria-label="Password"
                />
                <button
                  type="button"
                  className="auth-input-action"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <button className="auth-submit" type="submit" disabled={loading}>
              <span>{loading ? 'Authenticating...' : 'Sign in to workspace'}</span>
              <ArrowRight size={17} />
            </button>
          </form>

          <div className="auth-trust-row">
            <div>
              <ShieldCheck size={15} />
              <span>Protected operator session</span>
            </div>
            <span className="auth-status-dot" aria-hidden="true" />
            <span className="auth-status">SYSTEM READY</span>
          </div>

          <p className="auth-footnote">
            Access is required before operational data, complaints, cases, analytics, and approvals can be opened.
          </p>
        </section>
      </main>
    </div>
  );
};
