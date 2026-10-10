import React, { useState, useEffect, useMemo } from 'react';
import { workspaceApi } from '../../api/workspaceApi';
import { resultApi } from '../../api/resultApi';

export const StaffResultsView = ({ selectedWorkspaceId }) => {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(selectedWorkspaceId || '');
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Results data state
  const [resultsData, setResultsData] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState(null);

  // CSV export state
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFinalStatus, setFilterFinalStatus] = useState('ALL');
  const [filterCompletion, setFilterCompletion] = useState('ALL');

  // Selected student for detail scorecard modal
  const [inspectStudent, setInspectStudent] = useState(null);

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Update active workspace if parent prop changes
  useEffect(() => {
    if (selectedWorkspaceId && selectedWorkspaceId !== activeWorkspaceId) {
      setActiveWorkspaceId(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  // Fetch workspace results whenever activeWorkspaceId changes
  useEffect(() => {
    if (activeWorkspaceId) {
      fetchWorkspaceResults(activeWorkspaceId);
    } else {
      setResultsData(null);
    }
  }, [activeWorkspaceId]);

  const fetchWorkspaces = async () => {
    setLoadingWorkspaces(true);
    try {
      const data = await workspaceApi.getMyWorkspaces();
      const list = data || [];
      setWorkspaces(list);
      if (!activeWorkspaceId && list.length > 0) {
        setActiveWorkspaceId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load workspaces for results:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const fetchWorkspaceResults = async (wsId) => {
    setLoadingResults(true);
    setResultsError(null);
    try {
      const data = await resultApi.getWorkspaceResults(wsId);
      setResultsData(data);
    } catch (err) {
      setResultsError(err.message || 'Failed to load workspace results ledger.');
      setResultsData(null);
    } finally {
      setLoadingResults(false);
    }
  };

  const handleExportCsv = async () => {
    if (!activeWorkspaceId) return;
    setExportingCsv(true);
    setExportSuccessMsg(null);
    try {
      const filename = await resultApi.exportWorkspaceResultsCsv(activeWorkspaceId);
      setExportSuccessMsg(`Successfully exported: ${filename}`);
      setTimeout(() => setExportSuccessMsg(null), 5000);
    } catch (err) {
      setResultsError(err.message || 'CSV Export failed. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  // Filter students based on search and status selects
  const filteredStudents = useMemo(() => {
    if (!resultsData?.students) return [];
    return resultsData.students.filter((student) => {
      // 1. Text search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = student.student_name?.toLowerCase().includes(term);
        const matchesRoll = student.roll_number?.toLowerCase().includes(term);
        const matchesEmail = student.student_email?.toLowerCase().includes(term);
        const matchesGroup = student.group_name?.toLowerCase().includes(term) || student.group_code?.toLowerCase().includes(term);
        const matchesTopic = student.project_topic?.toLowerCase().includes(term);
        if (!matchesName && !matchesRoll && !matchesEmail && !matchesGroup && !matchesTopic) {
          return false;
        }
      }

      // 2. Final Result Status filter
      if (filterFinalStatus !== 'ALL' && student.final_result_status !== filterFinalStatus) {
        return false;
      }

      // 3. Completion Status filter
      if (filterCompletion !== 'ALL' && student.review_completion_status !== filterCompletion) {
        return false;
      }

      return true;
    });
  }, [resultsData, searchTerm, filterFinalStatus, filterCompletion]);

  const rounds = resultsData?.rounds || [];
  const summary = resultsData?.summary;

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterFinalStatus('ALL');
    setFilterCompletion('ALL');
  };

  const formatReviewDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1B262E] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100 font-serif tracking-tight">
              Academic Results & Student Marks
            </h1>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
              Individual Grading Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Authoritative results center tracking individual student marks, teacher feedback, and completion across all review rounds.
          </p>
        </div>

        {/* Action Controls: Workspace Selector & CSV Export */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Workspace Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-mono uppercase text-slate-400 whitespace-nowrap">Workspace:</label>
            <select
              value={activeWorkspaceId}
              onChange={(e) => setActiveWorkspaceId(e.target.value)}
              disabled={loadingWorkspaces}
              className="bg-[#11181C] border border-[#1B262E] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500 min-w-[180px]"
            >
              {workspaces.length === 0 && <option value="">No managed workspaces</option>}
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name || ws.title} (#{ws.id})
                </option>
              ))}
            </select>
          </div>

          {/* Export Workspace CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv || !activeWorkspaceId || !resultsData?.students?.length}
            className="px-3.5 py-1.5 text-xs font-sans rounded-lg bg-teal-500 text-slate-950 font-semibold hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-teal-glow whitespace-nowrap"
          >
            {exportingCsv ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Exporting CSV...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Export Workspace Results (CSV)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export Success Banner */}
      {exportSuccessMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-sans flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{exportSuccessMsg}</span>
          </div>
          <button onClick={() => setExportSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {resultsError && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-sans flex items-center justify-between">
          <span>{resultsError}</span>
          <button onClick={() => fetchWorkspaceResults(activeWorkspaceId)} className="underline font-mono text-[11px] hover:text-rose-200">
            Retry
          </button>
        </div>
      )}

      {/* 2. SUMMARY METRIC CARDS */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Total Students */}
          <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-sans text-slate-400 uppercase tracking-wider">Total Students</span>
            <div className="text-xl font-bold font-mono text-slate-100 mt-1">
              {summary.total_students}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">Enrolled individual students</span>
          </div>

          {/* Total Groups */}
          <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-sans text-slate-400 uppercase tracking-wider">Total Groups</span>
            <div className="text-xl font-bold font-mono text-teal-300 mt-1">
              {summary.total_groups}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">Active workspace groups</span>
          </div>

          {/* Completed Evaluations */}
          <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-sans text-slate-400 uppercase tracking-wider">Fully Evaluated</span>
            <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
              {summary.completed_students} <span className="text-xs text-slate-400 font-normal">/ {summary.total_students}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">
              {summary.total_students > 0 ? Math.round((summary.completed_students / summary.total_students) * 100) : 0}% completed
            </span>
          </div>

          {/* Average Percentage */}
          <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-sans text-slate-400 uppercase tracking-wider">Avg Workspace Score</span>
            <div className="text-xl font-bold font-mono text-sky-300 mt-1">
              {summary.average_percentage.toFixed(1)}%
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">Across all graded rounds</span>
          </div>

          {/* Pass Rate */}
          <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-sans text-slate-400 uppercase tracking-wider">Pass Rate</span>
            <div className="text-xl font-bold font-mono text-indigo-300 mt-1">
              {summary.pass_rate.toFixed(1)}%
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">Score threshold ≥ 50%</span>
          </div>
        </div>
      )}

      {/* 3. SEARCH & FILTER TOOLBAR */}
      <div className="bg-[#11181C] rounded-xl border border-[#1B262E] p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search student, roll #, group, or project topic..."
            className="w-full pl-9 pr-8 py-1.5 bg-[#0B0F12] border border-[#1B262E] rounded-lg text-xs text-slate-200 placeholder-slate-500 font-sans focus:outline-none focus:border-teal-500"
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

        {/* Status Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Final Result Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-400">Result:</span>
            <select
              value={filterFinalStatus}
              onChange={(e) => setFilterFinalStatus(e.target.value)}
              className="bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Results</option>
              <option value="PASSED">Passed</option>
              <option value="FAILED">Failed</option>
              <option value="INCOMPLETE">Incomplete</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

          {/* Completion Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-400">Review:</span>
            <select
              value={filterCompletion}
              onChange={(e) => setFilterCompletion(e.target.value)}
              className="bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Completion</option>
              <option value="COMPLETED">Completed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

          {(searchTerm || filterFinalStatus !== 'ALL' || filterCompletion !== 'ALL') && (
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1 text-xs font-sans rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 4. DYNAMIC RESULTS LEDGER TABLE */}
      <div className="bg-[#11181C] rounded-xl border border-[#1B262E] overflow-hidden shadow-card-subtle">
        {/* Table Subheader */}
        <div className="px-4 py-2.5 border-b border-[#1B262E] bg-[#0E1418] flex items-center justify-between text-xs font-sans text-slate-400">
          <div>
            Showing <span className="font-mono text-slate-200">{filteredStudents.length}</span> individual student rows
            {resultsData?.workspace_name && (
              <span> in <strong className="text-teal-300 font-medium">{resultsData.workspace_name}</strong></span>
            )}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {rounds.length} review {rounds.length === 1 ? 'round' : 'rounds'} configured
          </div>
        </div>

        {loadingResults ? (
          <div className="py-24 text-center space-y-3">
            <div className="inline-block w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-sans text-slate-400">Loading student grading ledger...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-20 text-center space-y-2 border border-dashed border-[#1B262E] m-4 rounded-xl">
            <p className="text-xs font-sans text-slate-400">
              No student records found matching the specified filters.
            </p>
            {(searchTerm || filterFinalStatus !== 'ALL' || filterCompletion !== 'ALL') && (
              <button onClick={handleResetFilters} className="text-xs font-sans text-teal-400 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0B0F12] text-slate-400 text-[11px] uppercase tracking-wider border-b border-[#1B262E] font-mono">
                <tr>
                  {/* Fixed Columns */}
                  <th className="py-3 px-3">Group #</th>
                  <th className="py-3 px-3">Group Name</th>
                  <th className="py-3 px-3">Project Topic</th>
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">Roll Number</th>

                  {/* Dynamically Generated Round Columns */}
                  {rounds.map((round) => (
                    <th key={round.id} className="py-3 px-3 text-center border-l border-[#1B262E] bg-[#0A1014]">
                      <div className="flex flex-col items-center">
                        <span className="text-teal-300 font-bold">{round.title}</span>
                        <span className="text-[10px] text-slate-500 font-normal">Max: {round.max_score}</span>
                      </div>
                    </th>
                  ))}

                  {/* Summary Columns */}
                  <th className="py-3 px-3 text-center border-l border-[#1B262E]">Total Marks</th>
                  <th className="py-3 px-3 text-center">Percentage</th>
                  <th className="py-3 px-3 text-center">Completion</th>
                  <th className="py-3 px-3 text-center">Final Result</th>
                  <th className="py-3 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B262E]">
                {filteredStudents.map((student) => {
                  return (
                    <tr
                      key={`${student.group_id}-${student.student_id}`}
                      className="hover:bg-[#162026] transition-colors group cursor-pointer"
                      onClick={() => setInspectStudent(student)}
                    >
                      {/* Group Code */}
                      <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                        {student.group_code || `#${student.group_id}`}
                      </td>

                      {/* Group Name */}
                      <td className="py-3 px-3 font-medium text-slate-200 whitespace-nowrap">
                        {student.group_name}
                      </td>

                      {/* Project Topic */}
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={student.project_topic}>
                        {student.project_topic}
                      </td>

                      {/* Student Name */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-100 group-hover:text-teal-300 transition-colors whitespace-nowrap">
                            {student.student_name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]">
                            {student.student_email}
                          </span>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="py-3 px-3 font-mono text-teal-400 whitespace-nowrap text-[11px]">
                        {student.roll_number}
                      </td>

                      {/* Dynamic Round Columns */}
                      {rounds.map((round) => {
                        const rRes = student.rounds[String(round.id)];
                        const isGraded = rRes && rRes.score !== null;
                        return (
                          <td
                            key={round.id}
                            className="py-3 px-3 text-center border-l border-[#1B262E] whitespace-nowrap"
                          >
                            {isGraded ? (
                              <div className="flex flex-col items-center">
                                <span className="font-mono font-bold text-slate-100 text-[12px]">
                                  {rRes.score.toFixed(1)}{' '}
                                  <span className="text-[10px] text-slate-500 font-normal">/ {rRes.max_score}</span>
                                </span>
                                {rRes.feedback && (
                                  <span className="text-[10px] text-teal-400 truncate max-w-[100px]" title={rRes.feedback}>
                                    "{rRes.feedback}"
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="text-slate-600 font-mono text-xs">—</span>
                                <span className="text-[9px] font-mono text-slate-500 uppercase">
                                  {rRes?.status || 'Pending'}
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Individual Total Marks */}
                      <td className="py-3 px-3 text-center border-l border-[#1B262E] font-mono font-bold text-slate-100 whitespace-nowrap">
                        {student.total_marks.toFixed(1)}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">/ {student.max_marks.toFixed(1)}</span>
                      </td>

                      {/* Percentage */}
                      <td className="py-3 px-3 text-center font-mono font-semibold whitespace-nowrap">
                        <span className={student.percentage >= 50 ? 'text-teal-300' : 'text-rose-400'}>
                          {student.percentage.toFixed(1)}%
                        </span>
                      </td>

                      {/* Review Completion Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {student.review_completion_status === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Completed
                          </span>
                        ) : student.review_completion_status === 'IN_PROGRESS' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            In Progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Final Result Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {student.final_result_status === 'PASSED' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            PASSED
                          </span>
                        ) : student.final_result_status === 'FAILED' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            FAILED
                          </span>
                        ) : student.final_result_status === 'INCOMPLETE' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            INCOMPLETE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            PENDING
                          </span>
                        )}
                      </td>

                      {/* Inspect Arrow */}
                      <td className="py-3 px-3 text-right text-slate-500 group-hover:text-teal-400 transition-colors">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectStudent(student);
                          }}
                          className="px-2 py-1 rounded bg-[#11181C] hover:bg-teal-500/20 text-[11px] font-mono text-slate-300 hover:text-teal-300 border border-[#1B262E]"
                        >
                          View
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

      {/* 5. INDIVIDUAL STUDENT SCORECARD MODAL */}
      {inspectStudent && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl bg-[#0B0F12] border border-[#1B262E] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1B262E] bg-[#11181C] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-teal-400">
                  Individual Student Performance Card
                </span>
                <h3 className="text-lg font-bold text-slate-100 font-sans mt-0.5">
                  {inspectStudent.student_name}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                  <span>Roll: {inspectStudent.roll_number}</span>
                  <span>•</span>
                  <span>{inspectStudent.group_name} ({inspectStudent.group_code})</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-bold text-teal-300 bg-teal-500/15 px-3 py-1 rounded-lg border border-teal-500/30">
                  {inspectStudent.percentage.toFixed(1)}% ({inspectStudent.total_marks} / {inspectStudent.max_marks})
                </span>
                <button
                  onClick={() => setInspectStudent(null)}
                  className="p-1 rounded-lg hover:bg-[#1B262E] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: Round Breakdown */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="p-3 rounded-xl bg-[#11181C] border border-[#1B262E] flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-500">Project Topic</span>
                  <div className="text-sm font-medium text-slate-200 mt-0.5">{inspectStudent.project_topic}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase text-slate-500">Result Standing</span>
                  <div className="mt-0.5 font-bold font-mono">
                    <span className={inspectStudent.final_result_status === 'PASSED' ? 'text-emerald-400' : 'text-rose-400'}>
                      {inspectStudent.final_result_status}
                    </span>
                  </div>
                </div>
              </div>

              <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider pt-2">
                Review Rounds Breakdown
              </h4>

              <div className="space-y-3">
                {rounds.map((round) => {
                  const rRes = inspectStudent.rounds[String(round.id)];
                  const isGraded = rRes && rRes.score !== null;
                  return (
                    <div
                      key={round.id}
                      className="p-4 rounded-xl bg-[#11181C] border border-[#1B262E] space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 font-sans text-sm">{round.title}</span>
                          <span className="text-[10px] font-mono text-slate-500">Order #{round.order_index}</span>
                        </div>
                        <div>
                          {isGraded ? (
                            <span className="font-mono font-bold text-teal-300 text-sm">
                              {rRes.score.toFixed(1)} <span className="text-slate-500 text-xs font-normal">/ {rRes.max_score}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {rRes?.status || 'Unrated'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Review details */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1 border-t border-[#1B262E]/60">
                        <div>
                          <span className="text-slate-500">Evaluator:</span>{' '}
                          <span className="text-slate-300">{rRes?.reviewer_name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Evaluation Date:</span>{' '}
                          <span className="text-slate-300">{formatReviewDate(rRes?.review_date)}</span>
                        </div>
                      </div>

                      {/* Individual Teacher Feedback */}
                      {rRes?.feedback ? (
                        <div className="mt-2 p-3 rounded-lg bg-[#080C0E] border border-[#1B262E] space-y-1">
                          <span className="text-[10px] font-mono uppercase text-teal-400">Teacher Feedback</span>
                          <p className="text-xs text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">
                            {rRes.feedback}
                          </p>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">No written feedback recorded for this round.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-[#1B262E] bg-[#11181C] flex justify-end">
              <button
                onClick={() => setInspectStudent(null)}
                className="px-4 py-1.5 rounded-lg bg-[#162026] hover:bg-[#1B262E] border border-[#1B262E] text-slate-300 text-xs font-sans transition-colors"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
