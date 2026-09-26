import React, { useState } from 'react';
import {
  LayoutDashboard,
  Inbox,
  Briefcase,
  CheckCircle,
  BarChart3,
  Sliders,
  Plus,
  Search,
  Menu,
  X,
  Shield,
  LifeBuoy,
  LogOut,
  ChevronRight,
  ExternalLink,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { mockCurrentUser } from '../../data/mockRepository';
import { authService } from '../../services/auth';

export type NavRoute =
  | 'landing'
  | 'dashboard'
  | 'complaints'
  | 'complaint_detail'
  | 'cases'
  | 'case_detail'
  | 'approvals'
  | 'analytics'
  | 'settings'
  | 'new_complaint'
  | 'login'
  | 'register';

interface AppShellProps {
  currentRoute: NavRoute;
  onNavigate: (route: NavRoute, entityId?: string) => void;
  pendingApprovalsCount: number;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentRoute,
  onNavigate,
  pendingApprovalsCount,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const navItems = [
    { id: 'dashboard' as NavRoute, label: 'Overview', icon: LayoutDashboard },
    { id: 'complaints' as NavRoute, label: 'Complaints', icon: Inbox },
    { id: 'cases' as NavRoute, label: 'Cases', icon: Briefcase },
    {
      id: 'approvals' as NavRoute,
      label: 'Approvals',
      icon: CheckCircle,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    { id: 'analytics' as NavRoute, label: 'Analytics', icon: BarChart3 },
    { id: 'settings' as NavRoute, label: 'Settings', icon: Sliders },
  ];

  const handleNavClick = (route: NavRoute) => {
    onNavigate(route);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#000000] text-[#ffffff] font-sans">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-[#1a1a1a] bg-[#000000] p-6 select-none shrink-0 justify-between">
        <div className="space-y-6">
          {/* Back to Landing Page Story link */}
          <button
            onClick={() => handleNavClick('landing')}
            className="flex items-center gap-2 text-xs font-mono text-[#9a9a9a] hover:text-white transition-colors cursor-pointer group pb-2 border-b border-white/5"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 text-[#8052ff]" />
            <span>Intro Experience</span>
          </button>

          {/* Minimal Geometric Logo Mark (Angular triangle motif from Refero reference) */}
          <div
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div className="relative flex h-8 w-8 items-center justify-center">
              {/* Angular geometric vector motif */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300 group-hover:scale-105">
                <polygon points="12,2 22,20 2,20" stroke="#8052ff" strokeWidth="2" fill="none" />
                <polygon points="12,7 19,19 5,19" fill="#8052ff" fillOpacity="0.25" />
                <circle cx="12" cy="13" r="2" fill="#15846e" />
              </svg>
            </div>
            <div>
              <span className="text-sm tracking-[-0.02em] font-normal text-white">
                RESOLVE IQ
              </span>
              <p className="text-[10px] font-mono text-[#9a9a9a]">Intelligence & Resolution</p>
            </div>
          </div>

          {/* Primary Navigation */}
          <nav className="space-y-1.5">
            <p className="px-3 text-[10px] uppercase tracking-wider font-mono text-[#9a9a9a] mb-2">
              Operations
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentRoute === item.id ||
                (item.id === 'complaints' && currentRoute === 'complaint_detail') ||
                (item.id === 'cases' && currentRoute === 'case_detail');

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex w-full items-center justify-between px-3 py-2.5 rounded-full text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'text-white bg-[#141414] font-medium'
                      : 'text-[#9a9a9a] hover:text-white hover:bg-[#0a0a0a]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-[#8052ff]' : 'text-[#9a9a9a]'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span className="h-5 px-1.5 min-w-[20px] rounded-full bg-[#ffb829]/20 border border-[#ffb829]/40 text-[#ffb829] font-mono text-[10px] flex items-center justify-center tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Lower Sidebar Section */}
        <div className="space-y-4 pt-6 border-t border-[#1a1a1a]">
          <button
            onClick={() => handleNavClick('new_complaint')}
            className={`flex w-full items-center justify-between px-3 py-2 rounded-full text-xs transition-colors ${
              currentRoute === 'new_complaint'
                ? 'text-white bg-[#141414]'
                : 'text-[#9a9a9a] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Plus className="h-3.5 w-3.5 text-[#8052ff]" />
              <span>Customer Intake</span>
            </div>
            <ExternalLink className="h-3 w-3 text-[#9a9a9a]" />
          </button>

          {/* User profile / session */}
          <div className="flex items-center justify-between pt-2 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center font-mono text-[11px] text-[#bdbdbd]">
                OP
              </div>
              <div className="leading-tight">
                <p className="text-white text-xs">{mockCurrentUser.username}</p>
                <p className="text-[10px] text-[#9a9a9a]">Student 4 UI</p>
              </div>
            </div>
            <button
              onClick={async () => {
                await authService.logout();
                handleNavClick('login');
              }}
              title="Sign out"
              className="text-[#9a9a9a] hover:text-white p-1"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#000000]">
        {/* Top Bar Header */}
        <header className="h-16 border-b border-[#1a1a1a] px-6 flex items-center justify-between gap-4 shrink-0 bg-[#000000]">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-[#9a9a9a] hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Global Search Bar */}
          <div className="relative max-w-md w-full hidden sm:block">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#9a9a9a]" />
            <input
              type="text"
              placeholder="Search complaints, orders, customers (⌘K)..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222222] rounded-full py-1.5 pl-8 pr-4 text-xs text-white placeholder-[#9a9a9a] focus:outline-none focus:border-[#8052ff] transition-colors font-sans"
            />
          </div>

          {/* System Status & Primary Action */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Story / Intro landing page quick link */}
            <button
              onClick={() => handleNavClick('landing')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 text-xs font-mono text-[#9a9a9a] hover:text-white hover:border-white/20 transition-colors cursor-pointer"
              title="Return to Story Landing Page"
            >
              <ArrowLeft className="h-3 w-3 text-[#8052ff]" />
              <span className="hidden sm:inline">Intro Story</span>
            </button>

            {/* System/API status */}
            <div className="hidden md:flex items-center gap-2 text-xs text-[#9a9a9a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#15846e]" />
              <span className="font-mono text-[11px]">Backend Contract v1.0 Ready</span>
            </div>

            {/* Primary Action: Violet Pill Button */}
            <button
              onClick={() => handleNavClick('new_complaint')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#8052ff] text-white text-xs font-normal hover:bg-[#7042ee] transition-colors whitespace-nowrap shadow-sm shadow-[#8052ff]/20 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New complaint</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-16 z-50 bg-[#000000]/95 backdrop-blur-md p-6 space-y-4">
            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className="flex w-full items-center justify-between p-3 rounded-xl bg-[#0e0e0e] border border-white/5 text-sm"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-[#9a9a9a]" />
                </button>
              ))}
              <button
                onClick={() => handleNavClick('new_complaint')}
                className="flex w-full items-center justify-between p-3 rounded-xl bg-[#8052ff]/10 border border-[#8052ff]/30 text-[#8052ff] text-sm"
              >
                <span>Customer Intake Form</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto bg-[#000000]">
          {children}
        </main>
      </div>
    </div>
  );
};
