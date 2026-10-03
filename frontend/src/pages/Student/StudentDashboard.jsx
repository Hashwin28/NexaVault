import React, { useState } from 'react';
import { Sidebar } from '../../components/student/Sidebar';
import { Header } from '../../components/student/Header';
import { MetricsCards } from '../../components/student/MetricsCards';
import { SubmissionTracker } from '../../components/student/SubmissionTracker';
import { ActiveWorkspaces } from '../../components/student/ActiveWorkspaces';
import { FacultyFeedback } from '../../components/student/FacultyFeedback';
import { RecentResults } from '../../components/student/RecentResults';
import { RecentActivity } from '../../components/student/RecentActivity';
import { GroupsPage } from './Groups/Groups';
import { Alert } from '../../components/ui/Alert';
import { UploadCloud, X, Check, FileCode, GitBranch } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { studentProfile } from '../../data/studentMockData';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const activeUser = user || studentProfile;

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Form states for new submission modal
  const [selectedWorkspace, setSelectedWorkspace] = useState('CS204-DSA');
  const [submissionTitle, setSubmissionTitle] = useState('Red-Black Tree Complexity Revision');
  const [notes, setNotes] = useState('Added space complexity bounds and handled null root edge case.');

  const handleModalSubmit = (e) => {
    e.preventDefault();
    setSubmissionSuccess(true);
    setTimeout(() => {
      setSubmissionSuccess(false);
      setShowSubmissionModal(false);
    }, 1800);
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
          onNewSubmission={() => setShowSubmissionModal(true)}
        />

        {/* Dashboard Main Workspace View */}
        <main className="flex-1 p-6 lg:p-8 space-y-8 max-w-7xl w-full mx-auto">

          {activeTab === 'groups' ? (
            <GroupsPage />
          ) : (
            <>
              {/* Student Welcome Banner */}
              <div className="bg-vault-surface/85 border border-teal-500/20 rounded-2xl p-6 sm:p-7 shadow-card-subtle relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/80 border border-teal-500/30 text-[11px] font-mono text-teal-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    ACADEMIC SESSION ACTIVE • {activeUser.role.toUpperCase()} PROFILE
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
                    Welcome back, {activeUser.full_name || activeUser.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
                    You have <strong className="text-amber-300">1 faculty revision request</strong> pending for <i>NexaVault Core Storage Engine</i>. All 4 course vaults are synchronized.
                  </p>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
                  <span className="text-xs font-mono text-slate-400">Semester Index</span>
                  <span className="text-xl sm:text-2xl font-bold font-display text-teal-300 bg-teal-950/60 border border-teal-500/30 px-3 py-1 rounded-xl">
                    3.92 / 4.00
                  </span>
                </div>
              </div>

              {/* Overview Metrics Cards */}
              <MetricsCards />

              {/* Submission & Updates Lifecycle Tracker (Key Feature) */}
              <SubmissionTracker
                onActionRequired={() => setShowSubmissionModal(true)}
              />

              {/* Two-Column Grid: Active Workspaces & Faculty Feedback */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ActiveWorkspaces />
                <FacultyFeedback
                  onUploadRevision={() => setShowSubmissionModal(true)}
                />
              </div>

              {/* Two-Column Grid: Recent Results & Audit Log Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <RecentResults />
                <RecentActivity />
              </div>
            </>
          )}

        </main>

        {/* Global Footer */}
        <footer className="p-6 border-t border-vault-border/30 text-center text-xs font-mono text-slate-600 flex flex-col sm:flex-row justify-between items-center max-w-7xl w-full mx-auto gap-2">
          <p>© 2026 NexaVault Platform. Academic Workspace & Submission Lifecycle Engine.</p>
          <div className="flex items-center gap-4">
            <span className="text-teal-500/80">• Active Node: NV-NODE-01</span>
            <span>•</span>
            <span className="text-slate-400">Status: Operational</span>
          </div>
        </footer>

      </div>

      {/* New Submission / Upload Revision Modal */}
      {showSubmissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-vault-surface border border-teal-500/30 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-vault-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-display">New Code Artifact Submission</h3>
                  <p className="text-xs text-slate-400">Upload revision for faculty evaluation</p>
                </div>
              </div>

              <button
                onClick={() => setShowSubmissionModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {submissionSuccess ? (
              <Alert
                type="success"
                title="Artifact Uploaded Successfully"
                message="Your submission has been pushed to the NexaVault Auto-Grader queue and notified to Dr. Sarah Jenkins."
              />
            ) : (
              <form onSubmit={handleModalSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target Workspace</label>
                  <select
                    value={selectedWorkspace}
                    onChange={(e) => setSelectedWorkspace(e.target.value)}
                    className="w-full bg-vault-canvas text-white border border-vault-border rounded-lg p-2.5 outline-none focus:border-teal-500"
                  >
                    <option value="CS204-DSA">CS204-DSA — DSA Algorithmic Vault</option>
                    <option value="CS301-ASE">CS301-ASE — Advanced Software Engineering Lab</option>
                    <option value="CS208-DBS">CS208-DBS — Database Systems Core</option>
                    <option value="CS305-OSK">CS305-OSK — Operating Systems Kernel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Submission Title / Tag</label>
                  <input
                    type="text"
                    value={submissionTitle}
                    onChange={(e) => setSubmissionTitle(e.target.value)}
                    className="w-full bg-vault-canvas text-white border border-vault-border rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Revision Notes & Edge Case Summary</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-vault-canvas text-white border border-vault-border rounded-lg p-2.5 outline-none focus:border-teal-500 resize-none font-sans"
                  />
                </div>

                <div className="p-3 rounded-lg bg-vault-canvas border border-dashed border-teal-500/40 text-center space-y-1">
                  <FileCode size={24} className="mx-auto text-teal-400" />
                  <p className="font-mono text-slate-300">Drag & drop source files or connected Git commit</p>
                  <p className="text-[10px] text-slate-500">Supported: .cpp, .py, .c, .zip, Git PR #15</p>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSubmissionModal(false)}
                    className="px-4 py-2 rounded-lg bg-vault-elevated border border-vault-border text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold shadow-sm hover:shadow-teal-glow"
                  >
                    Submit Artifact →
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
