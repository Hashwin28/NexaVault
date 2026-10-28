import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FolderGit2, 
  GitBranch, 
  Layers, 
  Users, 
  MessageSquare, 
  Send, 
  Plus, 
  Check, 
  AlertCircle, 
  ExternalLink,
  Clock,
  CheckCircle2,
  Lock,
  Edit3,
  Calendar,
  FileText,
  RotateCw,
  RefreshCw
} from 'lucide-react';
import { projectApi } from '../../api/projectApi';
import { workspaceApi } from '../../api/workspaceApi';
import { submissionApi } from '../../api/submissionApi';
import { resultApi } from '../../api/resultApi';
import { useAuth } from '../../context/AuthContext';
import GitHubRepoDashboard from '../../components/common/GitHubRepoDashboard';

const VALID_SECTIONS = ['overview', 'submissions', 'github', 'progress', 'review', 'results'];

// --- SECTION SKELETON LOADERS ---

const OverviewSkeleton = () => (
  <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-6 animate-pulse">
    <div className="space-y-2">
      <div className="h-3 w-24 bg-slate-800 rounded" />
      <div className="h-4 w-full bg-slate-800/60 rounded" />
      <div className="h-4 w-2/3 bg-slate-800/60 rounded" />
    </div>
    <div className="pt-4 border-t border-vault-border/50 space-y-3">
      <div className="h-3 w-36 bg-slate-800 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 rounded-lg bg-vault-canvas border border-vault-border space-y-2">
            <div className="h-4 w-28 bg-slate-800 rounded" />
            <div className="h-3 w-36 bg-slate-800/50 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SubmissionsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2].map((i) => (
      <div key={i} className="p-5 rounded-xl bg-vault-surface border border-vault-border space-y-3">
        <div className="flex justify-between items-center pb-3 border-b border-vault-border/50">
          <div className="space-y-1">
            <div className="h-4 w-40 bg-slate-800 rounded" />
            <div className="h-3 w-32 bg-slate-800/50 rounded" />
          </div>
          <div className="h-7 w-28 bg-slate-800 rounded" />
        </div>
        <div className="h-16 bg-vault-canvas rounded-lg border border-vault-border/40" />
      </div>
    ))}
  </div>
);

const GitHubSkeleton = () => (
  <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-5 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="h-4 w-48 bg-slate-800 rounded" />
      <div className="h-8 w-32 bg-slate-800 rounded" />
    </div>
    <div className="space-y-2 pt-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 rounded-lg bg-vault-canvas border border-vault-border/60 flex justify-between items-center">
          <div className="h-3 w-64 bg-slate-800 rounded" />
          <div className="h-3 w-20 bg-slate-800/60 rounded" />
        </div>
      ))}
    </div>
  </div>
);

const ProgressSkeleton = () => (
  <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-5 animate-pulse">
    <div className="space-y-2">
      <div className="h-4 w-48 bg-slate-800 rounded" />
      <div className="h-3 w-72 bg-slate-800/60 rounded" />
    </div>
    <div className="space-y-2 pt-2">
      <div className="flex justify-between">
        <div className="h-3 w-28 bg-slate-800 rounded" />
        <div className="h-3 w-12 bg-teal-900 rounded" />
      </div>
      <div className="h-3 w-full bg-vault-canvas rounded-full border border-vault-border" />
    </div>
    <div className="pt-4 border-t border-vault-border/50 space-y-2">
      <div className="h-3 w-36 bg-slate-800/60 rounded" />
      <div className="h-3 w-44 bg-slate-800/60 rounded" />
    </div>
  </div>
);

const ReviewSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {[1, 2].map((i) => (
      <div key={i} className="p-5 rounded-xl bg-vault-surface border border-vault-border space-y-2">
        <div className="flex justify-between items-center">
          <div className="h-4 w-36 bg-slate-800 rounded" />
          <div className="h-3 w-20 bg-teal-900 rounded" />
        </div>
        <div className="h-16 bg-vault-canvas rounded-lg border border-vault-border/40" />
      </div>
    ))}
  </div>
);

const ResultsSkeleton = () => (
  <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4 animate-pulse">
    <div className="space-y-1">
      <div className="h-4 w-48 bg-slate-800 rounded" />
      <div className="h-3 w-64 bg-slate-800/60 rounded" />
    </div>
    <div className="divide-y divide-vault-border/50 pt-2">
      {[1, 2].map((i) => (
        <div key={i} className="py-3 flex justify-between items-center">
          <div className="space-y-1">
            <div className="h-4 w-32 bg-slate-800 rounded" />
            <div className="h-3 w-24 bg-slate-800/60 rounded" />
          </div>
          <div className="h-5 w-20 bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  </div>
);

export const ProjectsView = ({ defaultProjectId, initialSection, onNavigate }) => {
  const { user } = useAuth();

  // Primary page state
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Enrolled workspaces & current project
  const [workspaces, setWorkspaces] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  
  // Subsection navigation state
  const [activeTab, setActiveTabState] = useState(() => {
    return (initialSection && VALID_SECTIONS.includes(initialSection)) ? initialSection : 'overview';
  });

  // Section-specific loaded data
  const [submissions, setSubmissions] = useState([]);
  const [workspaceRounds, setWorkspaceRounds] = useState([]);
  const [githubData, setGithubData] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [reviewsData, setReviewsData] = useState([]);
  const [myResults, setMyResults] = useState([]);

  // Section loading & error states
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionError, setSectionError] = useState(null);

  // Modal & form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createWorkspaceId, setCreateWorkspaceId] = useState('');
  const [createProjectName, setCreateProjectName] = useState('');
  const [createProjectDesc, setCreateProjectDesc] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);


  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedRoundForSubmit, setSelectedRoundForSubmit] = useState(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [submissionSha, setSubmissionSha] = useState('');
  const [isDraftCheck, setIsDraftCheck] = useState(false);
  const [submittingDeliverable, setSubmittingDeliverable] = useState(false);

  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [linkingGithub, setLinkingGithub] = useState(false);

  // Client-side cache per project ID: { [projectId]: { updates, submissions, rounds, github, progress, reviews, results } }
  const projectCacheRef = useRef({});
  // In-flight request abort controller & monotonic sequence counter for race protection
  const activeAbortCtrlRef = useRef(null);
  const requestSeqRef = useRef(0);

  // Sync active section with prop changes (e.g. from hash navigation)
  useEffect(() => {
    if (initialSection && VALID_SECTIONS.includes(initialSection) && initialSection !== activeTab) {
      setActiveTabState(initialSection);
    }
  }, [initialSection]);

  // Sync activeTab changes to URL hash
  const setActiveTab = (newTab) => {
    if (!VALID_SECTIONS.includes(newTab)) return;
    setActiveTabState(newTab);
    if (currentProject) {
      const targetHash = `#projects?projectId=${currentProject.id}&section=${newTab}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    }
  };

  // --- INITIAL ESSENTIAL METADATA LOAD ---
  const loadInitialData = async () => {
    setInitialLoading(true);
    setError(null);
    try {
      const wsList = await workspaceApi.getMyWorkspaces();
      setWorkspaces(wsList || []);

      let projIdToLoad = defaultProjectId;
      if (!projIdToLoad) {
        const firstWithProject = (wsList || []).find((w) => w.has_project && w.project_id);
        if (firstWithProject) {
          projIdToLoad = firstWithProject.project_id;
        }
      }

      if (projIdToLoad) {
        await selectProjectById(projIdToLoad, wsList);
      } else {
        setCurrentProject(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to initialize projects.');
    } finally {
      setInitialLoading(false);
    }
  };

  const selectProjectById = async (projId, wsList = workspaces) => {
    try {
      // 1. Fetch essential project metadata ONLY (fast single query, cached on backend)
      const proj = await projectApi.getProject(projId);
      setCurrentProject(proj);

      // Seed repo url if present
      if (proj.github_repo_url) {
        setGithubRepoUrl(proj.github_repo_url);
      }

      // Check if workspace rounds were already embedded in wsList
      const ws = (wsList || []).find((w) => w.id === proj.workspace_id);
      if (ws?.review_rounds) {
        setWorkspaceRounds(ws.review_rounds);
        if (!projectCacheRef.current[proj.id]) projectCacheRef.current[proj.id] = {};
        projectCacheRef.current[proj.id].rounds = ws.review_rounds;
      }

      // Update URL hash without unmounting
      const targetHash = activeTab !== 'overview' 
        ? `#projects?projectId=${proj.id}&section=${activeTab}` 
        : `#projects?projectId=${proj.id}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    } catch (err) {
      setError(err.message || 'Project not found or access denied.');
      setCurrentProject(null);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [defaultProjectId]);

  // --- SECTION-LEVEL LAZY LOADER WITH DEDUPLICATION & ABORT PROTECTION ---
  const loadActiveSectionData = useCallback(async (section, forceRefresh = false) => {
    if (!currentProject) return;
    const projId = currentProject.id;
    const wsId = currentProject.workspace_id;

    // Overview needs only the project metadata already loaded
    if (section === 'overview') {
      setSectionLoading(false);
      setSectionError(null);
      return;
    }

    if (!projectCacheRef.current[projId]) {
      projectCacheRef.current[projId] = {};
    }
    const projCache = projectCacheRef.current[projId];

    // 1. Check client-side memory cache (0ms latency, zero network requests)
    if (!forceRefresh) {
      if (section === 'updates' && projCache.updates) {
        setUpdates(projCache.updates);
        setSectionLoading(false);
        setSectionError(null);
        return;
      }
      if (section === 'submissions' && projCache.submissions && projCache.rounds) {
        setSubmissions(projCache.submissions);
        setWorkspaceRounds(projCache.rounds);
        setSectionLoading(false);
        setSectionError(null);
        return;
      }
      if (section === 'github' && projCache.github !== undefined) {
        setGithubData(projCache.github);
        setSectionLoading(false);
        setSectionError(null);
        return;
      }
      if (section === 'progress' && projCache.progress) {
        setProgressData(projCache.progress);
        setSectionLoading(false);
        setSectionError(null);
        return;
      }
      if (section === 'review' && projCache.reviews) {
        setReviewsData(projCache.reviews);
        setSectionLoading(false);
        setSectionError(null);
        return;
      }
      if (section === 'results' && projCache.results) {
        setMyResults(projCache.results);
        setSectionLoading(false);
        setSectionError(null);
        return;
      }
    }

    // 2. Abort previous in-flight subsection request to prevent stale overwrite
    if (activeAbortCtrlRef.current) {
      activeAbortCtrlRef.current.abort();
    }
    const abortCtrl = new AbortController();
    activeAbortCtrlRef.current = abortCtrl;
    const currentSeq = ++requestSeqRef.current;

    setSectionLoading(true);
    setSectionError(null);

    try {
      if (section === 'updates') {
        const data = await projectApi.getUpdates(projId, { signal: abortCtrl.signal });
        if (requestSeqRef.current !== currentSeq) return; // stale response protection
        projCache.updates = data || [];
        setUpdates(data || []);
      } 
      else if (section === 'submissions') {
        const [subsData, roundsData] = await Promise.all([
          projectApi.getProject(projId, { signal: abortCtrl.signal }) // keep fresh
            .then(() => submissionApi.getSubmissions(projId, { signal: abortCtrl.signal })),
          projCache.rounds 
            ? Promise.resolve(projCache.rounds) 
            : workspaceApi.getRounds(wsId, { signal: abortCtrl.signal }),
        ]);
        if (requestSeqRef.current !== currentSeq) return;
        projCache.submissions = subsData || [];
        projCache.rounds = roundsData || [];
        setSubmissions(subsData || []);
        setWorkspaceRounds(roundsData || []);
      } 
      else if (section === 'github') {
        const gh = await projectApi.getGithub(projId, { signal: abortCtrl.signal });
        if (requestSeqRef.current !== currentSeq) return;
        projCache.github = gh || null;
        setGithubData(gh || null);
        if (gh?.repo_url) setGithubRepoUrl(gh.repo_url);
      } 
      else if (section === 'progress') {
        const prog = await projectApi.getProgress(projId, { signal: abortCtrl.signal });
        if (requestSeqRef.current !== currentSeq) return;
        projCache.progress = prog;
        setProgressData(prog);
      } 
      else if (section === 'review') {
        const revs = await projectApi.getReviews(projId, { signal: abortCtrl.signal });
        if (requestSeqRef.current !== currentSeq) return;
        projCache.reviews = revs?.reviews || [];
        setReviewsData(revs?.reviews || []);
      } 
      else if (section === 'results') {
        const res = await resultApi.getMyResults({ signal: abortCtrl.signal });
        if (requestSeqRef.current !== currentSeq) return;
        projCache.results = res?.results || [];
        setMyResults(res?.results || []);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Intentionally cancelled due to tab switch; ignore silently
        return;
      }
      if (requestSeqRef.current === currentSeq) {
        setSectionError(err.message || `Failed to load ${section} data.`);
      }
    } finally {
      if (requestSeqRef.current === currentSeq) {
        setSectionLoading(false);
      }
    }
  }, [currentProject]);

  // Trigger lazy loading whenever activeTab or currentProject changes
  useEffect(() => {
    loadActiveSectionData(activeTab);
  }, [activeTab, currentProject, loadActiveSectionData]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (activeAbortCtrlRef.current) {
        activeAbortCtrlRef.current.abort();
      }
    };
  }, []);

  // --- MUTATION HANDLERS (with targeted cache invalidation) ---

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!createWorkspaceId.trim() || !createProjectName.trim()) return;

    setCreatingProject(true);
    setError(null);
    try {
      const newProj = await projectApi.createProject(
        createWorkspaceId.trim(),
        createProjectName.trim(),
        createProjectDesc.trim() || null
      );
      setSuccessMsg(`Project "${newProj.name}" created successfully!`);
      setShowCreateModal(false);
      setCreateProjectName('');
      setCreateProjectDesc('');
      await loadInitialData();
      await selectProjectById(newProj.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleLinkGithub = async (newUrl) => {
    const urlToUse = (typeof newUrl === 'string' ? newUrl : githubRepoUrl)?.trim();
    if (!currentProject || !urlToUse) return;

    setLinkingGithub(true);
    setError(null);
    try {
      const res = await projectApi.linkGithub(currentProject.id, urlToUse);
      setGithubData(res);
      setGithubRepoUrl(res.repo_url);
      if (projectCacheRef.current[currentProject.id]) {
        projectCacheRef.current[currentProject.id].github = res;
      }
      setSuccessMsg('GitHub repository connected successfully.');
    } catch (err) {
      setError(err.message || 'Failed to connect GitHub repository.');
    } finally {
      setLinkingGithub(false);
    }
  };

  const handleUnlinkGithub = async () => {
    if (!currentProject) return;
    if (!window.confirm('Disconnect this GitHub repository from the project?')) return;
    try {
      await projectApi.unlinkGithub(currentProject.id);
      setGithubData(null);
      setGithubRepoUrl('');
      if (projectCacheRef.current[currentProject.id]) {
        projectCacheRef.current[currentProject.id].github = null;
      }
      setSuccessMsg('GitHub repository disconnected.');
    } catch (err) {
      setError(err.message || 'Failed to disconnect GitHub repository.');
    }
  };

  const handleSubmitDeliverable = async (e) => {
    e.preventDefault();
    if (!currentProject || !selectedRoundForSubmit) return;

    setSubmittingDeliverable(true);
    setError(null);
    try {
      await submissionApi.createSubmission(currentProject.id, selectedRoundForSubmit.id, {
        notes: submissionNotes.trim() || null,
        link: submissionLink.trim() || null,
        githubCommitSha: submissionSha.trim() || null,
        isDraft: isDraftCheck,
      });

      setShowSubmitModal(false);
      setSubmissionNotes('');
      setSubmissionLink('');
      setSubmissionSha('');
      setIsDraftCheck(false);
      setSuccessMsg(isDraftCheck ? 'Submission saved as Draft.' : 'Deliverable submitted for review!');

      // Invalidate relevant cached tabs
      if (projectCacheRef.current[currentProject.id]) {
        projectCacheRef.current[currentProject.id].submissions = null;
        projectCacheRef.current[currentProject.id].progress = null;
      }
      await loadActiveSectionData('submissions', true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingDeliverable(false);
    }
  };

  const handleFinalizeDraft = async (submissionId) => {
    try {
      await submissionApi.finalizeSubmit(submissionId);
      setSuccessMsg('Draft finalized into SUBMITTED deliverable.');
      if (projectCacheRef.current[currentProject.id]) {
        projectCacheRef.current[currentProject.id].submissions = null;
        projectCacheRef.current[currentProject.id].progress = null;
      }
      await loadActiveSectionData('submissions', true);
    } catch (err) {
      setError(err.message);
    }
  };

  // Derived progress metric (prioritizes dedicated progress endpoint data, then current project percentage)
  const displayProgressPercent = progressData 
    ? Math.round(progressData.progress_percentage || 0)
    : Math.round(currentProject?.progress_percentage || 0);

  // Initial Full-Page Loading state
  if (initialLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
          <p className="text-xs font-sans text-slate-400">Loading project metadata...</p>
        </div>
      </div>
    );
  }

  // View: No project created yet
  if (!currentProject) {
    const enrolledWithNoProject = workspaces.filter((w) => !w.has_project);

    return (
      <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-vault-border/40">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight font-sans">
              Projects
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Course projects tied strictly to your group and enrolled workspaces.
            </p>
          </div>

          {enrolledWithNoProject.length > 0 && (
            <button
              onClick={() => {
                setCreateWorkspaceId(enrolledWithNoProject[0].id);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold shadow-sm transition-all"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Create Project</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="p-12 rounded-2xl bg-vault-surface/60 border border-vault-border/60 text-center space-y-4">
          <FolderGit2 size={36} className="mx-auto text-slate-500" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Active Projects</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {enrolledWithNoProject.length > 0
                ? `Your group is enrolled in ${enrolledWithNoProject.length} workspace(s) but has not yet created a project. Create your course project below.`
                : 'You need an enrolled workspace with at least 2 group members before you can create a project.'}
            </p>
          </div>

          {enrolledWithNoProject.length > 0 ? (
            <button
              onClick={() => {
                setCreateWorkspaceId(enrolledWithNoProject[0].id);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Create Course Project
            </button>
          ) : (
            <button
              onClick={() => onNavigate && onNavigate('workspaces')}
              className="px-4 py-2 rounded-lg bg-vault-canvas hover:bg-vault-elevated border border-vault-border text-slate-200 text-xs font-medium transition-colors"
            >
              View Workspaces
            </button>
          )}
        </div>

        {/* Modal: Create Project */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-vault-surface border border-teal-500/30 rounded-2xl p-6 max-w-md w-full space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-vault-border">
                <h3 className="text-sm font-bold text-white font-mono uppercase">Create Course Project</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Enrolled Workspace *</label>
                  <select
                    value={createWorkspaceId}
                    onChange={(e) => setCreateWorkspaceId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs focus:outline-none focus:border-teal-500/60"
                  >
                    {enrolledWithNoProject.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Project Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Distributed Storage Engine Core"
                    value={createProjectName}
                    onChange={(e) => setCreateProjectName(e.target.value)}
                    required
                    disabled={creatingProject}
                    className="w-full px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs focus:outline-none focus:border-teal-500/60"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Description <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of the deliverable architecture..."
                    value={createProjectDesc}
                    onChange={(e) => setCreateProjectDesc(e.target.value)}
                    disabled={creatingProject}
                    className="w-full px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs focus:outline-none focus:border-teal-500/60"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-slate-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingProject || !createProjectName.trim()}
                    className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    );
  }

  // View: Active Project with Non-Blocking Tabs
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      
      {/* Top Banner / Project Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-vault-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold text-teal-400 bg-teal-950/60 px-2.5 py-0.5 rounded border border-teal-500/30">
              {currentProject.workspace_id}
            </span>
            <span className="text-xs text-slate-400 font-sans">Group: {currentProject.group_name}</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight font-sans">
            {currentProject.name}
          </h2>
        </div>

        {/* Project Switcher if multiple projects */}
        {workspaces.filter((w) => w.has_project).length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Switch:</span>
            <select
              value={currentProject.id}
              onChange={(e) => selectProjectById(parseInt(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg bg-vault-canvas border border-vault-border text-xs text-white"
            >
              {workspaces.filter((w) => w.has_project).map((w) => (
                <option key={w.project_id} value={w.project_id}>
                  {w.id} Project
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 text-sm">×</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-teal-400 hover:text-teal-200 text-sm">×</button>
        </div>
      )}

      {/* Project Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-vault-border/60 overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'submissions', label: submissions.length > 0 ? `Submissions (${submissions.length})` : 'Submissions' },
          { id: 'github', label: 'GitHub' },
          { id: 'progress', label: `Progress (${displayProgressPercent}%)` },
          { id: 'review', label: reviewsData.length > 0 ? `Review (${reviewsData.length})` : 'Review' },
          { id: 'results', label: 'Results' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap outline-none ${
              activeTab === tab.id
                ? 'text-teal-300 border-b-2 border-teal-400 bg-teal-500/10 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-vault-canvas/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subsection-level error message with retry */}
      {sectionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{sectionError}</span>
          </div>
          <button
            onClick={() => loadActiveSectionData(activeTab, true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium transition-colors"
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* TAB 1: OVERVIEW (Essential Metadata) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-5">
            <div>
              <h3 className="text-sm font-mono uppercase tracking-wider text-slate-400">Description</h3>
              <p className="text-xs text-slate-200 leading-relaxed mt-1">
                {currentProject.description || 'No detailed description specified.'}
              </p>
            </div>

            <div className="pt-4 border-t border-vault-border/50">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                Current Group Members ({currentProject.members?.length || 0})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(currentProject.members || []).map((m) => (
                  <div key={m.id} className="p-3 rounded-lg bg-vault-canvas border border-vault-border text-xs space-y-0.5">
                    <p className="font-semibold text-white">{m.full_name}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{m.email}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-vault-border/50 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Created on {new Date(currentProject.created_at).toLocaleDateString()}</span>
              {currentProject.github_repo_url && (
                <a
                  href={currentProject.github_repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:underline flex items-center gap-1"
                >
                  <GitBranch size={13} />
                  <span>Repository</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

{/* TAB 3: SUBMISSIONS (Formal Deliverables Lifecycle) */}
      {activeTab === 'submissions' && (
        sectionLoading ? (
          <SubmissionsSkeleton />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Formal Deliverable Submissions
                </h3>
                <p className="text-xs text-slate-400">
                  Draft deliverables can be updated. Submitted deliverables are immutable and snapshotted.
                </p>
              </div>
            </div>

            {/* Rounds list with Submission Status */}
            <div className="space-y-4">
              {workspaceRounds.map((round) => {
                const submission = submissions.find((s) => s.round_id === round.id);
                const latestVer = submission?.latest_version;

                return (
                  <div key={round.id} className="p-5 rounded-xl bg-vault-surface border border-vault-border space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-vault-border/50">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-300 bg-vault-canvas px-2 py-0.5 rounded border border-vault-border shrink-0">
                            Round {round.order_index}
                          </span>
                          <h4 className="text-sm font-bold text-white break-words">{round.title}</h4>
                        </div>
                        <p className="text-xs text-slate-400 font-mono">Due: {new Date(round.due_date).toLocaleDateString()} • Max Marks: {round.max_score} pts</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {latestVer ? (
                          <span className={`px-2.5 py-1 rounded text-xs font-mono font-semibold border ${
                            latestVer.status === 'APPROVED'
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
                              : latestVer.status === 'REVISION_REQUESTED'
                              ? 'bg-amber-950/80 text-amber-400 border-amber-500/30'
                              : latestVer.status === 'DRAFT'
                              ? 'bg-slate-900 text-slate-300 border-slate-700'
                              : 'bg-teal-950/80 text-teal-400 border-teal-500/30'
                          }`}>
                            {latestVer.status} (v{latestVer.version_number})
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-slate-500">Not Submitted</span>
                        )}

                        {/* Action buttons */}
                        {round.is_open && (!latestVer || latestVer.status === 'REVISION_REQUESTED') && (
                          <button
                            onClick={() => {
                              setSelectedRoundForSubmit(round);
                              setShowSubmitModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold transition-colors"
                          >
                            {latestVer?.status === 'REVISION_REQUESTED' ? 'Submit New Version' : 'Submit Deliverable'}
                          </button>
                        )}

                        {latestVer?.status === 'DRAFT' && (
                          <button
                            onClick={() => handleFinalizeDraft(submission.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors"
                          >
                            Finalize Draft
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Version Details */}
                    {latestVer ? (
                      <div className="p-4 rounded-lg bg-vault-canvas border border-vault-border/60 text-xs space-y-2">
                        <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                          <span>Submitted by {latestVer.submitter_name}</span>
                          {latestVer.submitted_at && (
                            <span>{new Date(latestVer.submitted_at).toLocaleString()}</span>
                          )}
                          {latestVer.is_late && (
                            <span className="text-amber-400 font-bold">⚠️ Late Submission</span>
                          )}
                        </div>

                        {latestVer.notes && (
                          <p className="text-slate-200 leading-relaxed">{latestVer.notes}</p>
                        )}

                        {latestVer.link && (
                          <a
                            href={latestVer.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-400 hover:underline flex items-center gap-1 text-[11px]"
                          >
                            <ExternalLink size={12} />
                            <span>Deliverable Link</span>
                          </a>
                        )}

                        {/* Roster snapshot */}
                        {latestVer.roster_snapshot?.length > 0 && (
                          <div className="pt-2 border-t border-vault-border/40 text-[11px] text-slate-400">
                            <span className="font-mono text-slate-500 block mb-1">Frozen Roster Snapshot:</span>
                            <span className="text-slate-300">
                              {latestVer.roster_snapshot.map((m) => m.full_name).join(', ')}
                            </span>
                          </div>
                        )}

                        {/* Faculty Feedback & Next Action */}
                        {latestVer.feedback && (
                          <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 mt-2 ${
                            latestVer.status === 'REVISION_REQUESTED'
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-100'
                              : 'bg-teal-500/10 border-teal-500/30 text-slate-200'
                          }`}>
                            <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider">
                              <span className={latestVer.status === 'REVISION_REQUESTED' ? 'text-amber-400' : 'text-teal-400'}>
                                Faculty Evaluation Remarks {latestVer.reviewer_name && `(${latestVer.reviewer_name})`}:
                              </span>
                              {latestVer.reviewed_at && (
                                <span className="text-slate-400 font-normal">
                                  {new Date(latestVer.reviewed_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap font-sans text-xs text-slate-200">
                              {latestVer.feedback}
                            </p>
                            {latestVer.status === 'REVISION_REQUESTED' && (
                              <div className="pt-2 mt-2 border-t border-amber-500/30 text-[11px] font-sans text-amber-300 font-semibold flex items-center gap-2">
                                <span>⚡ Required Action:</span>
                                <span className="font-normal text-slate-200">
                                  Please address the faculty remarks above and submit a revised deliverable using the button above.
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No deliverable submitted yet for this milestone.</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submission Modal */}
            {showSubmitModal && selectedRoundForSubmit && (
              <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-vault-surface border border-teal-500/30 rounded-2xl p-6 max-w-md w-full space-y-5 animate-in fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-vault-border">
                    <h3 className="text-sm font-bold text-white font-mono uppercase">
                      Submit Deliverable: {selectedRoundForSubmit.title}
                    </h3>
                    <button onClick={() => setShowSubmitModal(false)} className="text-slate-400 hover:text-white">✕</button>
                  </div>

                  <form onSubmit={handleSubmitDeliverable} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Submission Notes *</label>
                      <textarea
                        rows={3}
                        placeholder="Summary of completed deliverables, test suite outcomes, or architecture overview..."
                        value={submissionNotes}
                        onChange={(e) => setSubmissionNotes(e.target.value)}
                        required
                        disabled={submittingDeliverable}
                        className="w-full px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs focus:outline-none focus:border-teal-500/60"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Artifact / Deliverable Link (Optional)</label>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/... or https://github.com/..."
                        value={submissionLink}
                        onChange={(e) => setSubmissionLink(e.target.value)}
                        disabled={submittingDeliverable}
                        className="w-full px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs font-mono focus:outline-none focus:border-teal-500/60"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">GitHub Commit SHA (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. 7c91498..."
                        value={submissionSha}
                        onChange={(e) => setSubmissionSha(e.target.value)}
                        disabled={submittingDeliverable}
                        className="w-full px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs font-mono focus:outline-none focus:border-teal-500/60"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="draftCheck"
                        checked={isDraftCheck}
                        onChange={(e) => setIsDraftCheck(e.target.checked)}
                        className="rounded border-vault-border text-teal-500 focus:ring-0"
                      />
                      <label htmlFor="draftCheck" className="text-xs text-slate-300">
                        Save as Draft (Allows editing before final review freeze)
                      </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowSubmitModal(false)}
                        className="px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-slate-300 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingDeliverable || !submissionNotes.trim()}
                        className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold"
                      >
                        {isDraftCheck ? 'Save Draft' : 'Submit for Review'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )
      )}

      {/* TAB 4: GITHUB (Project-Level Sync) */}
      {activeTab === 'github' && (
        sectionLoading ? (
          <GitHubSkeleton />
        ) : (
          <GitHubRepoDashboard
            repoUrl={githubData?.repo_url || currentProject.github_repo_url || githubRepoUrl}
            onLinkRepo={handleLinkGithub}
            onUnlinkRepo={handleUnlinkGithub}
            onSyncRepo={async () => {
              if (currentProject) {
                const res = await projectApi.syncGithub(currentProject.id);
                setGithubData(res);
                if (res?.repo_url) setGithubRepoUrl(res.repo_url);
                if (projectCacheRef.current[currentProject.id]) {
                  projectCacheRef.current[currentProject.id].github = res;
                }
              }
            }}
            syncedCommits={githubData?.commits || []}
            lastSyncedAt={githubData?.last_synced_at}
            linking={linkingGithub}
            projectMembers={currentProject.members || []}
          />
        )
      )}

      {/* TAB 5: PROGRESS (Staff-Set / Calculated Progress) */}
      {activeTab === 'progress' && (
        sectionLoading ? (
          <ProgressSkeleton />
        ) : (
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-base font-bold text-white font-sans">Project Progress</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Authoritative course progress verified by faculty and supported by milestone achievements.
                </p>
              </div>
              {progressData?.is_staff_override ? (
                <span className="px-2.5 py-1 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30 text-[11px] font-mono">
                  ★ Faculty Configured Progress
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-mono">
                  Calculated Milestone Progress
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="text-slate-400 font-medium">Authoritative Progress</span>
                <span className="text-teal-400 font-bold text-base">{displayProgressPercent}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-vault-canvas overflow-hidden border border-vault-border">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500 rounded-full"
                  style={{ width: `${displayProgressPercent}%` }}
                />
              </div>
              {progressData?.is_staff_override && progressData?.progress_updated_by_name && (
                <p className="text-[11px] text-slate-500 font-mono">
                  Last updated by faculty: {progressData.progress_updated_by_name}
                  {progressData.progress_updated_at && ` on ${new Date(progressData.progress_updated_at).toLocaleDateString()}`}
                </p>
              )}
            </div>

            {/* Assessment Milestone Calculation Breakdown */}
            <div className="pt-4 border-t border-vault-border/50 text-xs font-sans text-slate-400 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                  Curricular Assessment Milestones
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Completion: <strong className="text-white">{progressData?.calculated_progress_percentage ?? 0}%</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-vault-canvas p-3 rounded-xl border border-vault-border/60">
                <p>• Approved Marks: <strong className="text-white">{progressData?.approved_marks ?? 0} pts</strong></p>
                <p>• Total Course Weight: <strong className="text-white">{progressData?.total_round_marks ?? 0} pts</strong></p>
              </div>

              {progressData?.approved_rounds?.length > 0 ? (
                <div className="pt-2 space-y-1.5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-teal-400 block">
                    Approved Milestone Rounds:
                  </span>
                  <div className="space-y-1">
                    {progressData.approved_rounds.map((r) => (
                      <div key={r.round_id} className="flex justify-between items-center text-[11px] text-slate-300 bg-vault-canvas px-3 py-2 rounded-lg border border-vault-border/40 font-mono">
                        <span>Round {r.order_index}: {r.round_title}</span>
                        <span className="text-emerald-400 font-bold">+{r.max_score} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No milestone review rounds approved yet.</p>
              )}
            </div>
          </div>
        )
      )}

      {/* TAB 6: REVIEW (Feedback & Evaluation Notes) */}
      {activeTab === 'review' && (
        sectionLoading ? (
          <ReviewSkeleton />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-vault-border/40 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white font-sans uppercase tracking-wider">
                  Faculty Evaluation & Review Remarks
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Round-by-round qualitative feedback, review decisions, and revision notes from faculty evaluators.
                </p>
              </div>
            </div>

            {reviewsData.length === 0 ? (
              <div className="p-8 rounded-xl bg-vault-surface/60 border border-vault-border/60 text-center text-xs text-slate-400 font-sans">
                No faculty review notes or evaluation remarks posted yet.
              </div>
            ) : (
              <div className="space-y-4">
                {reviewsData.map((item, idx) => (
                  <div key={idx} className="p-5 rounded-xl bg-vault-surface border border-vault-border space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-b border-vault-border/40 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white font-sans text-sm">{item.round_title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          item.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : item.status === 'REVISION_REQUESTED'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        }`}>
                          {item.status === 'REVISION_REQUESTED' ? 'Revision Requested' : item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                        <span className="text-teal-400 font-semibold">Version {item.version_number}</span>
                        {item.reviewed_at && (
                          <span>• {new Date(item.reviewed_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    {item.reviewer_name && (
                      <p className="text-[11px] font-mono text-slate-400">
                        Evaluated by: <strong className="text-slate-200">{item.reviewer_name}</strong>
                      </p>
                    )}
                    <div className="p-3.5 rounded-lg bg-vault-canvas border border-vault-border/60 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                      <span className="text-[10px] font-mono uppercase text-teal-400 font-bold block mb-1">
                        Evaluation Remarks:
                      </span>
                      {item.feedback}
                    </div>
                    {item.status === 'REVISION_REQUESTED' && (
                      <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 font-sans">
                        ⚡ <strong>Action Needed:</strong> Your team must submit an updated deliverable addressing these points under the Submissions tab.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 7: RESULTS (Only Released Scores) */}
      {activeTab === 'results' && (
        sectionLoading ? (
          <ResultsSkeleton />
        ) : (
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white font-sans">Released Results for Project</h3>
                <p className="text-xs text-slate-400">Your individual released marks for this course project</p>
              </div>
            </div>

            {myResults.filter((r) => r.workspace_id === currentProject.workspace_id).length === 0 ? (
              <div className="p-6 rounded-xl bg-vault-canvas border border-vault-border text-center text-xs text-slate-400">
                No marks released yet for this project. Scores remain confidential until explicitly released by faculty.
              </div>
            ) : (
              <div className="divide-y divide-vault-border/50 text-xs">
                {myResults.filter((r) => r.workspace_id === currentProject.workspace_id).map((res) => (
                  <div key={res.id} className="py-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{res.round_title}</p>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase">
                            {res.status || 'Published'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Released: {new Date(res.released_at).toLocaleDateString()}
                          {res.reviewer_name && ` • Evaluated by ${res.reviewer_name}`}
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-sm font-bold text-teal-400">{res.score.toFixed(1)} / {res.max_score.toFixed(1)} pts</span>
                        <span className="text-[11px] text-slate-400 block">{res.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    {res.feedback && (
                      <div className="p-2.5 rounded bg-vault-canvas/90 border border-vault-border/50 text-[11px] text-slate-300 leading-relaxed font-sans">
                        <span className="font-mono text-[10px] text-teal-400 uppercase font-bold block mb-0.5">Faculty Feedback:</span>
                        {res.feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

    </div>
  );
};
