import React, { useState, useEffect } from 'react';
import { StaffSidebar } from '../../components/staff/StaffSidebar';
import { StaffHeader } from '../../components/staff/StaffHeader';
import { StaffDashboardView } from './StaffDashboardView';
import { StaffWorkspacesView } from './StaffWorkspacesView';
import { StaffReviewQueueView } from './StaffReviewQueueView';
import { StaffSmartSearchView } from './StaffSmartSearchView';
import { StaffAuditTrailView } from './StaffAuditTrailView';
import { StaffProfileView } from './StaffProfileView';
import { StaffProjectDetailView } from './StaffProjectDetailView';

const VALID_STAFF_TABS = ['dashboard', 'workspaces', 'review-queue', 'search', 'audit', 'profile', 'project-detail'];

const parseStaffUrlHash = () => {
  if (typeof window === 'undefined') return { tab: 'dashboard', workspaceId: null, projectId: null };
  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const [tabPart, queryPart] = rawHash.split('?');
  const tab = VALID_STAFF_TABS.includes(tabPart) ? tabPart : 'dashboard';
  const searchParams = new URLSearchParams(queryPart || '');
  const workspaceId = searchParams.get('workspaceId') || searchParams.get('workspace') || null;
  const projectId = searchParams.get('projectId') || searchParams.get('project') || null;
  return { tab, workspaceId, projectId };
};

export const StaffDashboard = () => {
  const initial = parseStaffUrlHash();
  const [activeTab, setActiveTabState] = useState(initial.tab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initial.workspaceId);
  const [selectedProjectId, setSelectedProjectId] = useState(initial.projectId);

  const setActiveTab = (tab, params = {}) => {
    if (!VALID_STAFF_TABS.includes(tab)) return;
    setActiveTabState(tab);
    const searchParams = new URLSearchParams();
    if (params.workspaceId) searchParams.set('workspaceId', params.workspaceId);
    if (params.projectId) searchParams.set('projectId', params.projectId);
    const queryString = searchParams.toString();
    window.location.hash = queryString ? `#${tab}?${queryString}` : `#${tab}`;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const { tab, workspaceId, projectId } = parseStaffUrlHash();
      setActiveTabState(tab);
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

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setActiveTab('project-detail', { projectId });
  };

  return (
    <div className="min-h-screen bg-[#080C0E] text-[#ECF1F4] flex font-sans select-none">
      {/* Staff Sidebar */}
      <StaffSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* Staff Header */}
        <StaffHeader
          activeTab={activeTab}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        {/* Dynamic Staff View */}
        <main className="flex-1 p-6 lg:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <StaffDashboardView onNavigate={handleNavigate} />
          )}

          {activeTab === 'workspaces' && (
            <StaffWorkspacesView
              selectedWorkspaceId={selectedWorkspaceId}
              onSelectProject={handleSelectProject}
            />
          )}

          {activeTab === 'review-queue' && <StaffReviewQueueView />}

          {activeTab === 'search' && (
            <StaffSmartSearchView onSelectProject={handleSelectProject} />
          )}

          {activeTab === 'audit' && <StaffAuditTrailView />}

          {activeTab === 'profile' && <StaffProfileView />}

          {activeTab === 'project-detail' && (
            <StaffProjectDetailView
              projectId={selectedProjectId}
              onBack={() => setActiveTab('workspaces')}
            />
          )}
        </main>

        {/* Global Staff Footer */}
        <footer className="p-6 border-t border-[#1B262E] text-center text-xs font-mono text-slate-500 flex flex-col sm:flex-row justify-between items-center max-w-7xl w-full mx-auto gap-2">
          <p>© 2026 NexaVault Academic Engine. Staff Oversight Portal.</p>
          <div className="flex items-center gap-4">
            <span className="text-teal-400">• Role: Staff / Oversight</span>
            <span>•</span>
            <span className="text-emerald-400">API Connection: PostgreSQL Active</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
