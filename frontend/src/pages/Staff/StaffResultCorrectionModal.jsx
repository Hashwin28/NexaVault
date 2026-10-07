import React, { useState } from 'react';
import { resultApi } from '../../api/resultApi';

export const StaffResultCorrectionModal = ({ entry, onClose, onSuccess }) => {
  const [newScore, setNewScore] = useState(entry.score ?? entry.score_obtained ?? 0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A valid audit reason is required for score correction.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await resultApi.correctScore(entry.id, {
        new_score: parseFloat(newScore),
        reason: reason.trim(),
      });
      onSuccess('Score corrected successfully.');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to correct score.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#11181C] border border-[#1B262E] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex justify-between items-start border-b border-[#1B262E] pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 font-serif">Correct Published Score</h3>
            <p className="text-xs text-slate-400 font-sans">
              Student: <strong className="text-slate-200">{entry.student_name || entry.student_email || `Student #${entry.student_id}`}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl font-sans">
            ×
          </button>
        </div>

        {error && (
          <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-sans">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-sans text-slate-400 uppercase block mb-1">
              Current Score vs New Score
            </label>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-[#0B0F12] border border-[#1B262E] rounded text-xs font-sans text-slate-400">
                Current: {entry.score ?? entry.score_obtained ?? 0} pts
              </div>
              <span className="text-slate-500 font-mono">→</span>
              <input
                type="number"
                step="0.5"
                min="0"
                max={entry.max_score || 100}
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                className="flex-1 bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                required
              />
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-1">
              Max Score: {entry.max_score || 100} pts
            </span>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400 uppercase block mb-1">
              Audit Reason (Required)
            </label>
            <textarea
              rows={3}
              placeholder="State the justification for adjusting this score (logged in append-only audit log)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded shadow disabled:opacity-50"
            >
              {loading ? 'Correcting...' : 'Save Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
