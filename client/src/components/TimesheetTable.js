// client/src/components/TimesheetTable.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Eye, Edit, CheckCircle, Trash2, Plus, AlertTriangle, X } from 'lucide-react';
import api from '../api/axios';

const TimesheetTable = () => {
  const [timesheets, setTimesheets] = useState([]);
  const [filteredTimesheets, setFilteredTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [modalMode, setModalMode] = useState(''); // 'view', 'edit', 'review'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [onBehalfOfManager, setOnBehalfOfManager] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [managers, setManagers] = useState([]);

  // Filter states
  const [filters, setFilters] = useState({
    employee: '',
    date: '',
    clientProject: '',
    totalHours: '',
    tasksCount: '',
    submitted: '',
    status: '',
  });

  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdminOrDev = [1, 2].includes(roleId);

  useEffect(() => {
    fetchTimesheets();
    if (isAdminOrDev) fetchManagers();
  }, []);

  const fetchTimesheets = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/timesheets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data || [];
      setTimesheets(data);
      setFilteredTimesheets(data);
    } catch (err) {
      console.error('Failed to fetch timesheets:', err);
      setTimesheets([]);
      setFilteredTimesheets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/managers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setManagers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch managers:', err);
    }
  };

  // Apply filters
  useEffect(() => {
    let result = [...timesheets];

    if (filters.employee) {
      const term = filters.employee.toLowerCase();
      result = result.filter(entry =>
        entry.employee_name?.toLowerCase().includes(term)
      );
    }

    if (filters.date) {
      const term = filters.date.toLowerCase();
      result = result.filter(entry =>
        new Date(entry.date).toLocaleDateString().toLowerCase().includes(term)
      );
    }

    if (filters.clientProject) {
      const term = filters.clientProject.toLowerCase();
      result = result.filter(entry => {
        const projects = (entry.tasks || []).map(t => t.clientProjectName?.toLowerCase() || '');
        return projects.some(p => p.includes(term));
      });
    }

    if (filters.totalHours) {
      const term = filters.totalHours.trim();
      result = result.filter(entry =>
        Number(entry.totalHours || 0).toFixed(2).includes(term)
      );
    }

    if (filters.tasksCount) {
      const term = filters.tasksCount.trim();
      result = result.filter(entry =>
        String(entry.tasks?.length || 0).includes(term)
      );
    }

    if (filters.submitted) {
      const term = filters.submitted.toLowerCase();
      result = result.filter(entry =>
        entry.date_submitted &&
        new Date(entry.date_submitted).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })
          .toLowerCase().includes(term)
      );
    }

    if (filters.status) {
      const term = filters.status.toLowerCase();
      result = result.filter(entry =>
        entry.status?.toLowerCase().includes(term)
      );
    }

    setFilteredTimesheets(result);
  }, [timesheets, filters]);

  const clearFilters = () => {
    setFilters({
      employee: '',
      date: '',
      clientProject: '',
      totalHours: '',
      tasksCount: '',
      submitted: '',
      status: '',
    });
  };

  const openModal = (entry, mode) => {
    const mappedTasks = (entry.tasks || []).map(t => ({
  ...t,
  clientProjectName: t.client_project_name || t.clientProjectName || '',
  projectNumber: t.project_code || t.projectNumber || '',
  projectType: t.type || t.projectType || '',
  description: t.title || t.description || '',
  hours: t.hours || '',
}));

    setSelectedEntry({
      ...entry,
      tasks: mappedTasks,
    });
    setModalMode(mode);
    setReviewNote('');
    setRejectNote('');
    setShowRejectConfirm(false);
    setOnBehalfOfManager(false);
    setSelectedManagerId('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedEntry(null);
    setModalMode('');
    setIsModalOpen(false);
  };

  // ─── Employee: Add new task ──────────────────────────────────────────────
  const addTask = () => {
    setSelectedEntry(prev => ({
      ...prev,
      tasks: [
        ...(prev.tasks || []),
        {
          id: `new-${Date.now()}`,
          clientProjectName: '',
          projectType: 'Project admin & Management',
          projectNumber: '',
          description: '',
          hours: '',
        },
      ],
    }));
  };

  // ─── Update task field ───────────────────────────────────────────────────
  const updateTask = (taskId, field, value) => {
    setSelectedEntry(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === taskId ? { ...t, [field]: value } : t
      ),
    }));
  };

  // ─── Remove task ─────────────────────────────────────────────────────────
  const removeTask = (taskId) => {
    if (!window.confirm('Remove this task?')) return;
    setSelectedEntry(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== taskId),
    }));
  };

  const totalHours = selectedEntry?.tasks?.reduce((sum, t) => sum + Number(t.hours || 0), 0) || 0;

  // ─── Employee: Save edited timesheet ─────────────────────────────────────
  const handleModalSubmit = async () => {
    if (!selectedEntry) return;

    const newTasks = selectedEntry.tasks.filter(t => String(t.id).startsWith('new-'));
    if (newTasks.some(t => !t.hours || Number(t.hours) <= 0)) {
      alert('All new tasks must have hours greater than 0.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await api.put(
        `/timesheets/${selectedEntry.id}`,
        {
          tasks: selectedEntry.tasks,
          totalHours: totalHours.toFixed(2),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Timesheet updated successfully!');
      fetchTimesheets();
      closeModal();
    } catch (err) {
      const backendError = err.response?.data?.error || 'Unknown error';
      alert(`Failed to save changes: ${backendError}`);
      console.error(err);
    }
  };

  // ─── Admin/Dev: Approve ──────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!reviewNote.trim()) {
      alert('Review note is required before approving.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await api.put(
        `/timesheets/${selectedEntry.id}/approve`,
        {
          reviewNote,
          reviewedByManagerId: onBehalfOfManager ? selectedManagerId : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Timesheet approved!');
      fetchTimesheets();
      closeModal();
    } catch (err) {
      alert('Failed to approve');
      console.error(err);
    }
  };

  // ─── Admin/Dev: Reject ───────────────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectNote.trim()) {
      alert('Reject reason is required.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await api.put(
        `/timesheets/${selectedEntry.id}/reject`,
        { rejectNote },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Timesheet rejected!');
      fetchTimesheets();
      closeModal();
    } catch (err) {
      const backendError = err.response?.data?.error || 'Unknown error';
      alert(`Failed to reject timesheet: ${backendError}`);
      console.error(err);
    }
  };

  // Helper for client/project display in table
  const getClientProjectDisplay = (entry) => {
  if (!entry.tasks || entry.tasks.length === 0) return '—';
  
  const projects = entry.tasks
    .map(t => t.client_project_name || t.clientProjectName)
    .filter(Boolean);
  
  const unique = [...new Set(projects)];
  return unique.length === 1 ? unique[0] : `Multiple (${unique.length})`;
};

  const projectTypeOptions = [
    'Project admin & Management',
    'Design & Technical Management',
    'Advisory',
    'Downtime/Idle',
    'Office administration',
    'Training',
    'Tender Management',
    'General Administration',
    'Site Supervision',
  ];

  if (loading) return <div className="text-center py-10 text-lg">Loading timesheets...</div>;

  return (
    <div className="space-y-6">
      {/* Clear All Filters Button */}
      <div className="flex justify-end">
        <button
          onClick={clearFilters}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
        >
          <X size={16} /> Clear All Filters
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {isAdminOrDev && (
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Employee
                  <input
                    type="text"
                    value={filters.employee}
                    onChange={e => setFilters({ ...filters, employee: e.target.value })}
                    placeholder="Filter..."
                    className="mt-2 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-custom-orange"
                  />
                </th>
              )}
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                Date
                <input
                  type="text"
                  value={filters.date}
                  onChange={e => setFilters({ ...filters, date: e.target.value })}
                  placeholder="Filter..."
                  className="mt-2 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-custom-orange"
                />
              </th>

              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                Client / Project
                <input
                  type="text"
                  value={filters.clientProject}
                  onChange={e => setFilters({ ...filters, clientProject: e.target.value })}
                  placeholder="Filter..."
                  className="mt-2 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-custom-orange"
                />
              </th>

              {/* NEW COLUMN - Project Number */}
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                Project No.
                <input
                  type="text"
                  value={filters.projectNumber}
                  onChange={e => setFilters({ ...filters, projectNumber: e.target.value })}
                  placeholder="Filter..."
                  className="mt-2 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-custom-orange"
                />
              </th>

              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                Total Hours
                <input
                  type="text"
                  value={filters.totalHours}
                  onChange={e => setFilters({ ...filters, totalHours: e.target.value })}
                  placeholder="Filter..."
                  className="mt-2 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-custom-orange"
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                Tasks
                <input
                  type="text"
                  value={filters.tasksCount}
                  onChange={e => setFilters({ ...filters, tasksCount: e.target.value })}
                  placeholder="Filter..."
                  className="mt-2 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-custom-orange"
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                Submitted
                <input
                  type="text"
                  value={filters.submitted}
                  onChange={e => setFilters({ ...filters, submitted: e.target.value })}
                  placeholder="Filter..."
                  className="mt-2 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-custom-orange"
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                Status
                <input
                  type="text"
                  value={filters.status}
                  onChange={e => setFilters({ ...filters, status: e.target.value })}
                  placeholder="Filter..."
                  className="mt-2 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-custom-orange"
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTimesheets.length > 0 ? (
              filteredTimesheets.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  {isAdminOrDev && <td className="px-6 py-4">{entry.employee_name || '—'}</td>}
                  <td className="px-6 py-4">{new Date(entry.date).toLocaleDateString('en-ZA')}</td>
                  
                  {/* Client / Project */}
                  <td className="px-6 py-4">{getClientProjectDisplay(entry)}</td>
                  
                  {/* Project Number */}
                  <td className="px-6 py-4 font-medium text-gray-700">
                    {getProjectNumbers(entry)}
                  </td>

                  <td className="px-6 py-4 font-medium">
                    {Number(entry.totalHours || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">{entry.tasks?.length || 0}</td>
                  <td className="px-6 py-4 text-sm">
                    {entry.date_submitted 
                      ? new Date(entry.date_submitted).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' }) 
                      : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                      entry.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {entry.status?.charAt(0).toUpperCase() + entry.status?.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-4">
                      <button
                        onClick={() => openModal(entry, 'view')}
                        className="text-blue-600 hover:text-blue-800"
                        title="View details"
                      >
                        <Eye size={20} />
                      </button>

                      {(roleId === 3 && entry.status === 'pending' && !entry.locked) && (
                        <button
                          onClick={() => openModal(entry, 'edit')}
                          className="text-orange-600 hover:text-orange-800"
                          title="Edit timesheet"
                        >
                          <Edit size={20} />
                        </button>
                      )}

                      {isAdminOrDev && entry.status === 'pending' && (
                        <button
                          onClick={() => openModal(entry, 'review')}
                          className="text-green-600 hover:text-green-800"
                          title="Review"
                        >
                          <CheckCircle size={20} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isAdminOrDev ? 9 : 8} className="text-center py-10 text-gray-500">
                  No timesheets found matching filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white z-10 border-b px-8 py-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {modalMode === 'view' ? 'Timesheet Details' :
                 modalMode === 'edit' ? 'Edit Your Timesheet' :
                 'Review Timesheet'} – {new Date(selectedEntry.date).toLocaleDateString()}
              </h2>
              <button onClick={closeModal} className="text-gray-600 hover:text-gray-800">
                <X size={28} />
              </button>
            </div>

            <div className="p-8 space-y-10">
              {/* Summary */}
              <div className="bg-gray-50 p-6 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <p className="text-sm text-gray-600">Employee</p>
                    <p className="text-lg font-medium">{selectedEntry.employee_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Manager</p>
                    <p className="text-lg font-medium">{selectedEntry.manager_name || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Hours</p>
                    <p className="text-xl font-bold text-custom-orange">{totalHours.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Tasks</h3>

                {selectedEntry.tasks?.length > 0 ? (
                  selectedEntry.tasks.map((task, index) => (
                    <div key={task.id} className="p-6 bg-white border rounded-xl shadow-sm">
                      <div className="text-sm font-medium text-gray-600 mb-4">
                        Task {index + 1}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Client / Project Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Client / Project Name</label>
                          {modalMode === 'edit' ? (
                            <input
                              value={task.clientProjectName || ''}
                              onChange={e => updateTask(task.id, 'clientProjectName', e.target.value)}
                              className="w-full px-4 py-3 border rounded-lg focus:ring-custom-orange focus:border-custom-orange"
                              placeholder="e.g. Tremark Studios"
                            />
                          ) : (
                            <p className="text-lg">{task.clientProjectName || '—'}</p>
                          )}
                        </div>

                        {/* Project Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
                          {modalMode === 'edit' ? (
                            <select
                              value={task.projectType || ''}
                              onChange={e => updateTask(task.id, 'projectType', e.target.value)}
                              className="w-full px-4 py-3 border rounded-lg focus:ring-custom-orange focus:border-custom-orange"
                            >
                              {projectTypeOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-lg">{task.projectType || '—'}</p>
                          )}
                        </div>

                        {/* Project No. / Opportunity Number */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Project No. / Opportunity Number</label>
                          {modalMode === 'edit' ? (
                            <input
                              value={task.projectNumber || ''}
                              onChange={e => updateTask(task.id, 'projectNumber', e.target.value)}
                              className="w-full px-4 py-3 border rounded-lg focus:ring-custom-orange focus:border-custom-orange"
                              placeholder="e.g. 200321"
                            />
                          ) : (
                            <p className="text-lg">{task.projectNumber || '—'}</p>
                          )}
                        </div>

                        {/* Task Description */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Task Description</label>
                          {modalMode === 'edit' ? (
                            <textarea
                              value={task.description || ''}
                              onChange={e => updateTask(task.id, 'description', e.target.value)}
                              rows={4}
                              className="w-full px-4 py-3 border rounded-lg focus:ring-custom-orange focus:border-custom-orange"
                              placeholder="Detailed description of work done..."
                            />
                          ) : (
                            <p className="text-lg">{task.description || '—'}</p>
                          )}
                        </div>

                        {/* Hours Spent */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Hours Spent</label>
                          {modalMode === 'edit' && String(task.id).startsWith('new-') ? (
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={task.hours || ''}
                              onChange={e => updateTask(task.id, 'hours', e.target.value)}
                              placeholder="e.g. 5.00"
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
                              required
                            />
                          ) : (
                            <p className="text-xl font-bold text-custom-orange">
                              {Number(task.hours || 0).toFixed(2)} hrs
                            </p>
                          )}
                        </div>
                      </div>

                      {modalMode === 'edit' && (
                        <div className="mt-4 text-right">
                          <button
                            type="button"
                            onClick={() => removeTask(task.id)}
                            className="text-red-600 hover:text-red-800 text-sm flex items-center gap-2 ml-auto"
                          >
                            <Trash2 size={18} /> Remove Task
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No tasks recorded for this day.</p>
                )}
              </div>

              {/* Add New Task – employee edit only */}
              {modalMode === 'edit' && roleId === 3 && (
                <div className="pt-8">
                  <button
                    type="button"
                    onClick={addTask}
                    className="flex items-center gap-3 px-8 py-4 bg-custom-orange text-white rounded-xl hover:bg-orange-600 transition font-medium shadow-md"
                  >
                    <Plus size={22} /> Add New Task
                  </button>
                </div>
              )}

              {/* Review & approve/reject */}
              {modalMode === 'review' && isAdminOrDev && (
                <div className="mt-12 pt-8 border-t space-y-8">
                  <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200">
                    <div className="flex items-start gap-4">
                      <AlertTriangle size={28} className="text-yellow-600 mt-1 flex-shrink-0" />
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-800">Review Required</h3>
                        <p className="text-yellow-700 mt-1">
                          Please provide a review comment before approving or rejecting.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-lg font-medium text-gray-800 mb-3">
                      Review Note <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      rows={4}
                      placeholder="Enter your review comments here..."
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={onBehalfOfManager}
                      onChange={e => setOnBehalfOfManager(e.target.checked)}
                      className="w-6 h-6 text-custom-orange border-gray-300 rounded focus:ring-custom-orange"
                    />
                    <label className="text-lg font-medium text-gray-700 cursor-pointer">
                      Review / Approve on behalf of manager
                    </label>
                  </div>

                  {onBehalfOfManager && (
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-3">
                        Select Manager
                      </label>
                      <select
                        value={selectedManagerId}
                        onChange={e => setSelectedManagerId(e.target.value)}
                        className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
                        required
                      >
                        <option value="">Choose manager...</option>
                        {managers.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.first_name} {m.last_name} ({m.role_id === 1 ? 'Dev' : 'Admin'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-4 pt-6">
                    <button
                      onClick={closeModal}
                      className="px-8 py-4 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition font-medium"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={() => setShowRejectConfirm(true)}
                      className="px-8 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-medium shadow-md"
                    >
                      Reject Timesheet
                    </button>

                    <button
                      onClick={handleApprove}
                      disabled={!reviewNote.trim()}
                      className={`px-10 py-4 text-white font-medium rounded-xl transition shadow-md min-w-[160px] ${
                        reviewNote.trim()
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-green-300 cursor-not-allowed'
                      }`}
                    >
                      Approve Timesheet
                    </button>
                  </div>

                  {/* Reject Confirmation */}
                  {showRejectConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
                      <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-red-700 mb-4">Reject Timesheet</h3>
                        <p className="text-gray-700 mb-6">
                          Please confirm rejection and provide a reason.
                        </p>

                        <textarea
                          value={rejectNote}
                          onChange={e => setRejectNote(e.target.value)}
                          rows={4}
                          placeholder="Reason for rejection..."
                          className="w-full px-5 py-4 border border-gray-300 rounded-xl mb-6"
                        />

                        <div className="flex justify-end gap-4">
                          <button
                            onClick={() => setShowRejectConfirm(false)}
                            className="px-8 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleReject}
                            disabled={!rejectNote.trim()}
                            className={`px-8 py-3 text-white rounded-xl transition ${
                              rejectNote.trim() ? 'bg-red-600 hover:bg-red-700' : 'bg-red-300 cursor-not-allowed'
                            }`}
                          >
                            Confirm Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Employee Edit Actions */}
              {modalMode === 'edit' && roleId === 3 && (
                <div className="pt-10 flex justify-end gap-4 border-t">
                  <button
                    onClick={closeModal}
                    className="px-10 py-4 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleModalSubmit}
                    className="px-10 py-4 text-white rounded-xl transition font-medium shadow-md bg-custom-orange hover:bg-orange-600"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimesheetTable;