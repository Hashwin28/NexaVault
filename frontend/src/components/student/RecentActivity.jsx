import React from 'react';
import { History, GitCommit, CheckCircle2, MessageSquare, ShieldCheck } from 'lucide-react';
import { recentActivity } from '../../data/studentMockData';

export const RecentActivity = () => {
  const iconMap = {
    test: CheckCircle2,
    feedback: MessageSquare,
    github: GitCommit,
    security: ShieldCheck,
  };

  return (
    <div className="bg-vault-surface/85 border border-vault-border/70 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-vault-border/50">
        <div>
          <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <History size={18} className="text-teal-400" />
            Recent Activity & Audit Trail
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable log of system events, commits, and reviews
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">Real-Time Sync</span>
      </div>

      <div className="space-y-3">
        {recentActivity.map((act) => {
          const Icon = iconMap[act.type] || History;
          return (
            <div
              key={act.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-vault-canvas border border-vault-border/50 text-xs"
            >
              <div className="w-7 h-7 rounded-lg bg-vault-elevated border border-vault-border flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 font-sans leading-relaxed">{act.text}</p>
                <span className="text-[10px] font-mono text-slate-500">{act.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
