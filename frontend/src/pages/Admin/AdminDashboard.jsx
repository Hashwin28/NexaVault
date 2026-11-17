import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { AdminDashboardView } from './AdminDashboardView';
import { AdminWorkspacesView } from './AdminWorkspacesView';
import { AdminProjectsView } from './AdminProjectsView';
import { AdminStaffView } from './AdminStaffView';
import { AdminStudentsView } from './AdminStudentsView';
import { AdminAuditView } from './AdminAuditView';
import { AdminReportsView } from './AdminReportsView';
import { AdminProfileView } from './AdminProfileView';

const VALID_ADMIN_TABS = [
  'dashboard',
  'workspaces',
  'projects',
  'staff',
  'students',
  'audit',
  'reports',
  'profile',
];

const parseAdminUrlHash = () => {
  if (typeof window === 'undefined') return { tab: 'dashboard', workspaceId: null, projectId: null };
  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const [routePart, queryPart] = rawHash.split('?');
  const searchParams = new URLSearchParams(queryPart || '');

  const segments = (routePart || '').split('/').filter(Boolean);
  const primaryTab = segments[0] || 'dashboard';
  const tab = VALID_ADMIN_TABS.includes(primaryTab) ? primaryTab : 'dashboard';

  const workspaceId = searchParams.get('workspaceId') || searchParams.get('workspace') || null;
  const projectId = searchParams.get('projectId') || searchParams.get('project') || null;

  return { tab, workspaceId, projectId };
};

export const AdminDashboard = () => {
  const initial = parseAdminUrlHash();
  const [activeTab, setActiveTabState] = useState(initial.tab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initial.workspaceId);
  const [selectedProjectId, setSelectedProjectId] = useState(initial.projectId);
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([initial.tab]));

  const setActiveTab = (tab, params = {}) => {
    if (!VALID_ADMIN_TABS.includes(tab)) return;
    setActiveTabState(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
    const searchParams = new URLSearchParams();
    if (params.workspaceId) searchParams.set('workspaceId', params.workspaceId);
    if (params.projectId) searchParams.set('projectId', params.projectId);
    const queryString = searchParams.toString();
    window.location.hash = queryString ? `#${tab}?${queryString}` : `#${tab}`;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const { tab, workspaceId, projectId } = parseAdminUrlHash();
      setActiveTabState(tab);
      setVisitedTabs((prev) => new Set([...prev, tab]));
      if (workspaceId) setSelectedWorkspaceId(workspaceId);
      if (projectId) setSelectedProjectId(projectId);
    };

    if (!window.location.hash) {
      window.location.hash = '#dashboard';
    } else {
      handleHashChange();
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (tab, workspaceId = null) => {
    if (workspaceId) {
      setSelectedWorkspaceId(workspaceId);
      setActiveTab(tab, { workspaceId });
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C0E] text-[#ECF1F4] flex font-sans select-none">
      {/* Admin Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* Admin Header */}
        <AdminHeader
          activeTab={activeTab}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        {/* Dynamic Admin Views with Keep-Alive */}
        <main className="flex-1 p-6 lg:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {visitedTabs.has('dashboard') && (
            <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
              <AdminDashboardView onNavigate={handleNavigate} />
            </div>
          )}

          {visitedTabs.has('workspaces') && (
            <div className={activeTab === 'workspaces' ? 'block' : 'hidden'}>
              <AdminWorkspacesView
                initialWorkspaceId={selectedWorkspaceId}
                onNavigate={handleNavigate}
              />
            </div>
          )}

          {visitedTabs.has('projects') && (
            <div className={activeTab === 'projects' ? 'block' : 'hidden'}>
              <AdminProjectsView initialProjectId={selectedProjectId} />
            </div>
          )}

          {visitedTabs.has('staff') && (
            <div className={activeTab === 'staff' ? 'block' : 'hidden'}>
              <AdminStaffView onNavigate={handleNavigate} />
            </div>
          )}

          {visitedTabs.has('students') && (
            <div className={activeTab === 'students' ? 'block' : 'hidden'}>
              <AdminStudentsView onNavigate={handleNavigate} />
            </div>
          )}

          {visitedTabs.has('audit') && (
            <div className={activeTab === 'audit' ? 'block' : 'hidden'}>
              <AdminAuditView />
            </div>
          )}

          {visitedTabs.has('reports') && (
            <div className={activeTab === 'reports' ? 'block' : 'hidden'}>
              <AdminReportsView />
            </div>
          )}

          {visitedTabs.has('profile') && (
            <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
              <AdminProfileView />
            </div>
          )}
        </main>

        {/* Global Admin Footer */}
        <footer className="p-6 border-t border-[#1B262E] text-center text-xs font-mono text-slate-500 flex flex-col sm:flex-row justify-between items-center max-w-7xl w-full mx-auto gap-2">
          <p>© 2026 NexaVault Academic Engine. Administrator Console.</p>
          <div className="flex items-center gap-4">
            <span className="text-amber-400">• Role: Administrator</span>
            <span>•</span>
            <span className="text-emerald-400">Department Governance Active</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
