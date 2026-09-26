import React, { useState, useEffect } from 'react';
import { AppShell, NavRoute } from './components/layout/AppShell';
import { DashboardView } from './components/dashboard/DashboardView';
import { ComplaintListView } from './components/complaints/ComplaintListView';
import { ComplaintDetailView } from './components/complaints/ComplaintDetailView';
import { NewComplaintView } from './components/complaints/NewComplaintView';
import { CaseListView } from './components/cases/CaseListView';
import { ApprovalsView } from './components/approvals/ApprovalsView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SettingsView } from './components/settings/SettingsView';
import { LoginView } from './components/auth/LoginView';
import { IntroShell } from './components/intro/IntroShell';
import { ToastProvider } from './components/ui/Toast';
import { caseService } from './services/cases';
import { getAuthToken } from './services/api';

function getInitialRouteFromPath(): { route: NavRoute; entityId?: string } {
  if (typeof window === 'undefined') {
    return { route: 'landing' };
  }

  const path = window.location.pathname.replace(/\/$/, '');

  if (path === '' || path === '/') {
    return { route: 'landing' };
  }
  if (path === '/app/complaints/new') {
    return { route: 'new_complaint' };
  }
  if (path.startsWith('/app/complaints/')) {
    const id = path.split('/app/complaints/')[1];
    return { route: 'complaint_detail', entityId: id };
  }
  if (path === '/app/complaints') {
    return { route: 'complaints' };
  }
  if (path.startsWith('/app/cases/')) {
    const id = path.split('/app/cases/')[1];
    return { route: 'case_detail', entityId: id };
  }
  if (path === '/app/cases') {
    return { route: 'cases' };
  }
  if (path === '/app/approvals') {
    return { route: 'approvals' };
  }
  if (path === '/app/analytics') {
    return { route: 'analytics' };
  }
  if (path === '/app/settings') {
    return { route: 'settings' };
  }
  if (path === '/app/login') {
    return { route: 'login' };
  }
  if (path === '/app' || path === '/app/dashboard') {
    return { route: 'dashboard' };
  }

  // Fallback default for root
  return { route: 'landing' };
}

const PUBLIC_ROUTES = new Set<NavRoute>(['landing', 'login']);

function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

function getPathForRoute(route: NavRoute, entityId?: string): string {
  switch (route) {
    case 'landing':
      return '/';
    case 'dashboard':
      return '/app/dashboard';
    case 'complaints':
      return '/app/complaints';
    case 'complaint_detail':
      return `/app/complaints/${entityId || 'C-001'}`;
    case 'new_complaint':
      return '/app/complaints/new';
    case 'cases':
      return '/app/cases';
    case 'case_detail':
      return `/app/cases/${entityId || 'CAS-001'}`;
    case 'approvals':
      return '/app/approvals';
    case 'analytics':
      return '/app/analytics';
    case 'settings':
      return '/app/settings';
    case 'login':
      return '/app/login';
    default:
      return '/app/dashboard';
  }
}

export default function App() {
  const rawInitial = getInitialRouteFromPath();
  const initial = !PUBLIC_ROUTES.has(rawInitial.route) && !isAuthenticated()
    ? { route: 'login' as NavRoute }
    : rawInitial;
  const [currentRoute, setCurrentRoute] = useState<NavRoute>(initial.route);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(initial.entityId || 'C-001');
  const [initialClusterFilter, setInitialClusterFilter] = useState<string | undefined>(undefined);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(3);

  // Normalize a direct visit to a protected URL when no session exists.
  useEffect(() => {
    if (!isAuthenticated() && !PUBLIC_ROUTES.has(currentRoute) && window.location.pathname !== '/app/login') {
      window.history.replaceState(null, '', '/app/login');
    }
  }, [currentRoute]);

  // Synchronize pending approvals count
  useEffect(() => {
    async function syncCount() {
      const all = await caseService.getCases();
      const count = all.filter(
        (c) => !c.recommendation.executed && c.recommendation.approval_status === 'Pending'
      ).length;
      setPendingApprovalsCount(count);
    }
    syncCount();
  }, [currentRoute]);

  // Handle browser popstate (back / forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const resolved = getInitialRouteFromPath();
      const guardedRoute = !PUBLIC_ROUTES.has(resolved.route) && !isAuthenticated()
        ? 'login' as NavRoute
        : resolved.route;
      setCurrentRoute(guardedRoute);
      if (resolved.entityId) {
        setSelectedEntityId(resolved.entityId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (route: string = 'dashboard', entityId?: string) => {
    let targetRoute = route as NavRoute;

    if (!PUBLIC_ROUTES.has(targetRoute) && !isAuthenticated()) {
      targetRoute = 'login';
    }

    if (route === 'complaints' && entityId && targetRoute === 'complaints') {
      // Navigating to complaints filtered by cluster name
      setInitialClusterFilter(entityId);
      setCurrentRoute('complaints');
      const newPath = getPathForRoute('complaints');
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (entityId) {
      setSelectedEntityId(entityId);
    }

    setInitialClusterFilter(undefined);
    setCurrentRoute(targetRoute);

    const newPath = getPathForRoute(targetRoute, entityId || selectedEntityId);
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. Cinematic Intro / Landing Experience
  if (currentRoute === 'landing') {
    return (
      <ToastProvider>
        <IntroShell onEnterApp={handleNavigate} />
      </ToastProvider>
    );
  }

  // 2. Dedicated sign-in environment (kept outside the dashboard shell).
  if (currentRoute === 'login') {
    return (
      <ToastProvider>
        <LoginView
          onNavigate={handleNavigate}
          onSuccess={() => handleNavigate('dashboard')}
        />
      </ToastProvider>
    );
  }

  // 3. Operational RESOLVE IQ Application
  if (!isAuthenticated()) {
    return (
      <ToastProvider>
        <LoginView
          onNavigate={handleNavigate}
          onSuccess={() => handleNavigate('dashboard')}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AppShell
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        pendingApprovalsCount={pendingApprovalsCount}
      >
        {currentRoute === 'dashboard' && (
          <DashboardView onNavigate={handleNavigate} />
        )}

        {currentRoute === 'complaints' && (
          <ComplaintListView
            onNavigate={handleNavigate}
            initialFilterCluster={initialClusterFilter}
          />
        )}

        {(currentRoute === 'complaint_detail' || currentRoute === 'case_detail') && (
          <ComplaintDetailView
            complaintOrCaseId={selectedEntityId}
            onNavigate={handleNavigate}
          />
        )}

        {currentRoute === 'new_complaint' && (
          <NewComplaintView onNavigate={handleNavigate} />
        )}

        {currentRoute === 'cases' && (
          <CaseListView onNavigate={handleNavigate} />
        )}

        {currentRoute === 'approvals' && (
          <ApprovalsView
            onNavigate={handleNavigate}
            onApprovalsCountChange={(c) => setPendingApprovalsCount(c)}
          />
        )}

        {currentRoute === 'analytics' && (
          <AnalyticsView onNavigate={handleNavigate} />
        )}

        {currentRoute === 'settings' && (
          <SettingsView onNavigate={handleNavigate} />
        )}

      </AppShell>
    </ToastProvider>
  );
}
