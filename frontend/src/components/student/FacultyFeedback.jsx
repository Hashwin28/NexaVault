import React from 'react';
import { MessageSquare, AlertCircle, Calendar, ArrowRight, UserCheck } from 'lucide-react';
import { facultyFeedbackList } from '../../data/studentMockData';

export const FacultyFeedback = ({ onUploadRevision }) => {
  return (
    <div className="bg-vault-surface/85 border border-amber-500/30 rounded-2xl p-6 shadow-sm space-y-5 font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-vault-border/50">
        <div>
          <h2 className="text-lg font-bold text-white font-sans flex items-center gap-2">
            <MessageSquare size={18} className="text-amber-400" />
            Faculty Feedback Requiring Action
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Direct review notes & revision instructions from course professors
          </p>
        </div>
        <span className="text-xs font-sans text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium">
          <AlertCircle size={13} /> Action Pending
        </span>
      </div>

      <div className="space-y-4">
        {facultyFeedbackList.map((fb) => (
          <div
            key={fb.id}
            className="p-4 rounded-xl bg-vault-canvas border border-vault-border hover:border-amber-500/40 transition-all space-y-3"
          >
            {/* Header Info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-xs font-bold font-sans">
                  <UserCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white font-sans">{fb.evaluator}</h4>
                  <p className="text-[10px] text-slate-400 font-sans">{fb.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-sans">
                <span className="text-amber-400 flex items-center gap-1 font-medium">
                  <Calendar size={13} /> {fb.dueDate}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                  {fb.priority} PRIORITY
                </span>
              </div>
            </div>

            {/* Target Module */}
            <div className="text-xs font-sans text-teal-400 bg-teal-950/40 border border-teal-500/20 p-2 rounded">
              Target: <span className="text-slate-200 font-semibold">{fb.target}</span>
            </div>

            {/* Message Body */}
            <p className="text-xs text-slate-300 leading-relaxed bg-vault-surface/60 p-3 rounded-lg border border-vault-border/40 font-sans">
              "{fb.message}"
            </p>

            {/* Action Footer */}
            <div className="pt-2 flex items-center justify-between font-sans text-xs">
              <span className="text-[11px] text-slate-400">
                Action: <strong className="text-amber-300">{fb.actionRequired}</strong>
              </span>

              <button
                onClick={onUploadRevision}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold shadow-sm transition-all"
              >
                <span>Upload Revision</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
