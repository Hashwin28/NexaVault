import React, { useState } from 'react';
import { Menu, Bell, Plus, GitBranch, ShieldCheck, Check } from 'lucide-react';
import { studentProfile } from '../../data/studentMockData';

export const Header = ({ onOpenSidebar, onNewSubmission }) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: 'Faculty Action Required', text: 'Dr. Sarah Jenkins requested Big-O complexity revision for SUB-DSA-042.', time: '1 hour ago', urgent: true },
    { id: 2, title: 'Auto-Grader Passed', text: '14/14 test cases passed for Red-Black Tree module.', time: '3 hours ago', urgent: false },
    { id: 3, title: 'Grade Released', text: 'Query Execution Planner scored 98/100 (Grade A+).', time: 'Yesterday', urgent: false },
  ];

  return (
    <header className="sticky top-0 z-30 w-full bg-vault-surface/90 backdrop-blur-md border-b border-vault-border/60 px-6 py-4 flex items-center justify-between select-none">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg bg-vault-canvas border border-vault-border"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white font-display">
              Student Dashboard
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-950/80 border border-teal-500/30 text-[11px] font-mono text-teal-400">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              {studentProfile.program}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
            NexaVault Platform • Academic Vault & Submission Lifecycle Core
          </p>
        </div>
      </div>

      {/* Right: Status Badges, Notifications & Primary Action */}
      <div className="flex items-center gap-3">
        
        {/* System Status Indicators */}
        <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-400 pr-3 border-r border-vault-border/50">
          <div className="flex items-center gap-1.5 text-teal-400 bg-teal-950/40 px-2.5 py-1 rounded-md border border-teal-500/20">
            <ShieldCheck size={14} />
            <span>Vault Sync Active</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300 bg-vault-canvas px-2.5 py-1 rounded-md border border-vault-border">
            <GitBranch size={14} className="text-teal-400" />
            <span>GitHub Connected</span>
          </div>
        </div>

        {/* Notifications Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 rounded-lg bg-vault-canvas hover:bg-vault-elevated border border-vault-border text-slate-300 hover:text-white transition-colors outline-none"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal-400" />
          </button>

          {/* Notifications Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-vault-surface border border-teal-500/30 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-vault-border/50 mb-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Notifications</h3>
                <span className="text-[10px] font-mono text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/30">
                  3 Unread
                </span>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border text-xs transition-colors ${
                      item.urgent 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
                        : 'bg-vault-canvas border-vault-border text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold mb-1">
                      <span>{item.title}</span>
                      <span className="text-[10px] opacity-75 font-mono">{item.time}</span>
                    </div>
                    <p className="opacity-90 leading-relaxed text-[11px]">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="pt-3 mt-3 border-t border-vault-border/50 text-center">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-teal-400 hover:underline font-medium"
                >
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Primary Quick Action Button */}
        <button
          onClick={onNewSubmission}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold shadow-sm hover:shadow-teal-glow transition-all outline-none"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline">New Submission</span>
        </button>

      </div>
    </header>
  );
};
