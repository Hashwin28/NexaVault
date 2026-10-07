import React from 'react';
import { Layers, GitBranch, ArrowUpRight } from 'lucide-react';
import { activeWorkspaces } from '../../data/studentMockData';

export const ActiveWorkspaces = () => {
  return (
    <div className="bg-vault-surface/85 border border-vault-border/70 rounded-2xl p-6 shadow-sm space-y-5 font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-vault-border/50">
        <div>
          <h2 className="text-lg font-bold text-white font-sans flex items-center gap-2">
            <Layers size={18} className="text-teal-400" />
            Active Course Workspaces
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized course vaults & repository environments
          </p>
        </div>
        <span className="text-xs font-sans text-teal-400 bg-teal-950/60 border border-teal-500/30 px-2.5 py-1 rounded-md font-medium">
          4 Active Vaults
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeWorkspaces.map((ws) => (
          <div
            key={ws.id}
            className="p-4 rounded-xl bg-vault-canvas border border-vault-border hover:border-teal-500/40 transition-all duration-200 group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-semibold text-teal-400 bg-teal-950/60 border border-teal-500/20 px-2 py-0.5 rounded">
                  {ws.code}
                </span>
                <span className="text-xs font-sans text-slate-400">
                  {ws.lastActivity}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white font-sans group-hover:text-teal-300 transition-colors">
                {ws.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Instructor: <span className="text-slate-300 font-medium">{ws.instructor}</span>
              </p>

              {/* Progress Bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Completion</span>
                  <span className="font-sans text-teal-300 font-bold">{ws.progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-vault-elevated overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full transition-all duration-500" 
                    style={{ width: `${ws.progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Commit Footer & Repo Link */}
            <div className="mt-4 pt-3 border-t border-vault-border/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-400 truncate max-w-[220px]">
                <GitBranch size={13} className="text-teal-400 shrink-0" />
                <span className="truncate text-xs font-mono">{ws.lastCommit}</span>
              </div>

              <a
                href={`https://${ws.repoUrl}`}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-teal-300 transition-colors p-1"
                aria-label="Open Repository"
              >
                <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
