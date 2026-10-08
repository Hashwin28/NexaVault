import React, { useState } from 'react';
import { Search, Database, Layers, FolderGit2, FileText, AlertCircle } from 'lucide-react';
import { searchApi } from '../../api/searchApi';

export const SmartSearchView = () => {
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
      setError(err.message || 'Search query failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-tight">
          Smart Search
        </h1>
        <p className="text-sm text-slate-400 mt-1 font-sans">
          Scoped semantic index and query engine across enrolled workspaces, group projects, and deliverables.
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="relative max-w-3xl">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deliverables, workspace names, project descriptions..."
            className="w-full bg-vault-surface border border-teal-500/30 rounded-2xl py-4 pl-12 pr-28 text-white placeholder-slate-500 text-sm outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 shadow-card-subtle font-sans"
            required
          />
          <Search size={20} className="absolute left-4 top-4 text-teal-400" />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-3 top-2.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Query Index'}
          </button>
        </div>
      </form>

      {error && (
        <div className="max-w-3xl p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2 font-sans">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Results Section */}
      {results && (
        <div className="max-w-3xl space-y-6">
          {/* Filter Chips */}
          <div className="flex gap-2 border-b border-vault-border/60 pb-3 overflow-x-auto text-xs font-sans">
            {[
              { id: 'all', label: 'All Results' },
              { id: 'workspaces', label: `Workspaces (${results.workspaces?.length || 0})` },
              { id: 'projects', label: `Projects (${results.projects?.length || 0})` },
              { id: 'submissions', label: `Submissions (${results.submissions?.length || 0})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 rounded-full transition-all ${
                  filter === f.id
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                    : 'bg-vault-surface text-slate-400 border border-vault-border hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Workspaces */}
          {(filter === 'all' || filter === 'workspaces') && results.workspaces?.length > 0 && (
            <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 font-serif">
                <Layers size={16} className="text-teal-400" /> Enrolled Workspaces
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.workspaces.map((ws) => (
                  <div key={ws.id} className="p-3 bg-vault-canvas rounded-xl border border-vault-border/60 space-y-1">
                    <div className="font-semibold text-sm text-slate-100">{ws.name}</div>
                    <div className="text-xs text-slate-400">{ws.description || 'No description'}</div>
                    <div className="text-[10px] text-teal-400 font-mono mt-1">{ws.term}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {(filter === 'all' || filter === 'projects') && results.projects?.length > 0 && (
            <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 font-serif">
                <FolderGit2 size={16} className="text-teal-400" /> Group Projects
              </h3>
              <div className="space-y-2">
                {results.projects.map((p) => (
                  <div key={p.id} className="p-3 bg-vault-canvas rounded-xl border border-vault-border/60 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-slate-100">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.description || 'No description provided'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submissions */}
          {(filter === 'all' || filter === 'submissions') && results.submissions?.length > 0 && (
            <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 font-serif">
                <FileText size={16} className="text-teal-400" /> Deliverables & Submissions
              </h3>
              <div className="space-y-2">
                {results.submissions.map((s) => (
                  <div key={s.version_id} className="p-3 bg-vault-canvas rounded-xl border border-vault-border/60 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-mono text-teal-300 font-bold">Submission Version v{s.version_number}</div>
                      <div className="text-slate-400 mt-0.5">{s.notes || s.link || 'No notes attached'}</div>
                      {s.github_commit_sha && (
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">SHA: {s.github_commit_sha}</div>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!results.workspaces?.length && !results.projects?.length && !results.submissions?.length) && (
            <div className="p-8 bg-vault-surface border border-vault-border/60 rounded-2xl text-center space-y-2">
              <Database size={24} className="text-slate-500 mx-auto" />
              <div className="text-sm font-bold text-slate-300 font-serif">No matches found</div>
              <p className="text-xs text-slate-500 font-sans">No records matching "{query}" in your enrolled scope.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
