import React from 'react';
import { Layers, FolderGit2, Clock, Award } from 'lucide-react';
import { overviewMetrics } from '../../data/studentMockData';

export const MetricsCards = () => {
  const iconMap = {
    Grid: Layers,
    Folder: FolderGit2,
    Clock: Clock,
    Award: Award,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {overviewMetrics.map((item, index) => {
        const IconComponent = iconMap[item.icon] || Layers;
        return (
          <div
            key={index}
            className="bg-vault-surface/85 border border-vault-border/70 rounded-xl p-5 shadow-sm hover:border-teal-500/30 transition-all duration-200 group relative overflow-hidden"
          >
            {/* Ambient subtle glow background */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full filter blur-xl group-hover:bg-teal-500/10 transition-colors pointer-events-none" />

            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 font-sans tracking-wide uppercase">
                {item.title}
              </span>
              <div className="w-9 h-9 rounded-lg bg-vault-canvas border border-vault-border flex items-center justify-center text-teal-400 group-hover:border-teal-500/40 transition-colors">
                <IconComponent size={18} />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl sm:text-3xl font-bold text-white font-sans tracking-tight">
                {item.value}
              </h3>
              <p className="text-xs text-slate-400 font-sans flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                {item.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
