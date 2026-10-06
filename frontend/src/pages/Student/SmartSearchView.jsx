import React, { useState } from 'react';
import { Search, Database, Sparkles, Filter, AlertCircle } from 'lucide-react';

export const SmartSearchView = () => {
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setHasSearched(true);
  };

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
          Smart Search
        </h1>
        <p className="text-sm text-slate-400 mt-1 font-sans">
          Cross-vault semantic index and lexical query engine across projects, review rounds, and technical documentation.
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="relative max-w-3xl">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHasSearched(false);
            }}
            placeholder="Search deliverables, commit messages, feedback, course rubrics..."
            className="w-full bg-vault-surface border border-teal-500/30 rounded-2xl py-4 pl-12 pr-28 text-white placeholder-slate-500 text-sm outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 shadow-card-subtle font-sans"
          />
          <Search size={20} className="absolute left-4 top-4 text-teal-400" />
          <button
            type="submit"
            className="absolute right-3 top-2.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-colors"
          >
            Query Index
          </button>
        </div>
      </form>

      {/* Search Filter Scope Tags (Visual representation) */}
      <div className="flex flex-wrap items-center gap-2 max-w-3xl text-xs font-mono">
        <span className="text-slate-500 flex items-center gap-1 mr-2">
          <Filter size={12} /> Target Scope:
        </span>
        {['All Vaults', 'Code Deliverables', 'Round Rubrics', 'Faculty Notices', 'GitHub Commits'].map((filter, idx) => (
          <span
            key={filter}
            className={`px-3 py-1 rounded-lg border cursor-not-allowed ${
              idx === 0 
                ? 'bg-teal-500/10 border-teal-500/30 text-teal-300' 
                : 'bg-vault-surface border-vault-border/60 text-slate-400'
            }`}
          >
            {filter}
          </span>
        ))}
      </div>

      {/* Honest Backend State Banner (No Fake Data) */}
      <div className="max-w-3xl bg-vault-surface border border-vault-border/60 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
          <Database size={24} />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-white font-display">
            Global Search Indexing Pipeline Inactive
          </h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto font-sans leading-relaxed">
            The cross-vault full-text search backend and semantic embeddings indexing service is scheduled for deployment during Phase 8. No simulated or mock search results are shown.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-vault-canvas border border-vault-border text-[11px] font-mono text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Backend Service Status: Unindexed (Phase 8 Roadmap)
        </div>
      </div>
    </div>
  );
};
