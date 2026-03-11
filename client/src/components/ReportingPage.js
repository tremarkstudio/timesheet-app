// client/src/pages/ReportingPage.js
import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import axios from 'axios';
import { Search, User } from 'lucide-react';

const ReportingPage = () => {
  const [employees, setEmployees] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdminOrDev = [1, 2].includes(roleId);

  // All hooks must be at top level — moved useEffect here
  useEffect(() => {
    if (!isAdminOrDev) return; // early exit inside hook if no access (but still call hook)

    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');

        // Fetch users
        const usersRes = await api.get('/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const users = usersRes.data || [];
        const map = {};
        users.forEach(u => {
          map[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
        });
        setUsersMap(map);
        setEmployees(users.filter(u => u.role_id === 3));

        // Fetch timesheets
        const tsRes = await api.get('/timesheets', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTimesheets(tsRes.data || []);
      } catch (err) {
        console.error('Failed to fetch reporting data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdminOrDev]);

  // Access denied render
  if (!isAdminOrDev) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-3xl font-bold text-red-600">Access Denied</h1>
        <p className="mt-4 text-gray-600">This page is only available to administrators and developers.</p>
      </div>
    );
  }

  if (loading) return <div className="text-center py-10 text-lg">Loading reporting data...</div>;

  // Filter employees for search
  const filteredEmployees = employees.filter(emp =>
    `${emp.first_name || ''} ${emp.last_name || ''} ${emp.username || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Get tasks for selected employee
  const employeeTasks = selectedEmployeeId
    ? timesheets
        .filter(ts => ts.user_id === parseInt(selectedEmployeeId))
        .flatMap(ts =>
          (ts.tasks || []).map(task => ({
            ...task,
            date: ts.date,
            approvedById: ts.approved_by,
            approvalNote: ts.review_note || '—',
            status: ts.status,
          }))
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  // Tally totals by task type
  const typeTotals = {};
  employeeTasks.forEach(task => {
    const type = task.projectType || task.type || 'Uncategorized';
    typeTotals[type] = (typeTotals[type] || 0) + Number(task.hours || 0);
  });

  const grandTotal = Object.values(typeTotals).reduce((sum, h) => sum + h, 0);

  const getClientProjectDisplay = (entry) => {
    if (!entry.tasks || entry.tasks.length === 0) return '—';
    const projects = entry.tasks
      .map(t => t.clientProjectName?.trim())
      .filter(Boolean);
    const unique = [...new Set(projects)];
    if (unique.length === 0) return '—';
    if (unique.length === 1) return unique[0];
    return `Multiple (${unique.length})`;
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Employee Task Reporting</h1>

        {/* Employee Search */}
        <div className="max-w-md">
          <label className="block text-lg font-medium text-gray-900 mb-3">Search Employee</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Type to search employee..."
              className="w-full px-5 py-4 pl-12 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
            />
            <Search size={24} className="absolute left-4 top-4 text-gray-400" />
          </div>

          {searchTerm && filteredEmployees.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-lg">
              {filteredEmployees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setSelectedEmployeeId(emp.id);
                    setSearchTerm(`${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username);
                  }}
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 flex items-center gap-4"
                >
                  <User size={20} className="text-gray-500" />
                  <div>
                    <p className="font-medium">{`${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username}</p>
                    <p className="text-sm text-gray-500">{emp.email || 'No email'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Employee Content */}
        {selectedEmployeeId && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Tasks for {usersMap[selectedEmployeeId] || 'Employee'}
            </h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-700">Total Tasks</p>
                <p className="text-3xl font-bold text-blue-900">{employeeTasks.length}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                <p className="text-sm text-green-700">Total Hours</p>
                <p className="text-3xl font-bold text-green-900">{grandTotal.toFixed(2)}</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                <p className="text-sm text-orange-700">Task Types</p>
                <p className="text-3xl font-bold text-orange-900">{Object.keys(typeTotals).length}</p>
              </div>
            </div>

            {/* Type Breakdown */}
            {Object.keys(typeTotals).length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Hours by Task Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(typeTotals).map(([type, hours]) => (
                    <div key={type} className="bg-gray-50 p-4 rounded-xl border">
                      <p className="font-medium">{type}</p>
                      <p className="text-2xl font-bold text-custom-orange">{hours.toFixed(2)} hrs</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Task Name</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Project / Client Name</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Project/ Opportunity No.</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Task Type</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Date of Task</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Approved By</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Approval Note</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Hours Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employeeTasks.length > 0 ? (
                    employeeTasks.map((task, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">{task.title || task.description || '—'}</td>
                        <td className="px-6 py-4 text-sm">{task.clientProjectName || '—'}</td>
                        <td className="px-6 py-4 text-sm">{task.projectNumber || task.project_code || '—'}</td>
                        <td className="px-6 py-4 text-sm">{task.projectType || task.type || '—'}</td>
                        <td className="px-6 py-4 text-sm">{new Date(task.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm">{usersMap[task.approvedById] || '—'}</td>
                        <td className="px-6 py-4 text-sm">{task.approvalNote}</td>
                        <td className="px-6 py-4 text-sm font-medium">{Number(task.hours || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-gray-500">
                        No tasks found for this employee
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportingPage;