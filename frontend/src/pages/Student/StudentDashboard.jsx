import React, { useState, useEffect } from 'react';
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

const VALID_TABS = ['dashboard', 'workspaces', 'groups', 'projects', 'submissions', 'results', 'search', 'audit', 'profile'];

const parseUrlHash = () => {
  if (typeof window === 'undefined') return { tab: 'dashboard', projectId: null, section: null };
  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const [routePart, queryPart] = rawHash.split('?');
  const searchParams = new URLSearchParams(queryPart || '');

  // Support path routing like #projects/188/submissions as well as #projects?projectId=188&section=submissions
  const segments = (routePart || '').split('/').filter(Boolean);
  const primaryTab = segments[0] || 'dashboard';
  const tab = VALID_TABS.includes(primaryTab) ? primaryTab : 'dashboard';

  let projectId = searchParams.get('projectId') || searchParams.get('project') || null;
  let section = searchParams.get('section') || searchParams.get('tab') || null;

  if (tab === 'projects') {
    if (!projectId && segments[1] && /^\d+$/.test(segments[1])) {
      projectId = segments[1];
    }
    if (!section && segments[2]) {
      section = segments[2];
    }
  }

  return { tab, projectId, section };
};

export const StudentDashboard = () => {
  const initial = parseUrlHash();
  const [activeTab, setActiveTabState] = useState(initial.tab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(initial.projectId);
  const [selectedSection, setSelectedSection] = useState(initial.section);
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([initial.tab]));

  const setActiveTab = (tab, projectId = null, section = null) => {
    if (!VALID_TABS.includes(tab)) return;
    setActiveTabState(tab);
    setVisitedTabs(prev => new Set([...prev, tab]));
    if (tab === 'projects') {
      if (projectId) setSelectedProjectId(projectId);
      if (section) setSelectedSection(section);
      const pid = projectId || selectedProjectId;
      if (pid) {
        window.location.hash = section ? `#projects?projectId=${pid}&section=${section}` : `#projects?projectId=${pid}`;
        return;
      }
    }
    if (projectId) {
      setSelectedProjectId(projectId);
      window.location.hash = `#${tab}?projectId=${projectId}`;
    } else {
      window.location.hash = `#${tab}`;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const { tab, projectId, section } = parseUrlHash();
      setActiveTabState(tab);
      setVisitedTabs(prev => new Set([...prev, tab]));
      if (projectId) {
        setSelectedProjectId(projectId);
      }
      if (section) {
        setSelectedSection(section);
      }
    };

    if (!window.location.hash) {
      window.location.hash = '#dashboard';
    } else {
      handleHashChange();
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectProjectFromWorkspace = (projectId) => {
    setSelectedProjectId(projectId);
    setActiveTab('projects', projectId);
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

        {/* Dashboard Main Workspace View with 0ms Keep-Alive Caching */}
        <main className="flex-1 p-6 lg:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {visitedTabs.has('dashboard') && (
            <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
              <DashboardView onNavigate={(tab) => setActiveTab(tab)} />
            </div>
          )}

          {visitedTabs.has('workspaces') && (
            <div className={activeTab === 'workspaces' ? 'block' : 'hidden'}>
              <WorkspacesView 
                onNavigate={(tab) => setActiveTab(tab)} 
                onSelectProject={handleSelectProjectFromWorkspace}
              />
            </div>
          )}

          {visitedTabs.has('groups') && (
            <div className={activeTab === 'groups' ? 'block' : 'hidden'}>
              <GroupsView onNavigate={(tab) => setActiveTab(tab)} />
            </div>
          )}

          {visitedTabs.has('projects') && (
            <div className={activeTab === 'projects' ? 'block' : 'hidden'}>
              <ProjectsView 
                defaultProjectId={selectedProjectId}
                initialSection={selectedSection}
                onNavigate={(tab, projId, sec) => setActiveTab(tab, projId, sec)} 
              />
            </div>
          )}

          {visitedTabs.has('submissions') && (
            <div className={activeTab === 'submissions' ? 'block' : 'hidden'}>
              <SubmissionsView />
            </div>
          )}

          {visitedTabs.has('results') && (
            <div className={activeTab === 'results' ? 'block' : 'hidden'}>
              <ResultsView />
            </div>
          )}

          {visitedTabs.has('search') && (
            <div className={activeTab === 'search' ? 'block' : 'hidden'}>
              <SmartSearchView />
            </div>
          )}

          {visitedTabs.has('audit') && (
            <div className={activeTab === 'audit' ? 'block' : 'hidden'}>
              <AuditTrailView />
            </div>
          )}

          {visitedTabs.has('profile') && (
            <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
              <ProfileView />
            </div>
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
