import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  GitBranch, 
  FolderGit2, 
  Layers, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Shield, 
  ChevronRight,
  X,
  Code2,
  Calendar,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { studentGroups } from '../../../data/studentMockData';

export const GroupsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkspaceFilter, setSelectedWorkspaceFilter] = useState('ALL');
  const [selectedGroupModal, setSelectedGroupModal] = useState(null);

  // Extract unique workspaces for filter dropdown
  const workspaceOptions = ['ALL', ...new Set(studentGroups.map(g => g.workspaceCode))];

  // Filter groups
  const filteredGroups = studentGroups.filter(group => {
    const matchesSearch = 
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.tagline.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.projectTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.members.some(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesWorkspace = 
      selectedWorkspaceFilter === 'ALL' || group.workspaceCode === selectedWorkspaceFilter;

    return matchesSearch && matchesWorkspace;
  });

  // Helper status pill renderer
  const renderStatusPill = (status, label) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono">
            <CheckCircle2 size={12} className="text-emerald-400" />
            {label}
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[11px] font-mono">
            <Clock size={12} className="text-sky-400 animate-pulse" />
            {label}
          </span>
        );
      case 'IN_REVISION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono">
            <AlertCircle size={12} className="text-amber-400" />
            {label}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[11px] font-mono">
            <GitBranch size={12} className="text-teal-400" />
            {label}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Groups Page Header Banner */}
      <div className="bg-vault-surface/85 border border-teal-500/20 rounded-2xl p-6 sm:p-7 shadow-card-subtle relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/80 border border-teal-500/30 text-[11px] font-mono text-teal-400">
            <Users size={13} className="text-teal-400" />
            INDEPENDENT ACADEMIC TEAMS • 4 ACTIVE GROUPS
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
            Student Academic Groups & Team Vaults
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
            Collaborative team workspaces for course projects, code reviews, and combined repository submissions.
          </p>
        </div>

        {/* Quick Group Stats Summary */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-vault-canvas/90 border border-vault-border/60 rounded-xl px-4 py-3 text-center min-w-[110px]">
            <span className="block text-xl font-bold font-display text-teal-300">4</span>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Active Teams</span>
          </div>
          <div className="bg-vault-canvas/90 border border-vault-border/60 rounded-xl px-4 py-3 text-center min-w-[110px]">
            <span className="block text-xl font-bold font-display text-sky-300">15</span>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Team Members</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-vault-surface/60 border border-vault-border/40 p-4 rounded-xl">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search teams by name, project, or member..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-vault-canvas border border-vault-border rounded-lg text-xs text-white placeholder:text-slate-500 focus:border-teal-500/80 focus:outline-none transition-colors"
          />
        </div>

        {/* Workspace Filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <span className="text-xs font-mono text-slate-400 whitespace-nowrap">Filter Workspace:</span>
          <select
            value={selectedWorkspaceFilter}
            onChange={(e) => setSelectedWorkspaceFilter(e.target.value)}
            className="bg-vault-canvas border border-vault-border text-xs text-teal-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 font-mono"
          >
            <option value="ALL">All Workspaces (4)</option>
            {workspaceOptions.filter(w => w !== 'ALL').map(code => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredGroups.map((group) => {
          const progressPercent = Math.round((group.completedDeliverables / group.deliverablesCount) * 100);

          return (
            <div 
              key={group.id}
              className="bg-vault-surface border border-vault-border/60 hover:border-teal-500/40 rounded-2xl p-6 transition-all duration-200 shadow-sm hover:shadow-teal-glow/5 flex flex-col justify-between space-y-6 group"
            >
              {/* Card Header: Group Name & Status */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white font-display group-hover:text-teal-300 transition-colors">
                      {group.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {group.tagline}
                    </p>
                  </div>
                  {renderStatusPill(group.status, group.statusLabel)}
                </div>

                {/* Workspace & Project Associations */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-vault-canvas border border-vault-border text-[11px] font-mono text-slate-300">
                    <Layers size={12} className="text-teal-400" />
                    {group.workspaceCode}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-vault-canvas border border-vault-border text-[11px] font-mono text-slate-300">
                    <FolderGit2 size={12} className="text-sky-400" />
                    {group.projectTitle}
                  </span>
                </div>
              </div>

              {/* Deliverable Progress & Active Sprint */}
              <div className="space-y-2 bg-vault-canvas/60 border border-vault-border/30 p-3.5 rounded-xl">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">{group.activeSprint}</span>
                  <span className="font-mono text-teal-300 font-semibold text-[11px]">
                    {group.completedDeliverables}/{group.deliverablesCount} Deliverables ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full bg-vault-canvas h-2 rounded-full overflow-hidden border border-vault-border/40">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Members Avatar Stack & Lead Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Team Members ({group.members.length})</span>
                  <span className="text-[11px] font-mono text-slate-500">Lead: <strong className="text-slate-300">{group.lead}</strong></span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center -space-x-2">
                    {group.members.map((member, idx) => (
                      <div
                        key={idx}
                        title={`${member.name} (${member.role})`}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-display border-2 ${
                          member.isUser 
                            ? 'bg-teal-500/20 border-teal-400 text-teal-300 z-10' 
                            : 'bg-vault-canvas border-vault-border text-slate-300'
                        }`}
                      >
                        {member.avatar}
                      </div>
                    ))}
                  </div>

                  {/* Latest Activity Log */}
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 max-w-[200px] truncate">
                    <GitBranch size={13} className="text-teal-400 shrink-0" />
                    <span className="truncate">{group.lastActivity}</span>
                  </span>
                </div>
              </div>

              {/* Card Footer Action */}
              <div className="pt-2 border-t border-vault-border/40 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500 truncate max-w-[220px]">
                  {group.repoUrl}
                </span>
                <button
                  onClick={() => setSelectedGroupModal(group)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 hover:text-teal-200 text-xs font-medium transition-all"
                >
                  <span>Open Team Vault</span>
                  <ChevronRight size={14} />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="p-12 text-center bg-vault-surface border border-vault-border rounded-2xl space-y-3">
          <Users size={36} className="mx-auto text-slate-500" />
          <h4 className="text-base font-bold text-white">No Team Vaults Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No academic groups match your current search or workspace filter query. Try resetting your search filters.
          </p>
        </div>
      )}

      {/* Team Vault Inspection Modal */}
      {selectedGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-vault-surface border border-teal-500/30 rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-vault-border/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-400/30 text-teal-300 font-mono text-[10px]">
                    {selectedGroupModal.workspaceCode}
                  </span>
                  {renderStatusPill(selectedGroupModal.status, selectedGroupModal.statusLabel)}
                </div>
                <h3 className="text-xl font-bold text-white font-display">
                  {selectedGroupModal.name}
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  {selectedGroupModal.tagline}
                </p>
              </div>

              <button
                onClick={() => setSelectedGroupModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-vault-canvas border border-vault-border"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Sections */}
            <div className="space-y-6 text-xs">
              
              {/* Section 1: Associated Project & Repository */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-vault-canvas/80 border border-vault-border/50 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Target Course Project</span>
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <FolderGit2 size={14} className="text-sky-400" />
                    {selectedGroupModal.projectTitle}
                  </h4>
                  <p className="text-[11px] text-slate-400">{selectedGroupModal.workspaceTitle}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-vault-canvas/80 border border-vault-border/50 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">GitHub Team Repository</span>
                  <h4 className="font-mono font-medium text-teal-300 flex items-center gap-1.5 truncate">
                    <GitBranch size={14} className="text-teal-400 shrink-0" />
                    {selectedGroupModal.repoUrl}
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 size={10} /> Sync Status: Active
                  </span>
                </div>
              </div>

              {/* Section 2: Team Roster & Roles */}
              <div className="space-y-3">
                <h4 className="font-bold text-white font-display flex items-center gap-2 text-sm">
                  <Users size={16} className="text-teal-400" />
                  Team Roster & Contributions
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedGroupModal.members.map((m, i) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-xl border flex items-center gap-3 ${
                        m.isUser 
                          ? 'bg-teal-950/30 border-teal-500/30 text-teal-200' 
                          : 'bg-vault-canvas border-vault-border/50 text-slate-300'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs font-display shrink-0 ${
                        m.isUser ? 'bg-teal-500/25 border border-teal-400/40 text-teal-300' : 'bg-vault-elevated border border-vault-border text-slate-200'
                      }`}>
                        {m.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate flex items-center gap-1.5">
                          {m.name}
                          {m.isUser && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[9px] font-mono">You</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{m.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Active Sprint & Deliverables */}
              <div className="space-y-3 bg-vault-canvas/60 border border-vault-border/40 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white font-display flex items-center gap-2">
                    <Sparkles size={15} className="text-amber-400" />
                    {selectedGroupModal.activeSprint}
                  </h4>
                  <span className="font-mono text-teal-300 font-bold">
                    {selectedGroupModal.completedDeliverables} / {selectedGroupModal.deliverablesCount} Tasks Done
                  </span>
                </div>
                <div className="w-full bg-vault-canvas h-2.5 rounded-full overflow-hidden border border-vault-border/50">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full"
                    style={{ width: `${(selectedGroupModal.completedDeliverables / selectedGroupModal.deliverablesCount) * 100}%` }}
                  />
                </div>
              </div>

              {/* Section 4: Recent Activity Log */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Latest Group Commit Activity</span>
                <div className="p-3 rounded-lg bg-vault-canvas border border-vault-border/50 flex items-center justify-between">
                  <span className="font-mono text-slate-300 truncate">{selectedGroupModal.lastActivity}</span>
                  <span className="text-[10px] text-teal-400 font-mono shrink-0 ml-2">VERIFIED</span>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-vault-border/50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">Vault ID: {selectedGroupModal.id}</span>
              <button
                onClick={() => setSelectedGroupModal(null)}
                className="px-4 py-2 rounded-lg bg-vault-elevated hover:bg-vault-border text-slate-200 hover:text-white text-xs font-semibold transition-colors"
              >
                Close Inspection
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
