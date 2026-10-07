import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Bell, 
  Pin, 
  Calendar, 
  FolderGit2, 
  ArrowLeft, 
  AlertCircle
} from 'lucide-react';
import { workspaceApi } from '../../api/workspaceApi';

export const WorkspacesView = ({ onNavigate, onSelectProject }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  const loadWorkspaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workspaceApi.getMyWorkspaces();
      setWorkspaces(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const openWorkspaceDetail = async (ws) => {
    setSelectedWorkspace(ws);
    // Refresh detailed data
    try {
      const detailed = await workspaceApi.getWorkspace(ws.id);
      setSelectedWorkspace(detailed);
    } catch (err) {
      // Fallback to initial ws if detailed request fails
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px] font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
          <p className="text-xs font-sans text-slate-400">Loading enrolled workspaces...</p>
        </div>
      </div>
    );
  }

  // View: Workspace Detail
  if (selectedWorkspace) {
    return (
      <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto font-sans">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-3 pb-4 border-b border-vault-border/40 font-sans">
          <button
            onClick={() => setSelectedWorkspace(null)}
            className="p-1.5 rounded-lg bg-vault-canvas hover:bg-vault-elevated border border-vault-border text-slate-300 hover:text-white transition-colors font-sans"
            title="Back to workspaces list"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2 font-sans">
            <span className="text-xs text-slate-400 font-sans">Workspaces</span>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-mono font-semibold text-teal-400">{selectedWorkspace.id}</span>
          </div>
        </div>

        {/* Workspace Info Card */}
        <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4 font-sans">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-vault-border/50">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/60 px-2.5 py-0.5 rounded border border-teal-500/30">
                  {selectedWorkspace.id}
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-sans font-semibold border ${
                  selectedWorkspace.is_open 
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-950/80 text-rose-400 border-rose-500/30'
                }`}>
                  {selectedWorkspace.is_open ? 'Enrollment & Rounds Open' : 'Closed'}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-white font-serif">{selectedWorkspace.name}</h2>
              <p className="text-xs text-slate-400 mt-1 font-sans">Term: {selectedWorkspace.term}</p>
            </div>

            {/* Project Shortcut */}
            <div className="flex items-center gap-2 shrink-0 font-sans">
              {selectedWorkspace.has_project ? (
                <button
                  onClick={() => {
                    if (onSelectProject) onSelectProject(selectedWorkspace.project_id);
                    onNavigate('projects');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold shadow-sm transition-all font-sans"
                >
                  <FolderGit2 size={16} />
                  <span>Open Group's Project</span>
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('projects')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold shadow-sm transition-all font-sans"
                >
                  <FolderGit2 size={16} />
                  <span>Create Project for Workspace</span>
                </button>
              )}
            </div>
          </div>

          {selectedWorkspace.description && (
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl font-sans">
              {selectedWorkspace.description}
            </p>
          )}
        </div>

        {/* Workspace Notice Board (Inside Workspace UI) */}
        <div className="space-y-4 font-sans">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-teal-400" />
              <h3 className="text-xl font-bold text-white font-serif">Workspace Notice Board</h3>
              <span className="text-[10px] font-sans font-semibold text-slate-500 uppercase">(Read-Only)</span>
            </div>
            <span className="text-xs text-slate-400 font-sans">
              {selectedWorkspace.notices?.length || 0} Notices
            </span>
          </div>

          {selectedWorkspace.notices?.length === 0 ? (
            <div className="p-6 rounded-xl bg-vault-surface/60 border border-vault-border/60 text-center text-xs text-slate-400 font-sans">
              No faculty notices published for this workspace yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
              {selectedWorkspace.notices.map((notice) => (
                <div
                  key={notice.id}
                  className={`p-5 rounded-xl border transition-all space-y-3 ${
                    notice.is_pinned
                      ? 'bg-vault-surface border-teal-500/40 shadow-sm shadow-teal-950/20'
                      : 'bg-vault-surface/80 border-vault-border/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      {notice.is_pinned && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-sans font-semibold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/30">
                          <Pin size={10} />
                          <span>PINNED NOTICE</span>
                        </div>
                      )}
                      <h4 className="text-sm font-bold text-white leading-snug font-sans">{notice.title}</h4>
                    </div>
                    <span className="text-xs font-sans text-slate-500 shrink-0">
                      {new Date(notice.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {notice.body}
                  </p>

                  {notice.image_url && (
                    <div className="rounded-lg overflow-hidden border border-vault-border/60 max-h-48">
                      <img src={notice.image_url} alt="Notice attachment" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="pt-2 border-t border-vault-border/40 text-xs font-sans text-slate-500 flex items-center justify-between">
                    <span>Posted by {notice.author_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Rounds Schedule */}
        <div className="space-y-4 font-sans">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-teal-400" />
              <h3 className="text-xl font-bold text-white font-serif">Evaluation Review Rounds</h3>
            </div>
            <span className="text-xs text-slate-400 font-sans">
              Independent Milestones
            </span>
          </div>

          {selectedWorkspace.review_rounds?.length === 0 ? (
            <div className="p-6 rounded-xl bg-vault-surface/60 border border-vault-border/60 text-center text-xs text-slate-400 font-sans">
              No review rounds configured for this workspace yet.
            </div>
          ) : (
            <div className="space-y-3 font-sans">
              {selectedWorkspace.review_rounds.map((round) => (
                <div
                  key={round.id}
                  className="p-5 rounded-xl bg-vault-surface border border-vault-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-sans font-semibold text-slate-300 bg-vault-canvas px-2 py-0.5 rounded border border-vault-border">
                        Round {round.order_index}
                      </span>
                      <h4 className="text-sm font-bold text-white font-sans">{round.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold border ${
                        round.is_open 
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30' 
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}>
                        {round.is_open ? 'Submissions Open' : 'Closed'}
                      </span>
                    </div>
                    {round.description && (
                      <p className="text-xs text-slate-400 font-sans">{round.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-6 shrink-0 text-xs font-sans">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase block font-sans">Max Marks</span>
                      <span className="text-sm font-bold text-teal-400 font-sans">{round.max_score} pts</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase block font-sans">Due Date</span>
                      <span className="text-slate-300 font-sans">{new Date(round.due_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    );
  }

  // View: Workspaces List
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-vault-border/40 font-sans">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight font-serif">
            Enrolled Workspaces
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Course workspaces your group is actively participating in.
          </p>
        </div>

        <button
          onClick={() => onNavigate('groups')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold shadow-sm transition-all font-sans"
        >
          <span>Enroll New Workspace</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 font-sans">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {workspaces.length === 0 ? (
        <div className="p-12 rounded-2xl bg-vault-surface/60 border border-vault-border/60 text-center space-y-4 font-sans">
          <Layers size={36} className="mx-auto text-slate-500" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white font-sans">No Enrolled Workspaces</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto font-sans">
              Your group is not currently participating in any course workspaces. Enroll using your instructor's Workspace ID in the Group Vault.
            </p>
          </div>
          <button
            onClick={() => onNavigate('groups')}
            className="px-4 py-2 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-medium hover:bg-teal-500/30 transition-colors font-sans"
          >
            Go to Group Vault
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-sans">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => openWorkspaceDetail(ws)}
              className="p-6 rounded-2xl bg-vault-surface border border-vault-border/70 hover:border-teal-500/40 cursor-pointer transition-all space-y-4 group font-sans"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">
                      {ws.id}
                    </span>
                    <span className="text-[11px] font-sans text-slate-400">{ws.term}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-teal-300 transition-colors font-sans">
                    {ws.name}
                  </h3>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold border ${
                  ws.is_open 
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30' 
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}>
                  {ws.is_open ? 'Open' : 'Closed'}
                </span>
              </div>

              {ws.description && (
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans">
                  {ws.description}
                </p>
              )}

              <div className="pt-3 border-t border-vault-border/50 flex items-center justify-between text-xs text-slate-400 font-sans">
                <div className="flex items-center gap-3 font-sans">
                  <span>{ws.review_rounds?.length || 0} Rounds</span>
                  <span>•</span>
                  <span>{ws.notices?.length || 0} Notices</span>
                </div>
                <span className="text-teal-400 font-sans group-hover:underline">
                  View Workspace →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
