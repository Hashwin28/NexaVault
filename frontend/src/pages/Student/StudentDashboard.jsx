import React, { useState } from 'react';
import { Sidebar } from '../../components/student/Sidebar';
import { Header } from '../../components/student/Header';
import { DashboardView } from './DashboardView';
import { WorkspacesView } from './WorkspacesView';
import { GroupsView } from './GroupsView';
import { ProjectsView } from './ProjectsView';
import { SubmissionsView } from './SubmissionsView';
import { ResultsView } from './ResultsView';
import { SmartSearchView } from './SmartSearchView';
import { AuditTrailView } from './AuditTrailView';
import { ProfileView } from './ProfileView';

export const StudentDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const handleSelectProjectFromWorkspace = (projectId) => {
    setSelectedProjectId(projectId);
    setActiveTab('projects');
  };

  return (
    <div className="min-h-screen bg-vault-bg text-vault-heading flex font-sans select-none">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen">
        
        {/* Sticky Header Bar */}
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          activeTab={activeTab}
        />

        {/* Dashboard Main Workspace View */}
        <main className="flex-1 p-6 lg:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView onNavigate={(tab) => setActiveTab(tab)} />
          )}

          {activeTab === 'workspaces' && (
            <WorkspacesView 
              onNavigate={(tab) => setActiveTab(tab)} 
              onSelectProject={handleSelectProjectFromWorkspace}
            />
          )}

          {activeTab === 'groups' && (
            <GroupsView onNavigate={(tab) => setActiveTab(tab)} />
          )}

          {activeTab === 'projects' && (
            <ProjectsView 
              defaultProjectId={selectedProjectId}
              onNavigate={(tab) => setActiveTab(tab)} 
            />
          )}

          {activeTab === 'submissions' && (
            <SubmissionsView />
          )}

          {activeTab === 'results' && (
            <ResultsView />
          )}

          {activeTab === 'search' && (
            <SmartSearchView />
          )}

          {activeTab === 'audit' && (
            <AuditTrailView />
          )}

          {activeTab === 'profile' && (
            <ProfileView />
          )}
        </main>

        {/* Global Footer */}
        <footer className="p-6 border-t border-vault-border/30 text-center text-xs font-mono text-slate-600 flex flex-col sm:flex-row justify-between items-center max-w-7xl w-full mx-auto gap-2">
          <p>© 2026 NexaVault Platform. Academic Workspace & Submission Lifecycle Engine.</p>
          <div className="flex items-center gap-4">
            <span className="text-teal-500/80">• Active Node: NV-NODE-01</span>
            <span>•</span>
            <span className="text-slate-400">PostgreSQL Connection: Verified</span>
          </div>
        </footer>

      </div>
    </div>
  );
};
