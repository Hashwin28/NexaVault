import React, { useState } from 'react';
import { searchApi } from '../../api/searchApi';

export const StaffSmartSearchView = ({ onSelectProject }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await searchApi.smartSearch(query.trim());
      setResults(data || {});
    } catch (err) {
      setError(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-gradient-to-r from-[#11181C] to-[#0B0F12] p-6 rounded-xl border border-[#1B262E] space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-sans flex items-center gap-2">
            Smart Search Engine
            <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-sans">
              Staff Scoped
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Search managed workspaces, group names, project titles, submissions, and enrolled student rosters.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Search keywords, project names, student emails, group names..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-[#0B0F12] border border-[#1B262E] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-teal-500 font-sans"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-teal-900/30 font-sans disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search Engine'}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm font-sans">
          {error}
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="space-y-6">
          {/* Filter Chips */}
          <div className="flex gap-2 border-b border-[#1B262E] pb-3 overflow-x-auto text-xs font-sans">
            {[
              { id: 'all', label: 'All Results' },
              { id: 'workspaces', label: `Workspaces (${results.workspaces?.length || 0})` },
              { id: 'groups', label: `Groups (${results.groups?.length || 0})` },
              { id: 'projects', label: `Projects (${results.projects?.length || 0})` },
              { id: 'submissions', label: `Submissions (${results.submissions?.length || 0})` },
              { id: 'students', label: `Students (${results.students?.length || 0})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 rounded-full transition-all ${
                  filter === f.id
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                    : 'bg-[#11181C] text-slate-400 border border-[#1B262E] hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Workspaces Section */}
          {(filter === 'all' || filter === 'workspaces') && results.workspaces?.length > 0 && (
            <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-3">
              <h3 className="text-sm font-bold text-slate-200 font-sans">Matched Workspaces</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.workspaces.map((ws) => (
                  <div key={ws.id} className="p-3 bg-[#0B0F12] rounded border border-[#1B262E] space-y-1">
                    <div className="font-semibold text-sm text-slate-100">{ws.name || ws.title}</div>
                    <div className="text-xs text-slate-400">{ws.description || 'No description'}</div>
                    <div className="text-[10px] text-teal-400 font-mono mt-1">{ws.term}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Groups Section */}
          {(filter === 'all' || filter === 'groups') && results.groups?.length > 0 && (
            <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-3">
              <h3 className="text-sm font-bold text-slate-200 font-sans">Matched Groups</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.groups.map((g) => (
                  <div key={g.id} className="p-3 bg-[#0B0F12] rounded border border-[#1B262E] space-y-1">
                    <div className="text-xs text-slate-200 font-semibold">{g.name || `Group #${g.id}`}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {(filter === 'all' || filter === 'projects') && results.projects?.length > 0 && (
            <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-3">
              <h3 className="text-sm font-bold text-slate-200 font-sans">Matched Projects</h3>
              <div className="space-y-2">
                {results.projects.map((p) => (
                  <div key={p.id} className="p-3 bg-[#0B0F12] rounded border border-[#1B262E] flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-slate-100">{p.title || p.name}</div>
                      <div className="text-xs text-slate-400">{p.description}</div>
                    </div>
                    {onSelectProject && (
                      <button
                        onClick={() => onSelectProject(p.id)}
                        className="px-3 py-1 bg-teal-600/20 text-teal-300 border border-teal-500/30 text-xs rounded hover:bg-teal-600/40"
                      >
                        Inspect →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submissions Section */}
          {(filter === 'all' || filter === 'submissions') && results.submissions?.length > 0 && (
            <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-3">
              <h3 className="text-sm font-bold text-slate-200 font-sans">Matched Submissions</h3>
              <div className="space-y-2">
                {results.submissions.map((s) => (
                  <div key={s.version_id} className="p-3 bg-[#0B0F12] rounded border border-[#1B262E] flex justify-between items-center text-xs">
                    <div>
                      <div className="font-mono text-teal-300 font-bold">Submission Version v{s.version_number}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{s.notes || s.link || 'Deliverable'}</div>
                      {s.github_commit_sha && (
                        <div className="text-slate-500 font-mono text-[10px]">SHA: {s.github_commit_sha}</div>
                      )}
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Students Section */}
          {(filter === 'all' || filter === 'students') && results.students?.length > 0 && (
            <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-3">
              <h3 className="text-sm font-bold text-slate-200 font-sans">Enrolled Students</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {results.students.map((st) => (
                  <div key={st.id} className="p-2.5 bg-[#0B0F12] rounded border border-[#1B262E] text-xs">
                    <div className="font-semibold text-slate-200">{st.full_name}</div>
                    <div className="text-slate-500 font-mono text-[10px]">{st.email}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
