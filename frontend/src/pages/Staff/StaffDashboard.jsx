import React, { useState } from 'react';
import { StaffSidebar } from '../../components/staff/StaffSidebar';
import { StaffHeader } from '../../components/staff/StaffHeader';
import { StaffDashboardView } from './StaffDashboardView';
import { StaffWorkspacesView } from './StaffWorkspacesView';
import { StaffReviewQueueView } from './StaffReviewQueueView';
import { StaffSmartSearchView } from './StaffSmartSearchView';
import { StaffAuditTrailView } from './StaffAuditTrailView';
import { StaffProfileView } from './StaffProfileView';
import { StaffProjectDetailView } from './StaffProjectDetailView';

export const StaffDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const handleNavigate = (tab, workspaceId = null) => {
    setActiveTab(tab);
    if (workspaceId) {
      setSelectedWorkspaceId(workspaceId);
    }
  };

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setActiveTab('project-detail');
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
