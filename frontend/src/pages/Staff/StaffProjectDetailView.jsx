import React, { useState, useEffect } from 'react';
import { projectApi } from '../../api/projectApi';
import { StaffResultCorrectionModal } from './StaffResultCorrectionModal';
import GitHubRepoDashboard from '../../components/common/GitHubRepoDashboard';

export const StaffProjectDetailView = ({ projectId, onBack }) => {
  const [project, setProject] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [github, setGithub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Score correction state
  const [correctionTarget, setCorrectionTarget] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchProjectOversightData(projectId);
    }
  }, [projectId]);

  const fetchProjectOversightData = async (pId) => {
    setLoading(true);
    setError(null);
    try {
      const [projData, updatesData, ghData] = await Promise.all([
        projectApi.getProject(pId),
        projectApi.getUpdates(pId).catch(() => []),
        projectApi.getGithub(pId).catch(() => null),
      ]);
      setProject(projData);
      setUpdates(updatesData || []);
      setGithub(ghData);
    } catch (err) {
      setError(err.message || 'Failed to load project oversight details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs font-mono text-slate-500">
        Loading project oversight data...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="text-xs font-mono text-teal-400 hover:underline"
        >
          ← Back to Workspace Projects
        </button>
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error || 'Project not found.'}
        </div>
      </div>
    );
  }

  const progressPercentage = project?.progress_percentage ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1B262E] pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-[#11181C] hover:bg-[#1B262E] text-slate-300 font-sans text-xs rounded border border-[#1B262E] transition-all"
          >
            ← Back to Projects
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-sans px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Oversight View
              </span>
              <h2 className="text-xl font-bold text-slate-100 font-serif">{project.name || project.title}</h2>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Workspace → Group ({project.group_code || project.group_id}) → Project Oversight
            </p>
          </div>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 font-bold">×</button>
        </div>
      )}

      {/* Grid: Left Project Metrics & Info, Right Detailed Timeline & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Weighted Progress & Group Roster */}
        <div className="space-y-6">
          {/* Weighted Progress Card */}
          <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-200 font-serif">Project Progress</h3>
              <span className="text-xs font-sans font-bold text-teal-400">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-[#0B0F12] h-3 rounded-full overflow-hidden border border-[#1B262E]">
              <div
                className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Evaluated based on completed review rounds score points.
            </p>
          </div>

          {/* Group Roster Info */}
          <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-200">Group Roster</h3>
              <span className="text-xs font-mono text-teal-400 font-bold">
                Code: {project.group_code || project.group_id}
              </span>
            </div>

            <div className="space-y-2">
              {(project.members || project.roster || []).length === 0 ? (
                <div className="text-xs font-mono text-slate-500">
                  Group members list unavailable.
                </div>
              ) : (
                (project.members || project.roster || []).map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 bg-[#0B0F12] rounded border border-[#1B262E] flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{m.full_name || m.email}</div>
                      <div className="text-[10px] font-mono text-slate-500">{m.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* GitHub Repository Link */}
          <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-2">
            <h3 className="text-sm font-bold text-slate-200">Linked GitHub Repository</h3>
            {github?.repo_url || project.repo_url ? (
              <a
                href={github?.repo_url || project.repo_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-teal-400 hover:underline break-all block p-2 bg-[#0B0F12] rounded border border-[#1B262E]"
              >
                🔗 {github?.repo_url || project.repo_url}
              </a>
            ) : (
              <div className="text-xs font-mono text-slate-500 italic p-2 bg-[#0B0F12] rounded border border-[#1B262E]">
                No repository connected yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Submissions Timeline & Published Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submissions Timeline */}
          <div className="bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-4">
            <h3 className="text-base font-bold text-slate-200">Submissions History</h3>
            {(project.submissions || []).length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                No submissions recorded for this project yet.
              </div>
            ) : (
              <div className="space-y-3">
                {project.submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 bg-[#0B0F12] rounded-lg border border-[#1B262E] space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-400">
                          v{sub.version_number}
                        </span>
                        <span className="text-xs font-semibold text-slate-200">
                          {sub.round_name || `Round ${sub.round_number || 1}`}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(sub.submitted_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-mono">
                      Commit: {sub.commit_hash || 'Latest HEAD'}
                    </p>

                    {sub.submission_notes && (
                      <p className="text-xs text-slate-400 italic bg-[#11181C] p-2 rounded border border-[#1B262E]">
                        "{sub.submission_notes}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Published Results & Score Corrections */}
          <div className="bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-200">Evaluated Results & Grades</h3>
              <span className="text-xs font-mono text-slate-400">Staff Score Correction Enabled</span>
            </div>

            {(project.results || []).length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                No evaluation results published for this project yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#0B0F12] text-slate-400 font-mono text-[10px] uppercase border-b border-[#1B262E]">
                    <tr>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Round</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Feedback</th>
                      <th className="py-2.5 px-3 text-right">Correction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B262E]">
                    {project.results.map((res) => (
                      <tr key={res.id} className="hover:bg-[#162026]">
                        <td className="py-2.5 px-3 font-semibold text-slate-200">
                          {res.student_name || res.student_email || `Student #${res.student_id}`}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {res.round_name || `Round #${res.round_id}`}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                          {res.score ?? res.score_obtained ?? 0} / {res.max_score || 100} pts
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 line-clamp-1 max-w-[200px]">
                          {res.feedback || 'No remarks'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setCorrectionTarget(res)}
                            className="px-2.5 py-1 text-[11px] bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20 rounded font-mono font-semibold"
                          >
                            Correct Score
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GitHub Repository Live Inspector */}
      {(github?.repo_url || project.repo_url) && (
        <div className="pt-2">
          <GitHubRepoDashboard
            repoUrl={github?.repo_url || project.repo_url}
            readOnly={true}
            syncedCommits={github?.commits || []}
            lastSyncedAt={github?.last_synced_at}
            onSyncRepo={async () => {
              const res = await projectApi.syncGithub(projectId);
              setGithub(res);
            }}
            projectMembers={project.members || project.roster || []}
          />
        </div>
      )}

      {/* Score Correction Modal */}
      {correctionTarget && (
        <StaffResultCorrectionModal
          entry={correctionTarget}
          onClose={() => setCorrectionTarget(null)}
          onSuccess={(msg) => {
            setSuccess(msg);
            fetchProjectOversightData(projectId);
          }}
        />
      )}
    </div>
  );
};
