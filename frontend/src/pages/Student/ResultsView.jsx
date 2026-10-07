import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Award, 
  TrendingUp, 
  Layers, 
  RefreshCw, 
  Calendar,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { resultApi } from '../../api/resultApi';

export const ResultsView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await resultApi.getMyResults();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load released results');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-sans text-sm">
        <RefreshCw size={20} className="animate-spin mr-3 text-teal-400" />
        Retrieving Released Evaluation Results...
      </div>
    );
  }

  const results = data?.results || [];
  const cumulativePct = data?.cumulative_percentage ?? 0;
  const totalEarned = data?.total_earned ?? 0;
  const totalPossible = data?.total_possible ?? 0;

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-tight">
            Academic Results & Evaluations
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-sans">
            Official published scores and qualitative evaluations released by course faculty across review rounds.
          </p>
        </div>

        <button
          onClick={fetchResults}
          className="self-start sm:self-auto px-3.5 py-2 rounded-lg bg-vault-surface hover:bg-vault-elevated border border-vault-border/60 text-slate-300 hover:text-white text-xs font-sans flex items-center gap-2 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Scores</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Cumulative Metrics Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* Cumulative Score */}
        <div className="bg-vault-surface/90 border border-teal-500/30 rounded-2xl p-5 shadow-card-subtle relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-slate-400 uppercase tracking-wider">Cumulative Average</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-sans">
              {cumulativePct.toFixed(1)}%
            </span>
            <span className="text-xs font-sans text-teal-400 font-semibold">
              {cumulativePct >= 80 ? 'Distinction' : cumulativePct >= 60 ? 'Passing' : 'Pending'}
            </span>
          </div>
          <div className="mt-3 w-full bg-vault-canvas h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-teal-400 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(cumulativePct, 100)}%` }}
            />
          </div>
        </div>

        {/* Total Earned Points */}
        <div className="bg-vault-surface/90 border border-vault-border/60 rounded-2xl p-5 shadow-card-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-slate-400 uppercase tracking-wider">Total Earned Points</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Award size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-sans">
              {totalEarned.toFixed(1)}
            </span>
            <span className="text-sm font-sans text-slate-400">
              / {totalPossible.toFixed(1)} pts
            </span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 font-sans">
            Across all officially published review rounds
          </p>
        </div>

        {/* Released Rounds Count */}
        <div className="bg-vault-surface/90 border border-vault-border/60 rounded-2xl p-5 shadow-card-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-slate-400 uppercase tracking-wider">Published Rounds</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileCheck size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-sans">
              {results.length}
            </span>
            <span className="text-xs font-sans text-slate-400">Rounds evaluated</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 font-sans">
            Unpublished and draft scores remain hidden
          </p>
        </div>

      </div>

      {/* Released Results Breakdown */}
      <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-vault-border/40 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-serif">Round-by-Round Official Scorecard</h2>
              <p className="text-xs text-slate-400">Component scores, point distribution, and faculty publication timestamps</p>
            </div>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="p-10 text-center bg-vault-canvas/50 rounded-xl border border-vault-border/40 space-y-3">
            <Award size={36} className="mx-auto text-slate-600" />
            <h4 className="text-sm font-bold text-white">No Official Results Published Yet</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Evaluation rounds are currently being evaluated or pending official faculty release. Check back once your instructor completes review deliberations.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((res) => (
              <div 
                key={res.id} 
                className="p-5 rounded-xl bg-vault-canvas/80 border border-vault-border/60 hover:border-teal-500/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Round & Workspace Context */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-teal-500/15 border border-teal-500/30 text-teal-300 font-sans text-[11px] font-bold">
                      Round {res.round_order}
                    </span>
                    <h3 className="text-sm font-bold text-white font-sans">{res.round_title}</h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
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
                  </div>
                </div>

                {/* Right: Scores & Performance */}
                <div className="flex items-center gap-6 self-end md:self-auto shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-bold font-sans text-white">
                      {res.score.toFixed(1)} <span className="text-xs text-slate-400">/ {res.max_score.toFixed(1)}</span>
                    </div>
                    <div className="text-[11px] font-sans font-semibold text-teal-400">
                      {res.percentage.toFixed(1)}%
                    </div>
                  </div>

                  <div className="w-16 h-16 rounded-xl bg-vault-surface border border-teal-500/20 flex flex-col items-center justify-center p-2">
                    <span className="text-[10px] font-sans text-slate-400 uppercase">Grade</span>
                    <span className="text-base font-bold font-sans text-teal-300">
                      {res.percentage >= 90 ? 'A+' : res.percentage >= 80 ? 'A' : res.percentage >= 70 ? 'B' : res.percentage >= 60 ? 'C' : 'F'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
