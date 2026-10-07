import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, GitCommit } from 'lucide-react';
import { submissionLifecycle } from '../../data/studentMockData';

export const SubmissionTracker = ({ onActionRequired }) => {
  return (
    <div className="bg-vault-surface/85 border border-teal-500/20 rounded-2xl p-6 sm:p-7 shadow-card-subtle relative overflow-hidden font-sans">
      {/* Header Accent */}
      <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-vault-border/50">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-teal-950/80 border border-teal-500/30 text-xs font-sans font-semibold text-teal-400 uppercase tracking-wider mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            LIFECYCLE CORE
          </div>
          <h2 className="text-xl font-bold text-white font-sans">
            Submission & Revision Lifecycle Tracker
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-sans">
            Active Artifact: <span className="text-slate-200 font-mono">SUB-DSA-042 (Red-Black Tree Module)</span>
          </p>
        </div>

        <button
          onClick={onActionRequired}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors font-sans"
        >
          <AlertTriangle size={15} />
          <span>Faculty Action Required</span>
        </button>
      </div>

      {/* 6-Step Visual Lifecycle Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 relative py-2 font-sans">
        {submissionLifecycle.map((item, index) => {
          const isCompleted = item.status === 'COMPLETED';
          const isAction = item.status === 'ACTION_REQUIRED';
          const isPending = item.status === 'PENDING';

          return (
            <div
              key={index}
              className={`
                relative p-4 rounded-xl border flex flex-col justify-between transition-all duration-200
                ${isCompleted ? 'bg-teal-950/20 border-teal-500/30 text-slate-200' : ''}
                ${isAction ? 'bg-amber-500/10 border-amber-500/50 text-amber-100 shadow-md ring-1 ring-amber-500/30' : ''}
                ${isPending ? 'bg-vault-canvas/60 border-vault-border text-slate-400' : ''}
                ${item.status === 'WAITING' ? 'bg-vault-canvas/30 border-vault-border/30 text-slate-500' : ''}
              `}
            >
              {/* Top Step Counter & Indicator Icon */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-sans font-bold tracking-widest uppercase opacity-75">
                  Step 0{item.step}
                </span>
                {isCompleted && <CheckCircle2 size={16} className="text-teal-400" />}
                {isAction && <AlertTriangle size={16} className="text-amber-400 animate-bounce" />}
                {isPending && <Clock size={16} className="text-slate-400" />}
              </div>

              {/* Step Title & Details */}
              <div className="space-y-1">
                <h4 className="text-xs font-bold font-sans text-white leading-tight">
                  {item.name}
                </h4>
                <p className="text-[10px] font-sans opacity-80">{item.date}</p>
                <p className="text-[11px] font-sans opacity-90 leading-snug pt-1">
                  {item.detail}
                </p>
              </div>

              {/* Connecting Step Arrow (Desktop) */}
              {index < submissionLifecycle.length - 1 && (
                <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600">
                  <ArrowRight size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lifecycle Motto Footer */}
      <div className="mt-5 pt-4 border-t border-vault-border/40 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2 font-sans">
        <div className="flex items-center gap-2 font-sans text-xs">
          <GitCommit size={14} className="text-teal-400" />
          <span>Full Trail: Project → Submission → Updates → Faculty Feedback → Resubmission → Final Result</span>
        </div>
        <span className="text-teal-400 font-medium hover:underline cursor-pointer font-sans">
          View Audit Log Details →
        </span>
      </div>
    </div>
  );
};
