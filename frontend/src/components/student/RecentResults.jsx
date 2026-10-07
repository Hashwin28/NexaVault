import React from 'react';
import { Award, Download } from 'lucide-react';
import { recentResults } from '../../data/studentMockData';

export const RecentResults = () => {
  return (
    <div className="bg-vault-surface/85 border border-vault-border/70 rounded-2xl p-6 shadow-sm space-y-5 font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-vault-border/50">
        <div>
          <h2 className="text-lg font-bold text-white font-sans flex items-center gap-2">
            <Award size={18} className="text-emerald-400" />
            Recent Grade Results
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluated submissions, rubrics, and final grade index entries
          </p>
        </div>
        <span className="text-xs font-sans text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-md font-semibold">
          Average: 96.4%
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recentResults.map((res) => (
          <div
            key={res.id}
            className="p-4 rounded-xl bg-vault-canvas border border-vault-border hover:border-emerald-500/40 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded">
                  {res.course}
                </span>
                <span className="text-xs font-bold text-white font-sans bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                  Grade {res.grade}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white font-sans">{res.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">Evaluator: {res.evaluator}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-vault-surface border border-vault-border/40 text-xs text-slate-300 italic font-sans">
                "{res.feedback}"
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-vault-border/40 flex items-center justify-between text-xs font-sans">
              <span className="font-sans text-emerald-300 font-bold text-sm">
                Score: {res.score}
              </span>

              <button className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs font-medium font-sans">
                <Download size={14} />
                <span>Rubric PDF</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
