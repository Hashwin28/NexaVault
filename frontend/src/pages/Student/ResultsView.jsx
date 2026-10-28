import React, { useState, useEffect } from 'react';
import { Award, FileCheck, Calendar, AlertCircle, RefreshCw, FolderGit2 } from 'lucide-react';
import { resultApi } from '../../api/resultApi';
import { useAuth } from '../../context/AuthContext';

export const ResultsView = () => {
  const { user } = useAuth();
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await resultApi.getMyResults();
      setSummaryData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch academic results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const workspaces = summaryData?.workspaces || [];
  const flatResults = summaryData?.results || [];

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-sans tracking-tight">
            Academic Results & Marks
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-sans">
            Official published evaluation marks and verified faculty feedback organized by course workspace.
          </p>
        </div>
        <button
          onClick={fetchResults}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-vault-surface border border-vault-border/60 hover:border-teal-500/40 text-slate-200 text-xs rounded-xl font-sans transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Results</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Workspace-Wise Results Section */}
      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-slate-500 bg-vault-surface/40 rounded-2xl border border-vault-border/40">
          Loading authorized academic results...
        </div>
      ) : workspaces.length === 0 && flatResults.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-vault-border/60 rounded-2xl bg-vault-canvas/50 p-6">
          <Award size={32} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300 font-sans">No Workspaces or Results Found</h3>
          <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto mt-1">
            You are not currently enrolled in any active course workspaces or no submissions have been evaluated yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {workspaces.map((ws) => {
            const hasPublished = ws.results && ws.results.length > 0;
            return (
              <div
                key={ws.workspace_id}
                className="bg-vault-surface border border-vault-border/60 rounded-2xl p-6 space-y-6 shadow-card-subtle"
              >
                {/* Workspace Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-vault-border/40 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono text-xs font-semibold">
                        {ws.workspace_id}
                      </span>
                      <h2 className="text-lg font-bold text-white font-sans">
                        {ws.workspace_name}
                      </h2>
                      {ws.workspace_term && (
                        <span className="text-xs text-slate-400 font-mono bg-vault-canvas px-2 py-0.5 rounded border border-vault-border">
                          {ws.workspace_term}
                        </span>
                      )}
                    </div>
                    {ws.project_name && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-300 font-sans pt-0.5">
                        <FolderGit2 size={14} className="text-teal-400" />
                        <span>Project: <strong className="text-white font-medium">{ws.project_name}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Workspace-Specific Summary (Never combined across courses) */}
                  {hasPublished ? (
                    <div className="flex items-center gap-4 bg-vault-canvas px-4 py-2.5 rounded-xl border border-vault-border shrink-0">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400 block">Workspace Total</span>
                        <div className="text-base font-bold font-mono text-white">
                          {ws.total_earned} <span className="text-xs text-slate-400 font-normal">/ {ws.total_possible} marks</span>
                        </div>
                      </div>
                      <div className="text-right border-l border-vault-border pl-3">
                        <span className="text-xs font-mono uppercase text-teal-400 block font-bold">
                          {ws.percentage.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ws.published_rounds_count} released
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 font-mono bg-vault-canvas px-3 py-1 rounded-lg border border-vault-border/60">
                      No released marks yet
                    </span>
                  )}
                </div>

                {/* Published Assessments List or Empty State */}
                {!hasPublished ? (
                  <div className="py-10 text-center border border-dashed border-vault-border/60 rounded-xl bg-vault-canvas/40 px-4">
                    <p className="text-xs font-semibold text-slate-300 font-sans">No Marks Published Yet</p>
                    <p className="text-[11px] text-slate-500 font-sans max-w-md mx-auto mt-1">
                      Your submissions for {ws.workspace_name} are currently undergoing faculty evaluation. Published marks and official feedback will appear here once released by the instructor.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ws.results.map((res) => (
                      <div
                        key={res.id}
                        className="p-5 rounded-xl bg-vault-canvas/70 border border-vault-border/60 hover:border-vault-border transition-all space-y-3"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-teal-500/15 border border-teal-500/30 text-teal-300 font-sans text-xs font-semibold">
                                Round {res.round_order}
                              </span>
                              <h3 className="text-sm font-bold text-white font-sans">{res.round_title}</h3>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {res.status || 'Published'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-sans">
                              {res.released_at && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                                  <Calendar size={12} />
                                  Released {new Date(res.released_at).toLocaleDateString()}
                                </span>
                              )}
                              {res.reviewer_name && (
                                <span className="text-[11px] text-slate-400 font-mono">
                                  • Evaluated by: <strong className="text-slate-200 font-medium">{res.reviewer_name}</strong>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Marks Obtained */}
                          <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                            <div className="text-right px-4 py-2 rounded-xl bg-vault-surface border border-vault-border/60">
                              <span className="text-[10px] font-mono uppercase text-slate-400 block">Marks Obtained</span>
                              <div className="text-sm font-bold font-mono text-white">
                                {res.score} <span className="text-xs text-slate-400 font-normal">/ {res.max_score}</span>
                              </div>
                              <div className="text-[10px] font-mono text-teal-400 font-semibold">
                                {res.percentage.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Authorized Faculty Feedback */}
                        {res.feedback && (
                          <div className="mt-1 pt-3 border-t border-vault-border/50 text-xs font-sans">
                            <span className="text-[10px] font-mono uppercase text-teal-400 font-bold tracking-wider block mb-1">
                              Faculty Evaluation Remarks:
                            </span>
                            <p className="text-xs text-slate-200 leading-relaxed bg-vault-surface/60 p-3 rounded-lg border border-vault-border/40 whitespace-pre-wrap">
                              {res.feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
