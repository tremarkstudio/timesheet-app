// client/src/pages/ReportingPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, User, Filter, Download, Calendar } from 'lucide-react';
import api from '../api/axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import * as XLSX from 'xlsx';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

const ReportingPage = () => {
  const [employees, setEmployees] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedTaskType, setSelectedTaskType] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdminOrDev = [1, 2].includes(roleId);

  // Logo path – must be in /public/images/logo.png
  const logoUrl = '/images/logo.png';

  useEffect(() => {
    if (!isAdminOrDev) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');

        const usersRes = await api.get('${${process.env.REACT_APP_API_URL}}/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const users = usersRes.data || [];
        const map = {};
        users.forEach(u => {
          map[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
        });
        setUsersMap(map);
        setEmployees(users.filter(u => u.role_id === 3));

        const tsRes = await api.get('${${process.env.REACT_APP_API_URL}}/timesheets', {
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

  if (!isAdminOrDev) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-3xl font-bold text-red-600">Access Denied</h1>
        <p className="mt-4 text-gray-600">This page is only available to administrators and developers.</p>
      </div>
    );
  }

  if (loading) return <div className="text-center py-10 text-lg">Loading reporting data...</div>;

  const filteredEmployees = employees.filter(emp =>
    `${emp.first_name || ''} ${emp.last_name || ''} ${emp.username || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const taskTypes = [...new Set(
    timesheets.flatMap(ts => (ts.tasks || []).map(t => t.projectType || t.type || 'Uncategorized'))
  )].sort();

  const clientNames = [...new Set(
    timesheets.flatMap(ts => (ts.tasks || []).map(t => t.clientProjectName?.trim()).filter(Boolean))
  )].sort();

  let employeeTasks = [];
  if (selectedEmployeeId) {
    employeeTasks = timesheets
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
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (selectedTaskType) {
      employeeTasks = employeeTasks.filter(task =>
        (task.projectType || task.type || 'Uncategorized') === selectedTaskType
      );
    }

    if (selectedClient) {
      employeeTasks = employeeTasks.filter(task =>
        task.clientProjectName?.trim() === selectedClient
      );
    }

    if (startDate) {
      employeeTasks = employeeTasks.filter(task => new Date(task.date) >= startDate);
    }
    if (endDate) {
      employeeTasks = employeeTasks.filter(task => new Date(task.date) <= endDate);
    }
  }

  const typeTotals = {};
  employeeTasks.forEach(task => {
    const type = task.projectType || task.type || 'Uncategorized';
    typeTotals[type] = (typeTotals[type] || 0) + Number(task.hours || 0);
  });

  const grandTotal = Object.values(typeTotals).reduce((sum, h) => sum + h, 0);

  // Productivity graph data (unchanged)
  const productivityData = {};
  employeeTasks.forEach(task => {
    const day = format(new Date(task.date), 'yyyy-MM-dd');
    productivityData[day] = (productivityData[day] || 0) + Number(task.hours || 0);
  });

  const periodStart = startDate || startOfWeek(new Date(), { weekStartsOn: 1 });
  const periodEnd = endDate || endOfWeek(new Date(), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });

  const chartLabels = days.map(day => format(day, 'MMM dd'));
  const chartData = days.map(day => {
    const dayKey = format(day, 'yyyy-MM-dd');
    return productivityData[dayKey] || 0;
  });

  const lineChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Hours Worked',
        data: chartData,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        tension: 0.3,
        pointBackgroundColor: '#f97316',
        pointRadius: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Productivity Over Period',
        font: { size: 16 }
      },
      tooltip: { enabled: true }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Hours' },
        min: 0,
        max: Math.max(...chartData) + 10
      }
    }
  };

  // ─── Professional Excel Export (A4, logo, colors) ────────────────────────────
  const exportToExcel = async () => {
    if (employeeTasks.length === 0) {
      alert('No data to export');
      return;
    }

    const wb = XLSX.utils.book_new();
    const orange = 'F97316';          // #f97316
    const lightOrange = 'FFEDD5';     // light orange for rows
    const veryLightOrange = 'FFF7ED'; // even lighter for alt rows

    // ─── SHEET 1: Summary ──────────────────────────────────────────────────────
    const summaryRows = [
      // Title row (merged)
      [`JIMMAC Task Report`],
      [`Employee: ${usersMap[selectedEmployeeId] || 'Selected Employee'}`],
      [`Period: ${startDate ? format(startDate, 'dd MMM yyyy') : 'Start'} — ${endDate ? format(endDate, 'dd MMM yyyy') : 'End'}`],
      [],
      // Summary header
      ['Summary Statistics'],
      ['Metric', 'Value'],
      ['Total Tasks', employeeTasks.length],
      ['Total Hours', grandTotal.toFixed(2)],
      ['Filtered Task Type', selectedTaskType || 'All Types'],
      ['Filtered Client/Project', selectedClient || 'All Clients/Projects'],
      [],
      ['Task Type Breakdown'],
      ['Task Type', 'Total Hours'],
      ...Object.entries(typeTotals).map(([type, hours]) => [type, hours.toFixed(2)]),
      [],
      ['Generated on', new Date().toLocaleString('en-ZA')],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

    // Column widths (A4-friendly)
    wsSummary['!cols'] = [
      { wch: 45 },
      { wch: 25 },
    ];

    // Merges for titles and headers
    wsSummary['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
      { s: { r: 10, c: 0 }, e: { r: 10, c: 1 } },
    ];

    // Style title rows
    ['A1', 'A2', 'A3'].forEach(cell => {
      if (wsSummary[cell]) {
        wsSummary[cell].s = {
          font: { bold: true, sz: cell === 'A1' ? 18 : 14, color: { rgb: orange } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    });

    // Style section headers
    ['A5', 'A11'].forEach(cell => {
      if (wsSummary[cell]) {
        wsSummary[cell].s = {
          font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: orange } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    });

    // Style table headers
    ['A6', 'B6', 'A12', 'B12'].forEach(cell => {
      if (wsSummary[cell]) {
        wsSummary[cell].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: lightOrange } },
          alignment: { horizontal: 'left' },
        };
      }
    });

    // Alternating rows for breakdown
    for (let r = 13; r < 13 + Object.keys(typeTotals).length; ++r) {
      ['A' + r, 'B' + r].forEach(cell => {
        if (wsSummary[cell]) {
          wsSummary[cell].s = {
            fill: { fgColor: { rgb: r % 2 === 0 ? 'FFFFFF' : veryLightOrange } },
          };
        }
      });
    }

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // ─── SHEET 2: Detailed Tasks ────────────────────────────────────────────────
    const detailedHeaders = [
      'Task Description',
      'Client / Project',
      'Project / Opp. No.',
      'Task Type',
      'Date',
      'Approved By',
      'Status',
      'Hours'
    ];

    const detailedRows = employeeTasks.map(task => [
      task.description || task.title || '-',           // ← Real task description
      task.clientProjectName || '-',
      task.projectNumber || '-',
      task.projectType || task.type || '-',
      format(new Date(task.date), 'yyyy-MM-dd'),
      usersMap[task.approvedById] || '-',
      task.status || 'Pending',
      Number(task.hours || 0).toFixed(2)
    ]);

    const wsDetails = XLSX.utils.aoa_to_sheet([detailedHeaders, ...detailedRows]);

    // Column widths (optimized for A4)
    wsDetails['!cols'] = [
      { wch: 50 },  // Task Description – extra wide
      { wch: 25 },
      { wch: 18 },
      { wch: 25 },
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
    ];

    // Freeze header row
    wsDetails['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Header row styling (orange background, white text)
    for (let C = 0; C < detailedHeaders.length; ++C) {
      const cell = XLSX.utils.encode_cell({ r: 0, c: C });
      if (wsDetails[cell]) {
        wsDetails[cell].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: orange } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        };
      }
    }

    // Alternating row colors (white / light orange)
    for (let R = 1; R <= detailedRows.length; ++R) {
      for (let C = 0; C < detailedHeaders.length; ++C) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (wsDetails[cell]) {
          wsDetails[cell].s = {
            fill: { fgColor: { rgb: R % 2 === 0 ? 'FFFFFF' : lightOrange } },
          };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, wsDetails, 'Detailed Tasks');

    // Final file name
    const fileName = `JIMMAC_Task_Report_${usersMap[selectedEmployeeId] || 'Employee'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Employee Task Reporting</h1>
          {selectedEmployeeId && employeeTasks.length > 0 && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition shadow-md whitespace-nowrap"
            >
              <Download size={20} /> Export to Excel
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          {/* Employee Search */}
          <div>
            <label className="block text-lg font-medium text-gray-900 mb-3">Search Employee</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by name..."
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

          {/* Task Type */}
          <div>
            <label className="block text-lg font-medium text-gray-900 mb-3">Task Type</label>
            <select
              value={selectedTaskType}
              onChange={e => setSelectedTaskType(e.target.value)}
              className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
            >
              <option value="">All Task Types</option>
              {taskTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Client / Project */}
          <div>
            <label className="block text-lg font-medium text-gray-900 mb-3">Client / Project</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
            >
              <option value="">All Clients / Projects</option>
              {clientNames.map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-lg font-medium text-gray-900 mb-3">Start Date</label>
            <div className="relative">
              <DatePicker
                selected={startDate}
                onChange={date => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                placeholderText="Select start date"
                className="w-full px-5 py-4 pl-12 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
              />
              <Calendar size={20} className="absolute left-4 top-4 text-gray-400" />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-lg font-medium text-gray-900 mb-3">End Date</label>
            <div className="relative">
              <DatePicker
                selected={endDate}
                onChange={date => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                placeholderText="Select end date"
                className="w-full px-5 py-4 pl-12 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
              />
              <Calendar size={20} className="absolute left-4 top-4 text-gray-400" />
            </div>
          </div>
        </div>

        {selectedEmployeeId && (
          <div className="mt-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Tasks for {usersMap[selectedEmployeeId] || 'Employee'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-700">Total Tasks</p>
                <p className="text-3xl font-bold text-blue-900">{employeeTasks.length}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                <p className="text-sm text-green-700">Total Hours</p>
                <p className="text-3xl font-bold text-green-900">{grandTotal.toFixed(2)}</p>
              </div>
              <div className="bg-purple-50 p-6 rounded-xl border border-purple-200">
                <p className="text-sm text-purple-700">Task Types</p>
                <p className="text-3xl font-bold text-purple-900">{Object.keys(typeTotals).length}</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                <p className="text-sm text-orange-700">Period</p>
                <p className="text-lg font-medium text-orange-900">
                  {startDate ? format(startDate, 'MMM dd') : 'Start'} - {endDate ? format(endDate, 'MMM dd') : 'End'}
                </p>
              </div>
            </div>

            {/* Productivity Line Graph */}
            {chartData.some(h => h > 0) && (
              <div className="mb-10">
                <h3 className="text-xl font-semibold mb-4">Productivity Line Graph</h3>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                  <Line data={lineChartData} options={chartOptions} />
                </div>
              </div>
            )}

            {/* Hours Breakdown */}
            {Object.keys(typeTotals).length > 0 && (
              <div className="mb-10">
                <h3 className="text-xl font-semibold mb-4">Hours Breakdown by Task Type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(typeTotals).map(([type, hours]) => (
                    <div key={type} className="bg-gray-50 p-5 rounded-xl border">
                      <p className="font-medium text-gray-700">{type}</p>
                      <p className="text-2xl font-bold text-custom-orange mt-2">{hours.toFixed(2)} hrs</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Task Name</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Client / Project</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Project/ Opp. No.</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Task Type</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Approved By</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Task Description</th> {/* Changed */}
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employeeTasks.length > 0 ? (
                    employeeTasks.map((task, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">{task.description || task.title || '—'}</td>
                        <td className="px-6 py-4 text-sm">{task.clientProjectName || '—'}</td>
                        <td className="px-6 py-4 text-sm">{task.projectNumber || '—'}</td>
                        <td className="px-6 py-4 text-sm">{task.projectType || task.type || '—'}</td>
                        <td className="px-6 py-4 text-sm">{new Date(task.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm">{usersMap[task.approvedById] || '—'}</td>
                        <td className="px-6 py-4 text-sm">{task.description || task.title || '—'}</td> {/* Changed */}
                        <td className="px-6 py-4 text-sm font-medium">{Number(task.hours || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-gray-500">
                        No tasks found matching the selected filters
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