// client/src/components/TimesheetForm.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, AlertTriangle, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import api from '../api/axios';

const TimesheetForm = ({ onSubmitSuccess }) => {
  const [date, setDate] = useState('');
  const [tasks, setTasks] = useState([
    {
      id: `task-${Date.now()}`,
      clientProjectName: '',
      projectType: 'Project admin & Management',
      projectNumber: '',
      description: '',
      hours: '',
    },
  ]);
  const [attachment, setAttachment] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clientNames, setClientNames] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState({});

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

  // Fetch existing timesheets to get client names
  const fetchExistingTimesheets = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/timesheets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data || [];

      // Extract unique client names
      const uniqueClients = new Set();
      data.forEach(ts => {
        (ts.tasks || []).forEach(t => {
          if (t.clientProjectName?.trim()) {
            uniqueClients.add(t.clientProjectName.trim());
          }
        });
      });
      setClientNames([...uniqueClients].sort());
    } catch (err) {
      console.error('Failed to fetch timesheets for client list', err);
    }
  };

  useEffect(() => {
    fetchExistingTimesheets();
  }, []);

  const addTask = () => {
    const newTaskId = `task-${Date.now()}`;
    setTasks([
      ...tasks,
      {
        id: newTaskId,
        clientProjectName: '',
        projectType: 'Project admin & Management',
        projectNumber: '',
        description: '',
        hours: '',
      },
    ]);
    setShowClientDropdown(prev => ({ ...prev, [newTaskId]: false }));
  };

  const updateTask = (id, field, value) => {
    setTasks(tasks.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const removeTask = (id) => {
    if (tasks.length === 1) return setError('Must have at least one task');
    setTasks(tasks.filter(t => t.id !== id));
  };

  const toggleClientDropdown = (taskId) => {
    setShowClientDropdown(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const selectClient = (taskId, clientName) => {
    updateTask(taskId, 'clientProjectName', clientName);
    toggleClientDropdown(taskId);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setSuccess('');

  if (!date) {
    setError('Date is required');
    return;
  }

  // Validation
  for (const t of tasks) {
    if (!t.clientProjectName?.trim()) {
      setError('All tasks must have Client / Project Name');
      return;
    }
    if (!t.description?.trim()) {
      setError('All tasks must have Task Description');
      return;
    }
    if (!t.hours || Number(t.hours) <= 0) {
      setError('All tasks must have valid hours');
      return;
    }
  }

  try {
    const formData = new FormData();
    formData.append('date', date);
    formData.append('tasks', JSON.stringify(tasks));   // This is the key line
    if (attachment) formData.append('attachment', attachment);

    const token = localStorage.getItem('token');

    await api.post('/timesheets', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Do NOT set Content-Type here - let browser set it for FormData
      },
    });

    setSuccess('Timesheet submitted successfully!');
    
    // Reset form
    setDate('');
    setTasks([{
      id: `task-${Date.now()}`,
      clientProjectName: '',
      projectType: 'Project admin & Management',
      projectNumber: '',
      description: '',
      hours: '',
    }]);
    setAttachment(null);

    if (onSubmitSuccess) onSubmitSuccess();
  } catch (err) {
    console.error(err);
    setError(err.response?.data?.error || 'Failed to submit timesheet');
  }
};

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Date */}
      <div>
        <label className="block text-lg font-medium text-gray-900 mb-3">Date *</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
          required
        />
      </div>

      {/* Tasks */}
      <div className="space-y-8">
        <h3 className="text-xl font-semibold text-gray-900">Tasks</h3>

        {tasks.map((task, index) => (
          <div key={task.id} className="p-6 bg-gray-50 rounded-2xl border border-gray-200 space-y-6 relative">
            <div className="text-sm font-medium text-gray-600 mb-4">
              Task {index + 1}
            </div>

            {/* Client / Project Name - Combo Box */}
            <div className="relative">
              <label className="block text-base font-medium text-gray-700 mb-2">Client / Project Name *</label>
              <div className="flex items-center border border-gray-300 rounded-xl focus-within:ring-custom-orange focus-within:border-custom-orange">
                <input
                  type="text"
                  value={task.clientProjectName}
                  onChange={e => updateTask(task.id, 'clientProjectName', e.target.value)}
                  onFocus={() => toggleClientDropdown(task.id)}
                  placeholder="Type or select client/project..."
                  className="flex-1 px-5 py-4 rounded-l-xl outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => toggleClientDropdown(task.id)}
                  className="px-4 py-4 bg-gray-100 hover:bg-gray-200 rounded-r-xl"
                >
                  <ChevronDown size={20} />
                </button>
              </div>

              {/* Dropdown of existing clients */}
              {showClientDropdown[task.id] && clientNames.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {clientNames.map((client, idx) => (
                    <div
                      key={idx}
                      onClick={() => selectClient(task.id, client)}
                      className="px-5 py-3 hover:bg-gray-100 cursor-pointer text-gray-800"
                    >
                      {client}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Project Type */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">Project Type *</label>
              <select
                value={task.projectType}
                onChange={e => updateTask(task.id, 'projectType', e.target.value)}
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
                required
              >
                {projectTypeOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Project No. / Opportunity Number */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">Project No. / Opportunity Number</label>
              <input
                value={task.projectNumber}
                onChange={e => updateTask(task.id, 'projectNumber', e.target.value)}
                placeholder="e.g. 200321"
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter Opportunity Number if not yet converted to Project Number
              </p>
            </div>

            {/* Task Description */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">Task Description *</label>
              <textarea
                value={task.description}
                onChange={e => updateTask(task.id, 'description', e.target.value)}
                rows={4}
                placeholder="Detailed description of work done..."
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
                required
              />
            </div>

            {/* Hours Spent */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">Hours Spent *</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={task.hours}
                onChange={e => updateTask(task.id, 'hours', e.target.value)}
                placeholder="e.g. 5.00"
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
                required
              />
            </div>

            {tasks.length > 1 && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => removeTask(task.id)}
                  className="text-red-600 hover:text-red-800 text-sm flex items-center gap-2 ml-auto"
                >
                  <XCircle size={18} /> Remove Task
                </button>
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addTask}
          className="flex items-center gap-3 px-8 py-4 bg-custom-orange text-white rounded-xl hover:bg-orange-600 transition font-medium shadow-md"
        >
          <Plus size={22} /> Add Another Task
        </button>
      </div>

      {/* Attachment */}
      <div>
        <label className="block text-lg font-medium text-gray-900 mb-3">Attachment (optional)</label>
        <input
          type="file"
          onChange={e => setAttachment(e.target.files[0])}
          className="w-full px-5 py-4 border border-dashed border-gray-300 rounded-xl cursor-pointer"
        />
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          <AlertTriangle size={20} />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">
          <CheckCircle size={20} />
          <p>{success}</p>
        </div>
      )}

      {/* Submit */}
      <div className="pt-6 border-t flex justify-end">
        <button
          type="submit"
          className="px-12 py-5 bg-custom-orange text-white rounded-xl hover:bg-orange-600 transition font-medium text-xl shadow-lg"
        >
          Submit Timesheet
        </button>
      </div>
    </form>
  );
};

export default TimesheetForm;