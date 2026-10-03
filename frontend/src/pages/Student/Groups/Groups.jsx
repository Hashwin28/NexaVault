import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  LogIn, 
  Crown, 
  User, 
  Trash2, 
  LogOut, 
  Copy, 
  Check, 
  Layers, 
  FolderGit2, 
  Key, 
  X, 
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { studentGroups as initialMockGroups, studentProfile } from '../../../data/studentMockData';
import { useAuth } from '../../../context/AuthContext';

export const GroupsPage = () => {
  const { user } = useAuth();
  const currentUser = user || studentProfile;
  const currentUserName = currentUser.full_name || currentUser.name || "Alex Chen";
  const currentUserAvatar = currentUser.avatar || "AC";

  // Group state
  const [groups, setGroups] = useState(initialMockGroups);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Alert state
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Form states - Create Group
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCode, setNewGroupCode] = useState(`NV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [newWorkspaceCode, setNewWorkspaceCode] = useState('CS204-DSA');
  const [newProjectTitle, setNewProjectTitle] = useState('');

  // Form states - Join Group
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');

  // Auto-generate code when opening create modal
  const handleOpenCreateModal = () => {
    const randomCode = `NV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    setNewGroupCode(randomCode);
    setNewGroupName('');
    setNewProjectTitle('');
    setShowCreateModal(true);
  };

  // Helper function to trigger temporary feedback toast
  const showFeedback = (type, text) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  // Copy code to clipboard
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Handler: Create Group
  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupCode.trim()) return;

    const workspaceTitles = {
      'CS204-DSA': 'DSA Algorithmic Vault',
      'CS301-ASE': 'Advanced Software Engineering Lab',
      'CS208-DBS': 'Database Systems Core',
      'CS305-OSK': 'Operating Systems Kernel'
    };

    const newGroup = {
      id: `grp-${Date.now()}`,
      name: newGroupName.trim(),
      code: newGroupCode.trim().toUpperCase(),
      workspaceCode: newWorkspaceCode,
      workspaceTitle: workspaceTitles[newWorkspaceCode] || newWorkspaceCode,
      projectTitle: newProjectTitle.trim() || `${newWorkspaceCode} Group Project`,
      lead: currentUserName,
      leadAvatar: currentUserAvatar,
      members: [
        {
          name: currentUserName,
          role: 'Leader',
          avatar: currentUserAvatar,
          isUser: true,
          isLeader: true
        }
      ]
    };

    setGroups([newGroup, ...groups]);
    setShowCreateModal(false);
    showFeedback('success', `Group "${newGroup.name}" created! Unique Code: ${newGroup.code}`);
  };

  // Handler: Join Group by Code
  const handleJoinGroup = (e) => {
    e.preventDefault();
    setJoinError('');

    const targetCode = joinCodeInput.trim().toUpperCase();
    if (!targetCode) {
      setJoinError('Please enter a valid Group Code.');
      return;
    }

    const targetGroup = groups.find(g => g.code.toUpperCase() === targetCode);

    if (!targetGroup) {
      setJoinError('Invalid Group Code. Please check the code and try again.');
      return;
    }

    const isAlreadyMember = targetGroup.members.some(
      m => m.isUser || m.name.toLowerCase() === currentUserName.toLowerCase()
    );

    if (isAlreadyMember) {
      setJoinError(`You are already a member of "${targetGroup.name}".`);
      return;
    }

    // Add student as member
    const updatedGroups = groups.map(g => {
      if (g.id === targetGroup.id) {
        return {
          ...g,
          members: [
            ...g.members,
            {
              name: currentUserName,
              role: 'Member',
              avatar: currentUserAvatar,
              isUser: true,
              isLeader: false
            }
          ]
        };
      }
      return g;
    });

    setGroups(updatedGroups);
    setShowJoinModal(false);
    setJoinCodeInput('');
    showFeedback('success', `Successfully joined group "${targetGroup.name}"!`);
  };

  // Handler: Leave Group (Member option)
  const handleLeaveGroup = (groupId, groupName) => {
    const updatedGroups = groups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          members: g.members.filter(m => !m.isUser && m.name.toLowerCase() !== currentUserName.toLowerCase())
        };
      }
      return g;
    });

    setGroups(updatedGroups);
    showFeedback('info', `You left the group "${groupName}".`);
  };

  // Handler: Delete Group (Leader option)
  const handleDeleteGroup = (groupId, groupName) => {
    if (window.confirm(`Are you sure you want to delete the group "${groupName}"? This action cannot be undone.`)) {
      setGroups(groups.filter(g => g.id !== groupId));
      showFeedback('error', `Group "${groupName}" has been deleted.`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200 select-none">
      
      {/* Toast Feedback Banner */}
      {feedbackMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium transition-all shadow-lg ${
          feedbackMessage.type === 'success' 
            ? 'bg-teal-500/15 border-teal-500/40 text-teal-300' 
            : feedbackMessage.type === 'error'
            ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            : 'bg-sky-500/15 border-sky-500/40 text-sky-300'
        }`}>
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="shrink-0" />
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Module Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-vault-surface/90 border border-vault-border/60 p-6 rounded-2xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-display flex items-center gap-2.5">
            <Users size={24} className="text-teal-400" />
            Student Groups
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Create or join academic project groups using a unique Group Code.
          </p>
        </div>

        {/* Primary Operations Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => { setShowJoinModal(true); setJoinError(''); setJoinCodeInput(''); }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-vault-canvas hover:bg-vault-elevated border border-vault-border text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-sm"
          >
            <LogIn size={15} className="text-teal-400" />
            <span>Join Group</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all shadow-sm hover:shadow-teal-glow"
          >
            <Plus size={16} />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* Groups List */}
      <div className="space-y-4">
        {groups.map((group) => {
          // Check current user status in this group
          const isUserLeader = group.lead.toLowerCase() === currentUserName.toLowerCase() || 
            group.members.some(m => (m.isUser || m.name.toLowerCase() === currentUserName.toLowerCase()) && m.isLeader);

          const isUserMember = group.members.some(
            m => m.isUser || m.name.toLowerCase() === currentUserName.toLowerCase()
          );

          return (
            <div 
              key={group.id}
              className="bg-vault-surface border border-vault-border/60 hover:border-teal-500/30 rounded-2xl p-6 transition-all duration-150 space-y-5"
            >
              {/* Group Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-vault-border/40">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-white font-display">{group.name}</h3>
                    {isUserLeader && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-500/20 border border-teal-400/40 text-teal-300 font-mono text-[10px]">
                        <Crown size={11} className="text-amber-400" />
                        Group Leader (You)
                      </span>
                    )}
                    {isUserMember && !isUserLeader && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-300 font-mono text-[10px]">
                        Member (You)
                      </span>
                    )}
                  </div>

                  {/* Group Associations */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                    <span className="flex items-center gap-1.5 font-mono text-slate-300">
                      <Layers size={13} className="text-teal-400" />
                      {group.workspaceCode}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5 font-sans">
                      <FolderGit2 size={13} className="text-sky-400" />
                      {group.projectTitle}
                    </span>
                  </div>
                </div>

                {/* Group Code Pill */}
                <div className="flex items-center gap-2 bg-vault-canvas border border-vault-border px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-auto">
                  <Key size={13} className="text-teal-400" />
                  <span className="text-xs font-mono font-bold text-slate-200 tracking-wider">
                    {group.code}
                  </span>
                  <button
                    onClick={() => handleCopyCode(group.code)}
                    title="Copy Group Code"
                    className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                  >
                    {copiedCode === group.code ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>

              {/* Members Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400 uppercase tracking-wider text-[10px]">
                    Group Members ({group.members.length})
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Leader: <strong className="text-teal-300">{group.lead}</strong>
                  </span>
                </div>

                {/* Members List Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {group.members.map((member, idx) => {
                    const isCurrentMemberUser = member.isUser || member.name.toLowerCase() === currentUserName.toLowerCase();

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                          member.isLeader || member.role === 'Leader'
                            ? 'bg-teal-950/20 border-teal-500/30'
                            : isCurrentMemberUser
                            ? 'bg-sky-950/20 border-sky-500/30'
                            : 'bg-vault-canvas/70 border-vault-border/40'
                        }`}
                      >
                        {/* Member Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-display shrink-0 ${
                          member.isLeader || member.role === 'Leader'
                            ? 'bg-teal-500/25 text-teal-300 border border-teal-400/50'
                            : 'bg-vault-elevated text-slate-300 border border-vault-border'
                        }`}>
                          {member.avatar}
                        </div>

                        {/* Member Name & Role */}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate flex items-center gap-1">
                            <span>{member.name}</span>
                            {isCurrentMemberUser && (
                              <span className="text-[9px] font-mono text-teal-400">(You)</span>
                            )}
                          </div>
                          <span className={`text-[10px] font-mono block truncate ${
                            member.isLeader || member.role === 'Leader' ? 'text-amber-400' : 'text-slate-400'
                          }`}>
                            {member.isLeader || member.role === 'Leader' ? '👑 Leader' : 'Member'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group Action Footer */}
              <div className="pt-3 border-t border-vault-border/40 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 font-mono">
                  Share code <strong className="text-slate-300">{group.code}</strong> with teammates to invite them.
                </span>

                <div>
                  {isUserLeader ? (
                    <button
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition-colors"
                    >
                      <Trash2 size={14} />
                      <span>Delete Group</span>
                    </button>
                  ) : isUserMember ? (
                    <button
                      onClick={() => handleLeaveGroup(group.id, group.name)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
                    >
                      <LogOut size={14} />
                      <span>Leave Group</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowJoinModal(true);
                        setJoinCodeInput(group.code);
                        setJoinError('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-medium transition-colors"
                    >
                      <LogIn size={14} />
                      <span>Join with Code</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {groups.length === 0 && (
        <div className="p-12 text-center bg-vault-surface border border-vault-border rounded-2xl space-y-3">
          <Users size={36} className="mx-auto text-slate-500" />
          <h4 className="text-base font-bold text-white">No Groups Available</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You are not part of any group yet. Click "Create Group" to start your own group as Leader or "Join Group" using a shared Group Code.
          </p>
        </div>
      )}

      {/* Modal 1: Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-vault-surface border border-teal-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            
            <div className="flex items-center justify-between pb-3 border-b border-vault-border/50">
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-amber-400" />
                <h3 className="text-base font-bold text-white font-display">Create New Group</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Storage Squad"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-vault-canvas border border-vault-border rounded-lg p-2.5 text-white placeholder:text-slate-500 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Unique Group Code</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={newGroupCode}
                    onChange={(e) => setNewGroupCode(e.target.value.toUpperCase())}
                    className="w-full bg-vault-canvas border border-vault-border rounded-lg p-2.5 text-teal-300 font-mono font-bold tracking-wider outline-none focus:border-teal-500 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => setNewGroupCode(`NV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`)}
                    className="px-3 py-2.5 rounded-lg bg-vault-canvas border border-vault-border text-slate-300 hover:text-white text-[11px] font-mono shrink-0"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Share this code with teammates so they can join.</p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Associated Workspace</label>
                <select
                  value={newWorkspaceCode}
                  onChange={(e) => setNewWorkspaceCode(e.target.value)}
                  className="w-full bg-vault-canvas border border-vault-border rounded-lg p-2.5 text-white outline-none focus:border-teal-500 font-mono"
                >
                  <option value="CS204-DSA">CS204-DSA — DSA Algorithmic Vault</option>
                  <option value="CS301-ASE">CS301-ASE — Advanced Software Engineering Lab</option>
                  <option value="CS208-DBS">CS208-DBS — Database Systems Core</option>
                  <option value="CS305-OSK">CS305-OSK — Operating Systems Kernel</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Associated Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. B-Tree Indexing Engine"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  className="w-full bg-vault-canvas border border-vault-border rounded-lg p-2.5 text-white placeholder:text-slate-500 outline-none focus:border-teal-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-teal-950/30 border border-teal-500/20 text-[11px] text-teal-300 flex items-center gap-2">
                <Crown size={14} className="text-amber-400 shrink-0" />
                <span>You ({currentUserName}) will automatically be set as the <strong>Group Leader</strong>.</span>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-vault-elevated border border-vault-border text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                >
                  Create Group
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Modal 2: Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-vault-surface border border-teal-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            
            <div className="flex items-center justify-between pb-3 border-b border-vault-border/50">
              <div className="flex items-center gap-2">
                <LogIn size={18} className="text-teal-400" />
                <h3 className="text-base font-bold text-white font-display">Join Group with Code</h3>
              </div>
              <button 
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleJoinGroup} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Enter Group Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NV-ALPHA-2026"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-vault-canvas border border-vault-border rounded-lg p-3 text-teal-300 font-mono font-bold tracking-wider uppercase outline-none focus:border-teal-500 placeholder:text-slate-600 text-center text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                  Ask your Group Leader for the unique 8-character Group Code.
                </p>
              </div>

              {joinError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-lg bg-vault-elevated border border-vault-border text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                >
                  Join Group
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
