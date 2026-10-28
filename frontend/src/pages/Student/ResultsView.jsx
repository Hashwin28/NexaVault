import React, { useState, useEffect } from 'react';
import { Award, FileCheck, Layers, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
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

  const results = summaryData?.results || [];
  const totalEarned = summaryData?.total_earned ?? 0.0;
  const totalPossible = summaryData?.total_possible ?? 0.0;
  const cumulativePct = summaryData?.cumulative_percentage ?? 0.0;

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-tight">
            Academic Results & Marks
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-sans">
            Official published evaluation marks and verified faculty feedback for your deliverables.
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

      {/* Aggregate Score Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cumulative Marks */}
        <div className="bg-vault-surface/90 border border-vault-border/60 rounded-2xl p-5 shadow-card-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-slate-400 uppercase tracking-wider">Total Marks Awarded</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Award size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              {totalEarned}
            </span>
            <span className="text-sm font-mono text-slate-400">
              / {totalPossible} marks
            </span>
          </div>
          <div className="mt-2 text-xs font-mono text-teal-400">
            {cumulativePct.toFixed(1)}% overall score
          </div>
        </div>

        {/* Released Rounds Count */}
        <div className="bg-vault-surface/90 border border-vault-border/60 rounded-2xl p-5 shadow-card-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-slate-400 uppercase tracking-wider">Published Assessments</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileCheck size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              {results.length}
            </span>
            <span className="text-xs font-sans text-slate-400">assessments released</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 font-sans">
            Only officially published marks are shown. Unpublished grades remain protected.
          </p>
        </div>
      </div>

      {/* Released Results Breakdown */}
      <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-vault-border/40 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white font-serif">Assessment Breakdown</h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Verified marks and evaluation notes per course review round.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs font-mono text-slate-500">
            Loading released assessment marks...
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-vault-border/60 rounded-xl bg-vault-canvas/50">
            <p className="text-sm font-semibold text-slate-300 font-serif">No Marks Released Yet</p>
            <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto mt-1">
              Your submissions are being evaluated by course faculty. Results will appear here once officially published.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((res) => (
              <div
                key={res.id}
                className="p-5 rounded-xl bg-vault-canvas/70 border border-vault-border/60 hover:border-vault-border transition-all space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Metadata */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-teal-500/15 border border-teal-500/30 text-teal-300 font-sans text-[11px] font-bold">
                        Round {res.round_order}
                      </span>
                      <h3 className="text-sm font-bold text-white font-sans">{res.round_title}</h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {res.status || 'Published'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1 font-sans">
                        <Layers size={13} className="text-slate-500" />
                        {res.workspace_name} <span className="font-mono text-slate-500">({res.workspace_id})</span>
                      </span>
                      {res.released_at && (
                        <span className="inline-flex items-center gap-1 font-sans text-[11px] text-slate-500">
                          <Calendar size={12} />
                          Released {new Date(res.released_at).toLocaleDateString()}
                        </span>
                      )}
                      {res.reviewer_name && (
                        <span className="font-mono text-[11px] text-slate-400">
                          • Evaluated by: <strong className="text-slate-300">{res.reviewer_name}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Marks Only */}
                  <div className="flex items-center gap-4 self-end md:self-auto shrink-0">
                    <div className="text-right px-4 py-2.5 rounded-xl bg-vault-surface border border-vault-border/60">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block">Marks Obtained</span>
                      <div className="text-base font-bold font-mono text-white">
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
    </div>
  );
};
