import React, { useState, useEffect, useCallback } from 'react';
import { auditApi } from '../../api/auditApi';

export const StaffAuditTrailView = () => {
  // --- STATS OVERVIEW STATE ---
  const [stats, setStats] = useState({
    total_events: 0,
    workspace_changes: 0,
    access_changes: 0,
    security_events: 0,
    failure_count: 0,
  });
  const [statsTimeRange, setStatsTimeRange] = useState('all');
  const [statsLoading, setStatsLoading] = useState(false);

  // --- FILTER CHOICES FROM BACKEND ---
  const [filtersOptions, setFiltersOptions] = useState({
    workspaces: [],
    categories: ['ALL', 'WORKSPACE', 'ACCESS', 'SECURITY', 'ASSESSMENT', 'NOTICE', 'PROJECT'],
    action_types: [],
    actors: [],
  });

  // --- ACTIVE FILTERS STATE ---
  const [selectedWsId, setSelectedWsId] = useState('');
  const [selectedActorId, setSelectedActorId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedActionType, setSelectedActionType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // --- PAGINATION STATE ---
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // --- LOGS & UI STATE ---
  const [logs, setLogs] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Search input debounce (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch overview cards whenever stats time range or workspace filter changes
  useEffect(() => {
    fetchStats();
  }, [statsTimeRange, selectedWsId]);

  // Fetch paginated activity feed whenever any filter or pagination changes
  useEffect(() => {
    fetchActivity();
  }, [
    selectedWsId,
    selectedActorId,
    selectedCategory,
    selectedActionType,
    selectedStatus,
    selectedTimeRange,
    customStartDate,
    customEndDate,
    debouncedSearch,
    limit,
    page,
  ]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedEvent(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const data = await auditApi.getFilters();
      if (data) {
        setFiltersOptions({
          workspaces: data.workspaces || [],
          categories: data.categories || ['ALL', 'WORKSPACE', 'ACCESS', 'SECURITY', 'ASSESSMENT', 'NOTICE', 'PROJECT'],
          action_types: data.action_types || [],
          actors: data.actors || [],
        });
      }
    } catch (err) {
      console.error('Failed to load audit filter options:', err);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const params = {
        time_range: statsTimeRange,
      };
      if (selectedWsId) params.workspace_id = selectedWsId;
      const res = await auditApi.getStats(params);
      if (res) {
        setStats(res);
      }
    } catch (err) {
      console.error('Failed to load audit stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchActivity = async () => {
    setTableLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * limit;
      const params = {
        limit,
        offset,
        time_range: selectedTimeRange,
      };
      if (selectedWsId) params.workspace_id = selectedWsId;
      if (selectedActorId) params.actor_id = selectedActorId;
      if (selectedCategory && selectedCategory !== 'ALL') params.category = selectedCategory;
      if (selectedActionType) params.action_type = selectedActionType;
      if (selectedStatus && selectedStatus !== 'ALL') params.status = selectedStatus;
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedTimeRange === 'custom') {
        if (customStartDate) params.start_date = new Date(customStartDate).toISOString();
        if (customEndDate) params.end_date = new Date(customEndDate).toISOString();
      }

      const res = await auditApi.getActivity(params);
      if (res) {
        setLogs(res.items || []);
        setTotal(res.total || 0);
        setTotalPages(res.total_pages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to load activity logs from server.');
      setLogs([]);
    } finally {
      setTableLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedWsId('');
    setSelectedActorId('');
    setSelectedCategory('ALL');
    setSelectedActionType('');
    setSelectedStatus('ALL');
    setSelectedTimeRange('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchTerm('');
    setDebouncedSearch('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    selectedWsId ||
    selectedActorId ||
    (selectedCategory && selectedCategory !== 'ALL') ||
    selectedActionType ||
    (selectedStatus && selectedStatus !== 'ALL') ||
    (selectedTimeRange && selectedTimeRange !== 'all') ||
    searchTerm
  );

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const getCategoryBadgeClass = (category) => {
    switch (category?.toUpperCase()) {
      case 'WORKSPACE':
        return 'bg-teal-950/50 text-teal-300 border-teal-500/30';
      case 'ACCESS':
        return 'bg-sky-950/50 text-sky-300 border-sky-500/30';
      case 'SECURITY':
        return 'bg-amber-950/50 text-amber-300 border-amber-500/30';
      case 'ASSESSMENT':
        return 'bg-purple-950/50 text-purple-300 border-purple-500/30';
      case 'NOTICE':
        return 'bg-indigo-950/50 text-indigo-300 border-indigo-500/30';
      case 'PROJECT':
        return 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const handleCopyJson = (obj) => {
    if (!obj) return;
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1B262E] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100 font-sans tracking-tight">
              Administrative Activity Center
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
              Append-Only Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Real-time audit telemetry tracking workspace modifications, credential authentications, score updates, and administrative security events.
          </p>
        </div>

        {/* Global Stats Time Range Selector */}
        <div className="flex items-center gap-1 bg-[#11181C] p-1 rounded-lg border border-[#1B262E]">
          <span className="text-[11px] font-mono uppercase text-slate-400 px-2">Window:</span>
          {[
            { id: '24h', label: '24 Hours' },
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: 'all', label: 'All Time' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => {
                setStatsTimeRange(pill.id);
                setSelectedTimeRange(pill.id);
                setPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-sans rounded transition-colors ${
                statsTimeRange === pill.id
                  ? 'bg-teal-500/20 text-teal-300 font-medium border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#162026]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. OVERVIEW METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Events */}
        <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-slate-400 font-medium">Total Events</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100">
              {statsLoading ? '...' : Number(stats.total_events || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Audit log records recorded in database</p>
          </div>
        </div>

        {/* Card 2: Workspace Changes */}
        <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-slate-400 font-medium">Workspace Changes</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-teal-300">
              {statsLoading ? '...' : Number(stats.workspace_changes || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Workspace creation, rounds & groups</p>
          </div>
        </div>

        {/* Card 3: Access Changes */}
        <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-slate-400 font-medium">Access Changes</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-sky-300">
              {statsLoading ? '...' : Number(stats.access_changes || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Role delegations & staff approvals</p>
          </div>
        </div>

        {/* Card 4: Security Events */}
        <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-sans text-slate-400 font-medium">Security Events</span>
              {stats.failure_count > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {stats.failure_count} alerts
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-300">
              {statsLoading ? '...' : Number(stats.security_events || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Authentications & access checks</p>
          </div>
        </div>
      </div>

      {/* 3. MULTI-FACETED FILTER TOOLBAR */}
      <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-4 space-y-3">
        {/* Top Filter Row: Search & Reset */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by actor, action name, workspace ID, or resource..."
              className="w-full pl-9 pr-8 py-2 bg-[#0B0F12] border border-[#1B262E] rounded-lg text-xs text-slate-200 placeholder-slate-500 font-sans focus:outline-none focus:border-teal-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-3 py-2 text-xs font-sans rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Filters
            </button>
          )}
        </div>

        {/* Second Filter Row: Faceted Selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {/* Workspace Filter */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Workspace</label>
            <select
              value={selectedWsId}
              onChange={(e) => {
                setSelectedWsId(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
            >
              <option value="">All Scopes & Global</option>
              {filtersOptions.workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
            >
              {filtersOptions.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Action Type Filter */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Action Type</label>
            <select
              value={selectedActionType}
              onChange={(e) => {
                setSelectedActionType(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
            >
              <option value="">All Actions</option>
              {filtersOptions.action_types.map((act) => (
                <option key={act.id} value={act.id}>
                  {act.label}
                </option>
              ))}
            </select>
          </div>

          {/* Outcome Filter */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Outcome</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">Success Only</option>
              <option value="FAILURE">Failures / Errors Only</option>
            </select>
          </div>

          {/* Actor Filter */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Actor</label>
            <select
              value={selectedActorId}
              onChange={(e) => {
                setSelectedActorId(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
            >
              <option value="">All Actors</option>
              {filtersOptions.actors.map((act) => (
                <option key={act.id} value={act.id}>
                  {act.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Filter */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Date Scope</label>
            <select
              value={selectedTimeRange}
              onChange={(e) => {
                setSelectedTimeRange(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Time</option>
              <option value="24h">Past 24 Hours</option>
              <option value="7d">Past 7 Days</option>
              <option value="30d">Past 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers if 'custom' is active */}
        {selectedTimeRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1B262E]">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setPage(1);
                }}
                className="bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-sans flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchActivity} className="underline font-mono text-[11px] hover:text-rose-200">
            Retry
          </button>
        </div>
      )}

      {/* 4. ACTIVITY TABLE SECTION */}
      <div className="bg-[#11181C] rounded-xl border border-[#1B262E] overflow-hidden shadow-card-subtle">
        {/* Table Header Bar with Results Count & Limit Selector */}
        <div className="px-4 py-3 border-b border-[#1B262E] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-[#0E1418]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-sans text-slate-300 font-medium">Activity Stream</span>
            <span className="text-xs font-mono text-slate-500">
              ({total.toLocaleString()} {total === 1 ? 'event' : 'events'})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-sans text-slate-400">Rows per page:</span>
            <div className="flex items-center gap-1 bg-[#0B0F12] rounded p-0.5 border border-[#1B262E]">
              {[25, 50].map((pageSize) => (
                <button
                  key={pageSize}
                  onClick={() => {
                    setLimit(pageSize);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 text-xs font-mono rounded ${
                    limit === pageSize
                      ? 'bg-teal-500/20 text-teal-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pageSize}
                </button>
              ))}
            </div>
          </div>
        </div>

        {tableLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-sans text-slate-400">Querying immutable activity records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center space-y-2 border border-dashed border-[#1B262E] m-4 rounded-xl">
            <p className="text-xs font-sans text-slate-400">
              No activity events found matching the specified filters.
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs font-sans text-teal-400 hover:underline"
              >
                Clear all filters and show latest activity
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0B0F12] text-slate-400 text-[11px] uppercase tracking-wider border-b border-[#1B262E] font-mono">
                <tr>
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B262E]">
                {logs.map((log) => {
                  const isFailure = log.outcome?.toUpperCase() === 'FAILURE' || log.status?.toUpperCase() === 'FAILURE';
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedEvent(log)}
                      className="hover:bg-[#162026] cursor-pointer transition-colors group"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                        {formatTimestamp(log.timestamp || log.created_at)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-200 group-hover:text-teal-300 transition-colors">
                          {log.action || log.action_type || 'Event Recorded'}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200 whitespace-nowrap">
                            {log.actor_name || 'System / Automated'}
                          </span>
                          {log.actor_email && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {log.actor_email}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${getCategoryBadgeClass(
                            log.category
                          )}`}
                        >
                          {log.category || 'SYSTEM'}
                        </span>
                      </td>

                      {/* Resource */}
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                        {log.resource_name || (log.resource_type ? `${log.resource_type} #${log.resource_id || ''}` : log.workspace_id ? `Workspace #${log.workspace_id}` : 'Global')}
                      </td>

                      {/* Outcome */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isFailure ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Failure
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Success
                          </span>
                        )}
                      </td>

                      {/* Details preview */}
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                        {log.description || log.details || '—'}
                      </td>

                      {/* Inspect Arrow */}
                      <td className="py-3 px-3 text-right text-slate-500 group-hover:text-teal-400 transition-colors">
                        <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. SERVER-SIDE PAGINATION CONTROLS */}
        <div className="px-4 py-3 border-t border-[#1B262E] bg-[#0E1418] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans text-slate-400">
          <div>
            Showing <span className="font-mono text-slate-200">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to{' '}
            <span className="font-mono text-slate-200">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-mono text-slate-200">{total}</span> events
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-[#11181C] border border-[#1B262E] hover:bg-[#162026] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[11px]"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded bg-[#11181C] border border-[#1B262E] hover:bg-[#162026] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >
              Previous
            </button>
            <span className="px-2 text-xs font-mono text-slate-400">
              Page <span className="text-teal-300 font-semibold">{page}</span> of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded bg-[#11181C] border border-[#1B262E] hover:bg-[#162026] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded bg-[#11181C] border border-[#1B262E] hover:bg-[#162026] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[11px]"
            >
              Last
            </button>
          </div>
        </div>
      </div>

      {/* 6. SLIDE-OVER DETAIL DRAWER FOR EVENT INSPECTION */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedEvent(null)}
          />

          {/* Slide-over Container */}
          <div className="relative w-full max-w-2xl bg-[#0B0F12] border-l border-[#1B262E] shadow-2xl flex flex-col h-full overflow-hidden z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-[#1B262E] flex items-center justify-between bg-[#11181C]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">Event #{selectedEvent.id}</span>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${getCategoryBadgeClass(
                      selectedEvent.category
                    )}`}
                  >
                    {selectedEvent.category || 'SYSTEM'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100 font-sans mt-0.5">
                  {selectedEvent.action || selectedEvent.action_type}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {selectedEvent.outcome?.toUpperCase() === 'FAILURE' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    Failure
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Success
                  </span>
                )}

                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 rounded-lg hover:bg-[#1B262E] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs font-sans">
              {/* Failure Error Reason banner */}
              {selectedEvent.error_reason && (
                <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-rose-400 font-bold flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Error Reason
                  </div>
                  <div className="text-xs text-rose-200 font-mono">
                    {selectedEvent.error_reason}
                  </div>
                </div>
              )}

              {/* Event Summary Grid */}
              <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400">Actor</span>
                  <div className="font-medium text-slate-200 mt-0.5">
                    {selectedEvent.actor_name || 'System / Automated'}
                  </div>
                  {selectedEvent.actor_email && (
                    <div className="text-[11px] text-slate-400 font-mono">{selectedEvent.actor_email}</div>
                  )}
                  {selectedEvent.actor_role && (
                    <div className="text-[10px] font-mono text-teal-400 uppercase mt-0.5">
                      Role: {selectedEvent.actor_role}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400">Timestamp</span>
                  <div className="font-mono text-slate-200 mt-0.5">
                    {formatTimestamp(selectedEvent.timestamp || selectedEvent.created_at)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {new Date(selectedEvent.timestamp || selectedEvent.created_at).toISOString()}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400">Workspace</span>
                  <div className="font-medium text-slate-200 mt-0.5">
                    {selectedEvent.workspace_name || (selectedEvent.workspace_id ? `Workspace #${selectedEvent.workspace_id}` : 'Global Scope')}
                  </div>
                  {selectedEvent.workspace_id && (
                    <div className="text-[11px] text-slate-500 font-mono">ID: {selectedEvent.workspace_id}</div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400">Target Resource</span>
                  <div className="font-medium text-slate-200 mt-0.5">
                    {selectedEvent.resource_name || selectedEvent.resource_type || '—'}
                  </div>
                  {(selectedEvent.resource_id || selectedEvent.resource_type) && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      Type: {selectedEvent.resource_type || 'N/A'} {selectedEvent.resource_id ? `(#${selectedEvent.resource_id})` : ''}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400">Action Type</span>
                  <div className="font-mono text-teal-300 mt-0.5">
                    {selectedEvent.action_type || selectedEvent.action}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400">Request ID / Client</span>
                  <div className="font-mono text-slate-300 mt-0.5">
                    {selectedEvent.request_id || 'req_auto'}
                  </div>
                  {selectedEvent.ip_address && (
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      IP: {selectedEvent.ip_address}
                    </div>
                  )}
                </div>
              </div>

              {/* Description / Summary */}
              {selectedEvent.description && (
                <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-4 space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-slate-400">Audit Description</span>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedEvent.description}
                  </p>
                </div>
              )}

              {/* State Changes: Before and After / Metadata */}
              {(selectedEvent.old_value || selectedEvent.new_value) && (
                <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1B262E] pb-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                      Audit State & Metadata Payload
                    </span>
                    <button
                      onClick={() => handleCopyJson({ old_value: selectedEvent.old_value, new_value: selectedEvent.new_value })}
                      className="text-[11px] font-mono text-teal-400 hover:text-teal-300 flex items-center gap-1"
                    >
                      {copiedJson ? '✓ Copied' : 'Copy JSON'}
                    </button>
                  </div>

                  {/* If both old_value and new_value exist: Before/After comparison */}
                  {selectedEvent.old_value && selectedEvent.new_value ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-amber-400 block mb-1">
                          Previous State (Before)
                        </span>
                        <pre className="bg-[#080C0E] p-3 rounded-lg border border-[#1B262E] font-mono text-[11px] text-amber-200/80 overflow-x-auto max-h-56">
                          {JSON.stringify(selectedEvent.old_value, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono uppercase text-teal-400 block mb-1">
                          Updated State (After)
                        </span>
                        <pre className="bg-[#080C0E] p-3 rounded-lg border border-[#1B262E] font-mono text-[11px] text-teal-200/80 overflow-x-auto max-h-56">
                          {JSON.stringify(selectedEvent.new_value, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] font-mono uppercase text-teal-400 block mb-1">
                        Payload Metadata
                      </span>
                      <pre className="bg-[#080C0E] p-3 rounded-lg border border-[#1B262E] font-mono text-[11px] text-teal-200/80 overflow-x-auto max-h-64">
                        {JSON.stringify(selectedEvent.new_value || selectedEvent.old_value, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-3 border-t border-[#1B262E] bg-[#11181C] flex justify-between items-center">
              <span className="text-[11px] font-mono text-slate-500">
                Tamper-resistant cryptographic log
              </span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 rounded-lg bg-[#162026] hover:bg-[#1B262E] border border-[#1B262E] text-slate-300 text-xs font-sans transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
