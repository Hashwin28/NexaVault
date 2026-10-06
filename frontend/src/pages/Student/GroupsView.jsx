import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  KeyRound, 
  RefreshCw, 
  LogOut, 
  Layers, 
  Check, 
  Copy, 
  AlertCircle,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { groupApi } from '../../api/groupApi';
import { useAuth } from '../../context/AuthContext';

export const GroupsView = ({ onNavigate }) => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [group, setGroup] = useState(null);

  // Form states
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [newCustomCode, setNewCustomCode] = useState('');
  const [enrollWorkspaceId, setEnrollWorkspaceId] = useState('');

  // Modals / toggles
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadGroup = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await groupApi.getMyGroup();
      setGroup(data);
    } catch (err) {
      if (err.status === 404) {
        setGroup(null);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroup();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await groupApi.createGroup(createName.trim(), createCode.trim() || null);
      setGroup(res);
      setSuccessMsg(`Group "${res.name}" created successfully!`);
      setCreateName('');
      setCreateCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await groupApi.joinGroup(joinCode.trim().toUpperCase());
      setGroup(res);
      setSuccessMsg(`Joined group "${res.name}" successfully!`);
      setJoinCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeCode = async (e) => {
    e.preventDefault();
    if (!group) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await groupApi.changeCode(group.id, newCustomCode.trim() ? newCustomCode.trim().toUpperCase() : null);
      setGroup(res);
      setSuccessMsg('Group code successfully updated! Old code has been invalidated.');
      setShowCodeModal(false);
      setNewCustomCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnrollWorkspace = async (e) => {
    e.preventDefault();
    if (!group || !enrollWorkspaceId.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await groupApi.enrollWorkspace(group.id, enrollWorkspaceId.trim());
      setSuccessMsg(res.message);
      setShowEnrollModal(false);
      setEnrollWorkspaceId('');
      if (res.group) setGroup(res.group);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!group) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await groupApi.leaveGroup(group.id);
      setSuccessMsg(res.message);
      setGroup(null);
      setShowLeaveConfirm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (group?.code) {
      navigator.clipboard.writeText(group.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
          <p className="text-xs font-mono text-slate-400">Loading group vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-vault-border/40">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight font-display">
            Student Group Vault
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Equal peer collaborative units (2–5 members). No leader. Any member can change codes or enroll.
          </p>
        </div>

        {group && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCodeModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-vault-canvas hover:bg-vault-elevated border border-vault-border text-slate-200 text-xs font-medium transition-colors"
            >
              <RefreshCw size={14} />
              <span>Change Code</span>
            </button>

            <button
              onClick={() => setShowEnrollModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold shadow-sm transition-colors"
            >
              <Layers size={14} />
              <span>Enroll in Workspace</span>
            </button>

            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition-colors"
            >
              <LogOut size={14} />
              <span>Leave</span>
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 text-sm">×</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-teal-400 hover:text-teal-200 text-sm">×</button>
        </div>
      )}

      {/* View: Active Group Present */}
      {group ? (
        <div className="space-y-6">
          {/* Main Group Details Card */}
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-vault-border/50">
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-teal-400 uppercase tracking-wider bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/30">
                  Active Group
                </span>
                <h3 className="text-xl font-bold text-white">{group.name}</h3>
                <p className="text-xs text-slate-400">
                  Created on {new Date(group.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Group Join Code */}
              <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/80 flex items-center gap-4">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Shareable Group Code</span>
                  <span className="text-lg font-mono font-bold text-teal-300 tracking-wider">{group.code}</span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="p-2 rounded-lg bg-vault-surface hover:bg-vault-elevated border border-vault-border text-slate-300 hover:text-white transition-colors"
                  title="Copy code"
                >
                  {copiedCode ? <Check size={16} className="text-teal-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* Member Equality Notice */}
            <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/20 text-xs text-slate-300 flex items-start gap-3">
              <Users size={18} className="text-teal-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-white">Equal Rights Collaboration Model</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  All group members share equal operational authority. There is no group leader. Any member can update the team code, enroll into workspaces, or submit deliverables. No member can remove another member.
                </p>
              </div>
            </div>

            {/* Members Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Group Members ({group.members.length} / 5)
                </h4>
                {group.members.length < 2 && (
                  <span className="text-[11px] text-amber-400 font-mono">
                    ⚠️ Need ≥ 2 members to enroll or submit
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-vault-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-vault-canvas/60 text-slate-400 font-mono text-[11px] border-b border-vault-border">
                    <tr>
                      <th className="p-3.5">Member Name</th>
                      <th className="p-3.5">Email</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Joined Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-vault-border/50 text-slate-200">
                    {group.members.map((m) => (
                      <tr key={m.id} className="hover:bg-vault-canvas/40 transition-colors">
                        <td className="p-3.5 font-semibold text-white">
                          {m.full_name} {m.id === user?.id && <span className="text-[10px] text-teal-400 font-mono font-normal">(You)</span>}
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">{m.email}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-950/80 text-teal-400 border border-teal-500/30">
                            Equal Member
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">
                          {new Date(m.joined_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* View: No Active Group (Create or Join) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          {/* Create Group Panel */}
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-vault-border/50">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create a Group</h3>
                <p className="text-xs text-slate-400">Form a new academic group alone and invite peers</p>
              </div>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Group Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Core Team"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500/60"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Custom Code <span className="text-slate-500 font-normal">(Optional, Alphanumeric min 6 chars)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. ALPH2026 (Leave empty to auto-generate)"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-teal-500/60"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !createName.trim()}
                className="w-full py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <span>Create Group</span>
                <ArrowRight size={14} />
              </button>
            </form>
          </div>

          {/* Join Group Panel */}
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-vault-border/50">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <UserPlus size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Join by Code</h3>
                <p className="text-xs text-slate-400">Enter the unique code provided by your peer</p>
              </div>
            </div>

            <form onSubmit={handleJoinGroup} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Group Code *</label>
                <input
                  type="text"
                  placeholder="e.g. ALPHA2026"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-teal-500/60"
                />
              </div>

              <div className="p-3 rounded-lg bg-vault-canvas/60 text-[11px] text-slate-400 space-y-1">
                <p>• Joining is immediate and requires no leader approval.</p>
                <p>• A student can belong to only ONE group at a time.</p>
                <p>• Maximum group capacity is strictly 5 members.</p>
              </div>

              <button
                type="submit"
                disabled={submitting || !joinCode.trim()}
                className="w-full py-2.5 rounded-lg bg-vault-canvas hover:bg-vault-elevated border border-vault-border disabled:opacity-50 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2"
              >
                <span>Join Group</span>
                <ArrowRight size={14} />
              </button>
            </form>
          </div>

        </div>
      )}

      {/* Modal: Change Code */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-surface border border-teal-500/30 rounded-2xl p-6 max-w-md w-full space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-vault-border">
              <h3 className="text-sm font-bold text-white font-mono uppercase">Change Group Code</h3>
              <button onClick={() => setShowCodeModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Any current group member can change the code. The previous code stops working immediately. Existing members remain unaffected.
            </p>

            <form onSubmit={handleChangeCode} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  New Code <span className="text-slate-500 font-normal">(Leave blank to auto-generate)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. NEWCODE99"
                  value={newCustomCode}
                  onChange={(e) => setNewCustomCode(e.target.value.toUpperCase())}
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs font-mono focus:outline-none focus:border-teal-500/60"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold"
                >
                  Update Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Enroll Workspace */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-surface border border-teal-500/30 rounded-2xl p-6 max-w-md w-full space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-vault-border">
              <h3 className="text-sm font-bold text-white font-mono uppercase">Enroll Group in Workspace</h3>
              <button onClick={() => setShowEnrollModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Enter the unique Workspace ID provided by your faculty (e.g. <span className="font-mono text-teal-400">CS204-DSA</span>). Your group must have at least 2 members.
            </p>

            <form onSubmit={handleEnrollWorkspace} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Workspace ID *</label>
                <input
                  type="text"
                  placeholder="e.g. CS204-DSA"
                  value={enrollWorkspaceId}
                  onChange={(e) => setEnrollWorkspaceId(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs font-mono focus:outline-none focus:border-teal-500/60"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !enrollWorkspaceId.trim()}
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold"
                >
                  Enroll Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Leave */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-surface border border-rose-500/30 rounded-2xl p-6 max-w-md w-full space-y-5 animate-in fade-in">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert size={22} />
              <h3 className="text-sm font-bold text-white font-mono uppercase">Confirm Leaving Group</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to leave <strong className="text-white">"{group.name}"</strong>? 
              {group.members.length === 1 && (
                <span className="block mt-2 text-rose-300 font-semibold">
                  ⚠️ You are the last member. Leaving will dissolve and delete this group.
                </span>
              )}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveGroup}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold"
              >
                Leave Group
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
