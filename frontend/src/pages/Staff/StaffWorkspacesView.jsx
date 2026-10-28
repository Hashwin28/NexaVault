import React, { useState, useEffect } from 'react';
import { workspaceApi } from '../../api/workspaceApi';
import { getMediaUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const StaffWorkspacesView = ({ selectedWorkspaceId, onSelectProject }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Active workspace selection
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(selectedWorkspaceId || null);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [subTab, setSubTab] = useState('overview'); // 'overview', 'notices', 'rounds', 'groups', 'projects'

  // Modals & forms state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', code: '', term: 'Fall 2026', description: '' });

  const [showRequestAccessModal, setShowRequestAccessModal] = useState(false);
  const [requestWsId, setRequestWsId] = useState('');

  // Workspace sub-tab data
  const [staffRequests, setStaffRequests] = useState([]);
  const [notices, setNotices] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [groups, setGroups] = useState([]);
  const [projects, setProjects] = useState([]);

  // Forms for workspace actions
  const [coStaffEmail, setCoStaffEmail] = useState('');
  
  // Notice form and image upload states
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    is_pinned: false,
  });
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Recalculate 24h expiration countdown every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    d.setHours(23, 59, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const formatDateForInput = (isoDate) => {
    if (!isoDate) return getDefaultDueDate();
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return getDefaultDueDate();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  // Round create form
  const [roundForm, setRoundForm] = useState({
    round_number: 1,
    name: '',
    description: '',
    weight: 20,
    max_score: 100,
    due_date: getDefaultDueDate(),
    is_active: true,
  });

  // Edit Round modal state
  const [editingRound, setEditingRound] = useState(null);
  const [editRoundForm, setEditRoundForm] = useState({
    name: '',
    round_number: 1,
    weight: 20,
    max_score: 100,
    due_date: getDefaultDueDate(),
    description: '',
    is_active: true,
  });
  const [updatingRound, setUpdatingRound] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchWorkspaceDetails(activeWorkspaceId);
    } else {
      setActiveWorkspace(null);
    }
  }, [activeWorkspaceId]);

  const fetchWorkspaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workspaceApi.getMyWorkspaces();
      setWorkspaces(res || []);
      if (res && res.length > 0 && !activeWorkspaceId) {
        setActiveWorkspaceId(res[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaceDetails = async (wsId) => {
    setError(null);
    try {
      const wsDetails = await workspaceApi.getWorkspace(wsId);
      setActiveWorkspace(wsDetails);
      await loadSubTabData(wsId, subTab, wsDetails);
    } catch (err) {
      setError(err.message || 'Failed to load workspace details.');
    }
  };

  const loadSubTabData = async (wsId, tab, wsDetails = activeWorkspace) => {
    const isOwner = wsDetails ? wsDetails.owner_id === user?.id : false;
    try {
      if (tab === 'overview' && isOwner) {
        const reqs = await workspaceApi.getStaffRequests(wsId);
        setStaffRequests(reqs || []);
      } else if (tab === 'notices') {
        const res = await workspaceApi.getNotices(wsId);
        setNotices(res || []);
      } else if (tab === 'rounds') {
        const res = await workspaceApi.getRounds(wsId);
        setRounds(res || []);
        // Dynamically compute next sequential round number
        const existingRounds = res || [];
        const nextRoundNum = existingRounds.length > 0
          ? Math.max(...existingRounds.map((r) => r.round_number || r.order_index || 0)) + 1
          : 1;
        setRoundForm((prev) => ({
          ...prev,
          round_number: nextRoundNum,
          due_date: prev.due_date || getDefaultDueDate(),
        }));
      } else if (tab === 'groups') {
        const res = await workspaceApi.getWorkspaceGroups(wsId);
        setGroups(res || []);
      } else if (tab === 'projects') {
        const res = await workspaceApi.getWorkspaceProjects(wsId);
        setProjects(res || []);
      }
    } catch (err) {
      console.error(`Error loading ${tab} tab:`, err);
      setError(err.message || `Failed to load ${tab} data.`);
    }
  };

  const handleSubTabChange = (newTab) => {
    setSubTab(newTab);
    if (activeWorkspaceId) {
      loadSubTabData(activeWorkspaceId, newTab);
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const wsId = createForm.code?.trim() || createForm.title.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase();
      const newWs = await workspaceApi.createWorkspace({
        id: wsId,
        name: createForm.title.trim(),
        title: createForm.title.trim(),
        term: createForm.term?.trim() || 'Fall 2026',
        description: createForm.description?.trim() || '',
        is_active: true,
      });
      setSuccess('Workspace created successfully!');
      setShowCreateModal(false);
      setCreateForm({ title: '', code: '', term: 'Fall 2026', description: '' });
      await fetchWorkspaces();
      setActiveWorkspaceId(newWs.id);
    } catch (err) {
      setError(err.message || 'Failed to create workspace.');
    }
  };

  const handleArchiveWorkspace = async () => {
    if (!activeWorkspace) return;
    if (!window.confirm(`Are you sure you want to archive "${activeWorkspace.title}"?`)) return;

    try {
      await workspaceApi.archiveWorkspace(activeWorkspace.id);
      setSuccess('Workspace archived successfully.');
      await fetchWorkspaces();
      if (activeWorkspaceId) fetchWorkspaceDetails(activeWorkspaceId);
    } catch (err) {
      setError(err.message || 'Failed to archive workspace.');
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    if (!requestWsId) return;
    try {
      await workspaceApi.requestAccess(requestWsId);
      setSuccess('Staff access request submitted to workspace owner.');
      setShowRequestAccessModal(false);
      setRequestWsId('');
    } catch (err) {
      setError(err.message || 'Failed to request workspace access.');
    }
  };

  // Co-Staff & Requests
  const handleAddCoStaff = async (e) => {
    e.preventDefault();
    if (!coStaffEmail || !activeWorkspace) return;
    try {
      await workspaceApi.addCoStaff(activeWorkspace.id, coStaffEmail);
      setSuccess(`Added ${coStaffEmail} as co-staff.`);
      setCoStaffEmail('');
      fetchWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      setError(err.message || 'Failed to add co-staff.');
    }
  };

  const handleRemoveCoStaff = async (staffId) => {
    if (!activeWorkspace) return;
    if (!window.confirm('Remove this co-staff member?')) return;
    try {
      await workspaceApi.removeCoStaff(activeWorkspace.id, staffId);
      setSuccess('Co-staff member removed.');
      fetchWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      setError(err.message || 'Failed to remove co-staff.');
    }
  };

  const handleApproveRequest = async (reqId) => {
    try {
      await workspaceApi.approveStaffRequest(activeWorkspace.id, reqId);
      setSuccess('Staff access request approved.');
      loadSubTabData(activeWorkspace.id, 'overview');
      fetchWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      setError(err.message || 'Failed to approve request.');
    }
  };

  const handleRejectRequest = async (reqId) => {
    try {
      await workspaceApi.rejectStaffRequest(activeWorkspace.id, reqId);
      setSuccess('Staff access request rejected.');
      loadSubTabData(activeWorkspace.id, 'overview');
    } catch (err) {
      setError(err.message || 'Failed to reject request.');
    }
  };

  // Notices helpers & handlers
  const handleImageSelect = (file) => {
    setUploadError(null);
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setUploadError('Invalid file type. Supported formats: JPG, PNG, WebP.');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setUploadError('Selected file exceeds 5MB size limit.');
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveSelectedImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setUploadError(null);
  };

  const formatTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - currentTime;
    if (diff <= 0) return 'Expired';
    const totalMinutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `Expires in ${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `Expires in ${minutes}m`;
    }
    return 'Expires in < 1m';
  };

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    try {
      const noticeTitle = noticeForm.title.trim();
      const noticeBody = (noticeForm.content || noticeForm.body || '').trim();
      if (!noticeTitle) {
        setError('Notice title is required.');
        return;
      }
      if (!noticeBody) {
        setError('Notice content is required.');
        return;
      }

      const formData = new FormData();
      formData.append('title', noticeTitle);
      formData.append('body', noticeBody);
      formData.append('content', noticeBody);
      formData.append('is_pinned', String(Boolean(noticeForm.is_pinned)));

      if (selectedImageFile) {
        formData.append('image', selectedImageFile);
      }

      await workspaceApi.createNotice(activeWorkspace.id, formData);
      setSuccess('Notice posted to workspace board (active for 24 hours).');
      setNoticeForm({ title: '', content: '', is_pinned: false });
      handleRemoveSelectedImage();
      loadSubTabData(activeWorkspace.id, 'notices');
    } catch (err) {
      setError(err.message || 'Failed to create notice.');
    }
  };

  const handleTogglePinNotice = async (notice) => {
    try {
      await workspaceApi.updateNotice(activeWorkspace.id, notice.id, {
        is_pinned: !notice.is_pinned,
      });
      loadSubTabData(activeWorkspace.id, 'notices');
    } catch (err) {
      setError(err.message || 'Failed to update notice.');
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('Delete this notice?')) return;
    try {
      await workspaceApi.deleteNotice(activeWorkspace.id, noticeId);
      setSuccess('Notice deleted.');
      loadSubTabData(activeWorkspace.id, 'notices');
    } catch (err) {
      setError(err.message || 'Failed to delete notice.');
    }
  };

  // Review Rounds Handlers
  const handleCreateRound = async (e) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setError(null);
    try {
      const orderIndex = parseInt(roundForm.round_number, 10) || 1;
      const roundWeight = parseFloat(roundForm.weight);
      const roundMaxScore = parseFloat(roundForm.max_score);
      if (isNaN(roundMaxScore) || roundMaxScore < 1.0) {
        setError('Maximum score must be at least 1.0.');
        return;
      }
      if (isNaN(roundWeight) || roundWeight < 0 || roundWeight > 100) {
        setError('Weight percentage must be between 0 and 100%.');
        return;
      }
      if (!roundForm.name.trim()) {
        setError('Round name is required.');
        return;
      }
      if (!roundForm.due_date) {
        setError('Due date deadline is required.');
        return;
      }

      const dueDateTime = new Date(roundForm.due_date);
      if (isNaN(dueDateTime.getTime())) {
        setError('Please enter a valid due date.');
        return;
      }

      const isActive = Boolean(roundForm.is_active);

      await workspaceApi.createRound(activeWorkspace.id, {
        title: roundForm.name.trim(),
        name: roundForm.name.trim(),
        description: roundForm.description?.trim() || '',
        order_index: orderIndex,
        round_number: orderIndex,
        weight: roundWeight,
        max_score: roundMaxScore,
        due_date: dueDateTime.toISOString(),
        is_open: isActive,
        is_active: isActive,
      });
      setSuccess(`Review round "${roundForm.name.trim()}" created successfully.`);
      setRoundForm({
        round_number: orderIndex + 1,
        name: '',
        description: '',
        weight: 20,
        max_score: 100,
        due_date: getDefaultDueDate(),
        is_active: true,
      });
      await loadSubTabData(activeWorkspace.id, 'rounds');
      await fetchWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      setError(err.message || 'Failed to create review round.');
    }
  };

  const handleOpenEditRoundModal = (round) => {
    setEditingRound(round);
    setEditRoundForm({
      name: round.name || round.title || '',
      round_number: round.round_number ?? round.order_index ?? 1,
      weight: round.weight ?? 20,
      max_score: round.max_score ?? 100,
      due_date: formatDateForInput(round.due_date),
      description: round.description || '',
      is_active: round.is_active !== undefined ? round.is_active : (round.is_open ?? true),
    });
  };

  const handleCloseEditRoundModal = () => {
    setEditingRound(null);
  };

  const handleUpdateRound = async (e) => {
    e.preventDefault();
    if (!activeWorkspace || !editingRound) return;
    setError(null);
    setUpdatingRound(true);
    try {
      const orderIndex = parseInt(editRoundForm.round_number, 10) || 1;
      const roundWeight = parseFloat(editRoundForm.weight);
      const roundMaxScore = parseFloat(editRoundForm.max_score);
      if (isNaN(roundMaxScore) || roundMaxScore < 1.0) {
        setError('Maximum score must be at least 1.0.');
        setUpdatingRound(false);
        return;
      }
      if (isNaN(roundWeight) || roundWeight < 0 || roundWeight > 100) {
        setError('Weight percentage must be between 0 and 100%.');
        setUpdatingRound(false);
        return;
      }
      if (!editRoundForm.name.trim()) {
        setError('Round name is required.');
        setUpdatingRound(false);
        return;
      }
      if (!editRoundForm.due_date) {
        setError('Due date deadline is required.');
        setUpdatingRound(false);
        return;
      }

      const dueDateTime = new Date(editRoundForm.due_date);
      if (isNaN(dueDateTime.getTime())) {
        setError('Please enter a valid due date.');
        setUpdatingRound(false);
        return;
      }

      const payload = {
        title: editRoundForm.name.trim(),
        name: editRoundForm.name.trim(),
        order_index: orderIndex,
        round_number: orderIndex,
        weight: roundWeight,
        max_score: roundMaxScore,
        due_date: dueDateTime.toISOString(),
        description: editRoundForm.description?.trim() || '',
        is_open: Boolean(editRoundForm.is_active),
        is_active: Boolean(editRoundForm.is_active),
      };

      await workspaceApi.updateRound(activeWorkspace.id, editingRound.id, payload);
      setSuccess(`Review round "${payload.title}" updated successfully.`);
      setEditingRound(null);
      await loadSubTabData(activeWorkspace.id, 'rounds');
      await fetchWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      setError(err.message || 'Failed to update review round.');
    } finally {
      setUpdatingRound(false);
    }
  };

  const handleToggleRoundActive = async (round) => {
    setError(null);
    try {
      const currentActive = round.is_active !== undefined ? round.is_active : (round.is_open ?? true);
      await workspaceApi.updateRound(activeWorkspace.id, round.id, {
        is_active: !currentActive,
        is_open: !currentActive,
      });
      setSuccess(`Review round #${round.order_index || round.round_number} is now ${!currentActive ? 'Active' : 'Closed'}.`);
      await loadSubTabData(activeWorkspace.id, 'rounds');
      await fetchWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      setError(err.message || 'Failed to update round.');
    }
  };

  const handleDeleteRound = async (roundId) => {
    if (!window.confirm('Delete this review round?')) return;
    setError(null);
    try {
      await workspaceApi.deleteRound(activeWorkspace.id, roundId);
      setSuccess('Review round deleted.');
      await loadSubTabData(activeWorkspace.id, 'rounds');
      await fetchWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      setError(err.message || 'Failed to delete round.');
    }
  };

  const isOwner = activeWorkspace ? activeWorkspace.owner_id === user?.id : false;

  return (
    <div className="space-y-6">
      {/* View Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1B262E] pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-sans">Managed Academic Workspaces</h2>
          <p className="text-xs text-slate-400 font-sans">
            Create, manage co-staff, configure notice boards, set review rounds, and oversee group projects.
          </p>
        </div>
        <div className="flex gap-2 font-sans">
          <button
            onClick={() => setShowRequestAccessModal(true)}
            className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-[#11181C] hover:bg-[#1B262E] rounded-lg border border-[#1B262E]"
          >
            Request Access
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-teal-500 hover:bg-teal-400 rounded-lg shadow-lg shadow-teal-900/20"
          >
            + Create Workspace
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 font-bold">×</button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 font-bold">×</button>
        </div>
      )}

      {/* Main Container: Left Workspace Selector, Right Workspace Details */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Workspace Selector List */}
        <div className="lg:col-span-1 bg-[#11181C] p-4 rounded-xl border border-[#1B262E] space-y-3">
          <div className="text-xs font-sans font-semibold text-slate-400 uppercase tracking-wider px-2">
            Workspaces ({workspaces.length})
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs font-sans text-slate-500">
              Loading workspaces...
            </div>
          ) : workspaces.length === 0 ? (
            <div className="py-6 text-center text-xs font-sans text-slate-500">
              No managed workspaces found.
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[500px]">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                const wsIsOwner = ws.owner_id === user?.id;
                return (
                  <button
                    key={ws.id}
                    onClick={() => setActiveWorkspaceId(ws.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-teal-500/10 border-teal-500/40 text-slate-100 shadow-sm'
                        : 'bg-[#0B0F12] border-[#1B262E] text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-sm truncate">{ws.title}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                          wsIsOwner
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                        }`}
                      >
                        {wsIsOwner ? 'Owner' : 'Co-Staff'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 line-clamp-1 font-sans">
                      {ws.description || 'No description'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-2">
                      ID: {ws.id} • {ws.is_active !== false ? 'Active' : 'Archived'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Workspace Operations Area */}
        <div className="lg:col-span-3 bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-6">
          {!activeWorkspace ? (
            <div className="py-20 text-center text-xs font-mono text-slate-500">
              Select or create a workspace to manage.
            </div>
          ) : (
            <>
              {/* Workspace Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1B262E] pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-slate-100">
                      {activeWorkspace.title}
                    </h3>
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded border uppercase ${
                        activeWorkspace.is_active !== false
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {activeWorkspace.is_active !== false ? 'Active' : 'Archived'}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      ID: #{activeWorkspace.id}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {activeWorkspace.description || 'No workspace description provided.'}
                  </p>
                </div>

                {isOwner && activeWorkspace.is_active !== false && (
                  <button
                    onClick={handleArchiveWorkspace}
                    className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded font-medium transition-all"
                  >
                    Archive Workspace
                  </button>
                )}
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="flex border-b border-[#1B262E] gap-2 overflow-x-auto text-sm font-medium">
                {[
                  { id: 'overview', label: 'Staff Roster & Access' },
                  { id: 'notices', label: 'Notice Board' },
                  { id: 'rounds', label: 'Review Rounds' },
                  { id: 'groups', label: 'Enrolled Groups' },
                  { id: 'projects', label: 'Projects Inspector' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSubTabChange(t.id)}
                    className={`pb-3 px-3 border-b-2 font-mono text-xs whitespace-nowrap transition-all ${
                      subTab === t.id
                        ? 'border-teal-400 text-teal-300 font-bold'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sub-Tab 1: Staff Roster & Access Requests */}
              {subTab === 'overview' && (
                <div className="space-y-6">
                  {/* Staff Roster */}
                  <div className="bg-[#0B0F12] p-5 rounded-lg border border-[#1B262E] space-y-4">
                    <h4 className="text-sm font-bold text-slate-200">
                      Assigned Staff Roster
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Owner */}
                      <div className="p-3 bg-[#11181C] rounded border border-purple-500/30 flex justify-between items-center">
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            Staff Owner (ID #{activeWorkspace.owner_id})
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {isOwner ? `${user.full_name} (${user.email})` : 'Workspace Owner'}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          OWNER
                        </span>
                      </div>

                      {/* Co-Staff */}
                      {activeWorkspace.staff_members?.map((sm) => (
                        <div
                          key={sm.id || sm.staff_id}
                          className="p-3 bg-[#11181C] rounded border border-[#1B262E] flex justify-between items-center"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-200">
                              {sm.full_name || sm.email || `Staff #${sm.staff_id || sm.id}`}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {sm.email || 'Co-Staff Member'}
                            </div>
                          </div>
                          {isOwner && (
                            <button
                              onClick={() => handleRemoveCoStaff(sm.staff_id || sm.id)}
                              className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 bg-rose-500/10 rounded"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add Co-Staff (Owner Only) */}
                    {isOwner && (
                      <form onSubmit={handleAddCoStaff} className="pt-3 border-t border-[#1B262E] flex gap-2">
                        <input
                          type="email"
                          placeholder="Co-staff email address..."
                          value={coStaffEmail}
                          onChange={(e) => setCoStaffEmail(e.target.value)}
                          className="flex-1 bg-[#11181C] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                          required
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-semibold text-xs rounded"
                        >
                          Add Co-Staff
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Staff Access Requests (Owner Only) */}
                  {isOwner && (
                    <div className="bg-[#0B0F12] p-5 rounded-lg border border-[#1B262E] space-y-4">
                      <h4 className="text-sm font-bold text-slate-200">
                        Pending Staff Access Requests ({staffRequests.length})
                      </h4>
                      {staffRequests.length === 0 ? (
                        <div className="text-xs text-slate-500 font-mono">
                          No pending staff access requests for this workspace.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {staffRequests.map((req) => (
                            <div
                              key={req.id}
                              className="p-3 bg-[#11181C] rounded border border-[#1B262E] flex items-center justify-between"
                            >
                              <div>
                                <div className="text-xs font-semibold text-slate-200">
                                  {req.staff_email || `Staff #${req.staff_id}`}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  Requested on: {new Date(req.created_at || Date.now()).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveRequest(req.id)}
                                  className="px-2.5 py-1 text-xs bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded hover:bg-emerald-600/40 font-semibold"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="px-2.5 py-1 text-xs bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded hover:bg-rose-600/40"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 2: Notice Board */}
              {subTab === 'notices' && (() => {
                const activeNotices = notices.filter((n) => {
                  if (!n.expires_at) return true;
                  return new Date(n.expires_at).getTime() > currentTime;
                });

                return (
                  <div className="space-y-6">
                    {/* Create Notice Form */}
                    <form onSubmit={handleCreateNotice} className="bg-[#0B0F12] p-5 rounded-lg border border-[#1B262E] space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-200">Post New Workspace Notice</h4>
                        <span className="text-[10px] font-mono text-teal-400 bg-teal-950/40 border border-teal-500/20 px-2 py-0.5 rounded">
                          24-Hour Active Lifecycle
                        </span>
                      </div>

                      <input
                        type="text"
                        placeholder="Notice Title"
                        value={noticeForm.title}
                        onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                        className="w-full bg-[#11181C] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                        required
                      />

                      <textarea
                        placeholder="Notice content..."
                        rows={3}
                        value={noticeForm.content}
                        onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                        className="w-full bg-[#11181C] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                        required
                      />

                      {/* Image Upload / Preview Area */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                          Notice Image Attachment (Optional)
                        </label>

                        {!imagePreviewUrl ? (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file) handleImageSelect(file);
                            }}
                            className={`border-2 border-dashed rounded-lg p-5 text-center transition-all ${
                              isDragging
                                ? 'border-teal-400 bg-teal-950/30'
                                : 'border-[#1B262E] hover:border-teal-500/40 bg-[#11181C]/60'
                            }`}
                          >
                            <input
                              type="file"
                              id="notice-image-upload"
                              accept="image/jpeg,image/png,image/webp,image/jpg"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageSelect(file);
                              }}
                              className="hidden"
                            />
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-9 h-9 rounded-full bg-[#162026] border border-[#1B262E] flex items-center justify-center text-teal-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <p className="text-xs text-slate-300 font-medium">
                                Drag and drop an image here, or{' '}
                                <label
                                  htmlFor="notice-image-upload"
                                  className="text-teal-400 hover:text-teal-300 cursor-pointer underline font-semibold"
                                >
                                  browse files
                                </label>
                              </p>
                              <p className="text-[10px] font-mono text-slate-500">
                                Supports JPG, JPEG, PNG, WebP (Max 5MB) • Auto-compressed for performance
                              </p>
                              <label
                                htmlFor="notice-image-upload"
                                className="mt-1 px-3 py-1 bg-[#162026] hover:bg-[#1f2c35] text-teal-300 border border-teal-500/30 hover:border-teal-400/50 text-xs rounded font-mono cursor-pointer transition-colors"
                              >
                                Upload Image
                              </label>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-[#11181C] border border-[#1B262E] rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-300">
                              <span className="font-mono truncate max-w-xs text-teal-400">
                                📷 {selectedImageFile?.name || 'Selected Image'} ({selectedImageFile?.size ? (selectedImageFile.size / 1024).toFixed(1) : 0} KB)
                              </span>
                              <div className="flex gap-3">
                                <label
                                  htmlFor="notice-image-replace"
                                  className="text-[11px] font-mono text-slate-400 hover:text-teal-300 cursor-pointer"
                                >
                                  Replace
                                </label>
                                <input
                                  type="file"
                                  id="notice-image-replace"
                                  accept="image/jpeg,image/png,image/webp,image/jpg"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageSelect(file);
                                  }}
                                  className="hidden"
                                />
                                <button
                                  type="button"
                                  onClick={handleRemoveSelectedImage}
                                  className="text-[11px] font-mono text-rose-400 hover:text-rose-300"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                            <div className="relative rounded overflow-hidden max-h-52 border border-[#1B262E] bg-black/40 flex items-center justify-center">
                              <img
                                src={imagePreviewUrl}
                                alt="Notice Preview"
                                className="max-h-52 w-auto object-contain rounded"
                              />
                            </div>
                          </div>
                        )}

                        {uploadError && (
                          <p className="text-xs text-rose-400 font-mono mt-1">{uploadError}</p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2 border-t border-[#1B262E]">
                        <label className="flex items-center gap-2 text-xs text-slate-300 font-mono cursor-pointer">
                          <input
                            type="checkbox"
                            checked={noticeForm.is_pinned}
                            onChange={(e) => setNoticeForm({ ...noticeForm, is_pinned: e.target.checked })}
                            className="rounded border-[#1B262E] text-teal-500 focus:ring-0 bg-[#11181C]"
                          />
                          Pin Notice to Top
                        </label>
                        <button
                          type="submit"
                          className="w-full sm:w-auto px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-semibold text-xs rounded transition-colors"
                        >
                          Publish Notice
                        </button>
                      </div>
                    </form>

                    {/* Notice Feed */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-slate-200">
                          Workspace Notices ({activeNotices.length})
                        </h4>
                        <span className="text-[10px] font-mono text-slate-500">
                          Auto-expires 24h after publication
                        </span>
                      </div>

                      {activeNotices.length === 0 ? (
                        <div className="py-8 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                          No active notices published for this workspace. Notices automatically expire after 24 hours.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {activeNotices.map((n) => {
                            const timeRemaining = formatTimeRemaining(n.expires_at);
                            const imageSource = getMediaUrl(n.thumbnail_url || n.image_url);

                            return (
                              <div
                                key={n.id}
                                className={`p-4 rounded-lg border transition-all ${
                                  n.is_pinned
                                    ? 'bg-teal-950/20 border-teal-500/40 shadow-sm'
                                    : 'bg-[#0B0F12] border-[#1B262E]'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {n.is_pinned && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono">
                                        📌 Pinned
                                      </span>
                                    )}
                                    <h5 className="font-semibold text-sm text-slate-100">{n.title}</h5>
                                    {timeRemaining && (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30">
                                        ⏱️ {timeRemaining}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <button
                                      onClick={() => handleTogglePinNotice(n)}
                                      className="text-xs font-mono text-slate-400 hover:text-teal-300"
                                    >
                                      {n.is_pinned ? 'Unpin' : 'Pin'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteNotice(n.id)}
                                      className="text-xs font-mono text-rose-400 hover:text-rose-300"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>

                                <p className="text-xs text-slate-300 mt-2 whitespace-pre-wrap">{n.content || n.body}</p>

                                {imageSource && (
                                  <div className="mt-3 rounded border border-[#1B262E] overflow-hidden max-h-60 bg-black/40 flex items-center justify-start">
                                    <img
                                      src={imageSource}
                                      alt={n.title || "Notice Attachment"}
                                      loading="lazy"
                                      className="max-h-60 w-auto object-contain rounded"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}

                                <div className="text-[10px] text-slate-500 font-mono mt-3 pt-2 border-t border-[#1B262E] flex justify-between items-center">
                                  <span>Posted on {new Date(n.created_at || Date.now()).toLocaleString()}</span>
                                  {n.expires_at && (
                                    <span className="text-slate-400 font-mono">
                                      Expires {new Date(n.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Sub-Tab 3: Review Rounds */}
              {subTab === 'rounds' && (
                <div className="space-y-6">
                  {/* Create Round Form */}
                  <form onSubmit={handleCreateRound} className="bg-[#0B0F12] p-5 rounded-lg border border-[#1B262E] space-y-3">
                    <h4 className="text-sm font-bold text-slate-200">Configure Review Round</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 uppercase">Round #</label>
                        <input
                          type="number"
                          min="1"
                          value={roundForm.round_number}
                          onChange={(e) => setRoundForm({ ...roundForm, round_number: e.target.value })}
                          className="w-full bg-[#11181C] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 uppercase">Round Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Sprint 1 Review"
                          value={roundForm.name}
                          onChange={(e) => setRoundForm({ ...roundForm, name: e.target.value })}
                          className="w-full bg-[#11181C] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 uppercase">Weight %</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={roundForm.weight}
                          onChange={(e) => setRoundForm({ ...roundForm, weight: e.target.value })}
                          className="w-full bg-[#11181C] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 uppercase">Max Score</label>
                        <input
                          type="number"
                          min="1"
                          value={roundForm.max_score}
                          onChange={(e) => setRoundForm({ ...roundForm, max_score: e.target.value })}
                          className="w-full bg-[#11181C] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 uppercase">Due Date</label>
                        <input
                          type="datetime-local"
                          value={roundForm.due_date}
                          onChange={(e) => setRoundForm({ ...roundForm, due_date: e.target.value })}
                          className="w-full bg-[#11181C] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200"
                          required
                        />
                      </div>
                    </div>

                    <textarea
                      placeholder="Round instructions or rubric..."
                      rows={2}
                      value={roundForm.description}
                      onChange={(e) => setRoundForm({ ...roundForm, description: e.target.value })}
                      className="w-full bg-[#11181C] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200"
                    />

                    <div className="flex justify-between items-center pt-2">
                      <label className="flex items-center gap-2 text-xs text-slate-300 font-mono cursor-pointer">
                        <input
                          type="checkbox"
                          checked={roundForm.is_active}
                          onChange={(e) => setRoundForm({ ...roundForm, is_active: e.target.checked })}
                          className="rounded border-[#1B262E] text-teal-500 focus:ring-0 bg-[#11181C]"
                        />
                        Active Round (Accepting Submissions)
                      </label>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-semibold text-xs rounded"
                      >
                        Add Review Round
                      </button>
                    </div>
                  </form>

                  {/* Rounds List */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-200">Review Rounds ({rounds.length})</h4>
                    {rounds.length === 0 ? (
                      <div className="py-8 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                        No review rounds configured for this workspace.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-[#0B0F12] text-slate-400 font-mono text-[10px] uppercase border-b border-[#1B262E]">
                            <tr>
                              <th className="py-2.5 px-3">#</th>
                              <th className="py-2.5 px-3">Round Name</th>
                              <th className="py-2.5 px-3">Weight</th>
                              <th className="py-2.5 px-3">Max Score</th>
                              <th className="py-2.5 px-3">Due Date</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1B262E]">
                            {rounds.map((r) => {
                              const roundNum = r.round_number ?? r.order_index ?? 1;
                              const roundName = r.name || r.title || `Round ${roundNum}`;
                              const roundWeight = r.weight ?? 20;
                              const roundMaxScore = r.max_score ?? 100;
                              const roundActive = r.is_active !== undefined ? r.is_active : (r.is_open ?? true);
                              const dueText = r.due_date ? new Date(r.due_date).toLocaleString() : 'No deadline';
                              return (
                                <tr key={r.id} className="hover:bg-[#162026]">
                                  <td className="py-2.5 px-3 font-mono text-teal-400 font-bold">
                                    #{roundNum}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-200">{roundName}</div>
                                    {r.description && <div className="text-[10px] text-slate-400">{r.description}</div>}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono">{roundWeight}%</td>
                                  <td className="py-2.5 px-3 font-mono">{roundMaxScore} pts</td>
                                  <td className="py-2.5 px-3 font-mono text-slate-400">
                                    {dueText}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                        roundActive
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                                      }`}
                                    >
                                      {roundActive ? 'Active' : 'Closed'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right space-x-2">
                                    <button
                                      onClick={() => handleOpenEditRoundModal(r)}
                                      className="text-xs font-mono text-teal-400 hover:text-teal-300 font-semibold"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleToggleRoundActive(r)}
                                      className="text-xs font-mono text-slate-400 hover:text-teal-300"
                                    >
                                      {roundActive ? 'Close' : 'Activate'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRound(r.id)}
                                      className="text-xs font-mono text-rose-400 hover:text-rose-300"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Tab 4: Enrolled Groups */}
              {subTab === 'groups' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-200">
                    Enrolled Student Groups ({groups.length})
                  </h4>
                  {groups.length === 0 ? (
                    <div className="py-12 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                      No student groups enrolled in this workspace yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groups.map((g) => (
                        <div
                          key={g.id}
                          className="bg-[#0B0F12] p-4 rounded-lg border border-[#1B262E] space-y-3"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-sm font-semibold text-slate-100">
                                {g.name || `Group #${g.id}`}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {g.members?.length || 0} Members
                            </span>
                          </div>

                          <div className="text-xs text-slate-400 space-y-1">
                            <div className="font-mono text-[10px] text-slate-500 uppercase">
                              Roster Snapshot:
                            </div>
                            <ul className="space-y-1">
                              {g.members?.map((m) => (
                                <li key={m.id} className="flex items-center justify-between bg-[#11181C] px-2 py-1 rounded">
                                  <span>{m.full_name || m.email}</span>
                                  <span className="text-[10px] font-mono text-slate-500">{m.email}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {g.project && (
                            <div className="pt-2 border-t border-[#1B262E] flex justify-between items-center text-xs">
                              <span className="text-slate-400">Project: <strong className="text-slate-200">{g.project.title || g.project.name}</strong></span>
                              <button
                                onClick={() => onSelectProject(g.project.id)}
                                className="text-teal-400 hover:underline font-mono text-[11px]"
                              >
                                Inspect Project →
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 5: Projects Inspector */}
              {subTab === 'projects' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-200">
                    Workspace Projects Oversight ({projects.length})
                  </h4>
                  {projects.length === 0 ? (
                    <div className="py-12 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                      No group projects created in this workspace yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {projects.map((p) => (
                        <div
                          key={p.id}
                          className="bg-[#0B0F12] p-4 rounded-lg border border-[#1B262E] hover:border-teal-500/30 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-sm text-slate-100">{p.title || p.name}</h5>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                                Group: {p.group_name || `Group #${p.group_id}`}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2">
                              {p.description || 'No project description.'}
                            </p>
                            {p.repo_url && (
                              <a
                                href={p.repo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-mono text-teal-400 hover:underline inline-block mt-1"
                              >
                                🔗 {p.repo_url}
                              </a>
                            )}
                          </div>

                          <button
                            onClick={() => onSelectProject(p.id)}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-semibold text-xs rounded shrink-0 shadow"
                          >
                            Open Project Oversight →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal: Create Workspace */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Create New Academic Workspace</h3>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Workspace Title / Name</label>
                <input
                  type="text"
                  placeholder="e.g. Data Structures & Algorithms Lab"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Workspace Code (ID)</label>
                  <input
                    type="text"
                    placeholder="e.g. CS204-DSA"
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                    className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Term / Semester</label>
                  <input
                    type="text"
                    placeholder="e.g. Fall 2026"
                    value={createForm.term}
                    onChange={(e) => setCreateForm({ ...createForm, term: e.target.value })}
                    className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Workspace description and enrollment guidelines..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded shadow"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request Staff Access */}
      {showRequestAccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Request Staff Access</h3>
            <p className="text-xs text-slate-400">
              Enter the unique ID of an existing workspace to request co-staff permissions from the owner.
            </p>
            <form onSubmit={handleRequestAccess} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Workspace ID</label>
                <input
                  type="text"
                  placeholder="e.g. DSA-2026"
                  value={requestWsId}
                  onChange={(e) => setRequestWsId(e.target.value)}
                  className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestAccessModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded shadow"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Review Round */}
      {editingRound && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#1B262E] pb-3">
              <h3 className="text-base font-bold text-slate-100 font-sans">
                Edit Review Round #{editingRound.order_index || editingRound.round_number}
              </h3>
              <button
                onClick={handleCloseEditRoundModal}
                className="text-slate-400 hover:text-slate-200 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRound} className="space-y-4 font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Round #</label>
                  <input
                    type="number"
                    min="1"
                    value={editRoundForm.round_number}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, round_number: e.target.value })}
                    className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Round Name</label>
                  <input
                    type="text"
                    value={editRoundForm.name}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, name: e.target.value })}
                    className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Weight %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editRoundForm.weight}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, weight: e.target.value })}
                    className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Max Score</label>
                  <input
                    type="number"
                    min="1"
                    value={editRoundForm.max_score}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, max_score: e.target.value })}
                    className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Due Date</label>
                  <input
                    type="datetime-local"
                    value={editRoundForm.due_date}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, due_date: e.target.value })}
                    className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Instructions / Rubric</label>
                <textarea
                  rows={3}
                  value={editRoundForm.description}
                  onChange={(e) => setEditRoundForm({ ...editRoundForm, description: e.target.value })}
                  placeholder="Round instructions, deliverables, or rubric..."
                  className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 font-mono cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editRoundForm.is_active}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, is_active: e.target.checked })}
                    className="rounded border-[#1B262E] text-teal-500 focus:ring-0 bg-[#0B0F12]"
                  />
                  <span>Active Round (Accepting Submissions)</span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCloseEditRoundModal}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 font-mono"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingRound}
                    className="px-4 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded transition-colors disabled:opacity-50"
                  >
                    {updatingRound ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
