// client/src/pages/Dashboard.js
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Calendar, FileText, Clock, AlertTriangle, Send } from 'lucide-react';  // ← Added Send here
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

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

// Skeleton components (unchanged)
const SkeletonCard = ({ children }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-md h-full flex flex-col animate-pulse">
    {children}
  </div>
);

const SkeletonLine = ({ width = 'w-3/4', height = 'h-4' }) => (
  <div className={`bg-gray-200 rounded ${width} ${height}`} />
);

const Dashboard = () => {
  const navigate = useNavigate();

  const [data, setData] = useState({ totalProduction: 0, timeValue: 0, funds: 0 });
  const [timesheets, setTimesheets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingUser, setLoadingUser] = useState(true);

  // Leave data (dynamic)
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);
  const accumulationRate = 1.5; // days per month - now defined

  // Graph date range
  const [startDate, setStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState(endOfWeek(new Date(), { weekStartsOn: 1 }));

  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdmin = [1, 2].includes(roleId);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      window.location.href = '/';
      return;
    }

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Stats
        const statsRes = await api.get('${`${process.env.REACT_APP_API_URL}`}/dashboard-data', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(statsRes.data || { totalProduction: 0, timeValue: 0, funds: 0 });

        // Timesheets
        const tsRes = await api.get('${`${process.env.REACT_APP_API_URL}`}/timesheets', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tsData = tsRes.data || [];
        setTimesheets(tsData);

        // User mapping
        const userIds = new Set(tsData.map(ts => ts.user_id).filter(Boolean));
        if (userIds.size > 0) {
          const usersRes = await api.get('${`${process.env.REACT_APP_API_URL}`}/users', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const users = usersRes.data || [];
          const map = {};
          users.forEach(u => {
            map[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
          });
          setUsersMap(map);
        }

        // Notifications (admin only)
        if (isAdmin) {
          const notifRes = await api.get('${`${process.env.REACT_APP_API_URL}`}/notifications', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const notifs = notifRes.data || [];
          setNotifications(notifs);
          setUnreadCount(notifs.filter(n => !n.is_read).length);
        }

        // User data & leave info
        const userRes = await api.get('${`${process.env.REACT_APP_API_URL}`}/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(userRes.data);
        setLeaveBalance(userRes.data.leave_balance || 20);

        // Recent leave applications
        const leaveRes = await api.get('${`${process.env.REACT_APP_API_URL}`}/leave', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRecentLeaves(leaveRes.data.recent || []);
        if (isAdmin) {
          setPendingLeavesCount(leaveRes.data.pending?.length || 0);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
        setLoadingUser(false);
      }
    };

    fetchDashboardData();
  }, [isAdmin]);

  // This week's hours
  const getThisWeekHours = () => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    return timesheets
      .filter(ts => {
        const d = new Date(ts.date);
        return d >= weekStart && d <= weekEnd;
      })
      .reduce((sum, ts) => sum + Number(ts.totalHours || 0), 0)
      .toFixed(1);
  };

  // Productivity graph
  const getFilteredTimesheets = () => {
    let filtered = timesheets;
    if (startDate) filtered = filtered.filter(ts => new Date(ts.date) >= startDate);
    if (endDate) filtered = filtered.filter(ts => new Date(ts.date) <= endDate);
    if (!isAdmin) {
      const userId = user?.id;
      if (userId) filtered = filtered.filter(ts => ts.user_id === userId);
    }
    return filtered;
  };

  const productivityData = {};
  getFilteredTimesheets().forEach(ts => {
    const day = format(new Date(ts.date), 'yyyy-MM-dd');
    productivityData[day] = (productivityData[day] || 0) + Number(ts.totalHours || 0);
  });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const chartLabels = days.map(d => format(d, 'MMM dd'));
  const chartValues = days.map(d => {
    const key = format(d, 'yyyy-MM-dd');
    return productivityData[key] || 0;
  });

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: isAdmin ? 'Team Total Hours' : 'Your Hours',
        data: chartValues,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        tension: 0.3,
        pointBackgroundColor: '#f97316',
        pointRadius: 5,
        pointHoverRadius: 8,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: isAdmin ? 'Team Productivity (All Employees)' : 'Your Productivity',
        font: { size: 18 },
        padding: { top: 10, bottom: 20 }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Hours Worked' },
        ticks: { stepSize: 5 }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Employee Profile Section */}
        {!isAdmin && (
          <div className="mb-10">
            {loadingUser ? (
              <SkeletonCard>
                <div className="p-8">
                  <SkeletonLine width="w-1/2" height="h-8" />
                  <SkeletonLine width="w-3/4" height="h-6 mt-4" />
                </div>
              </SkeletonCard>
            ) : (
              <>
                <div className="bg-custom-orange text-white px-8 py-10 rounded-t-xl shadow-sm">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <div className="w-24 h-24 md:w-28 md:h-28 bg-white rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-4xl md:text-5xl font-bold text-custom-orange">
                            {(user?.first_name || user?.username || 'E')[0]?.toUpperCase() || 'E'}
                          </span>
                        </div>
                        <div className="absolute bottom-0 right-0 w-10 h-10 bg-green-500 rounded-full border-4 border-white flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>

                      <div>
                        <h1 className="text-3xl md:text-4xl font-bold">
                          {user?.first_name} {user?.last_name || user?.username || 'Employee'}
                        </h1>
                        <p className="text-xl opacity-90 mt-2">{user?.job_title || 'Team Member'}</p>
                        <p className="text-lg opacity-80 mt-1">
                          Employee ID: {user?.employee_id || 'Not assigned'}
                        </p>
                      </div>
                    </div>

                    <div className="text-center md:text-right">
                      <p className="text-xl opacity-90">Welcome back,</p>
                      <p className="text-3xl md:text-4xl font-bold">
                        {user?.first_name || user?.username || 'Employee'}
                      </p>
                      <p className="text-lg opacity-80 mt-2">
                        Department: <span className="font-semibold">{user?.department || 'Not assigned'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white px-8 py-12 rounded-b-xl shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div>
                      <h3 className="text-base font-semibold text-gray-500 uppercase tracking-wider mb-6">Employment</h3>
                      <div className="space-y-5 text-lg">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Type</span>
                          <span className="font-semibold text-green-600">{user?.employment_type || 'Full-time'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Status</span>
                          <span className="font-semibold text-green-600">Active</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Start Date</span>
                          <span className="font-semibold">
                            {user?.start_date ? new Date(user.start_date).toLocaleDateString('en-ZA', { dateStyle: 'medium' }) : 'Not set'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Tenure</span>
                          <span className="font-semibold">1 year</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-gray-500 uppercase tracking-wider mb-6">Organization</h3>
                      <div className="space-y-5 text-lg">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Team</span>
                          <span className="font-semibold">{user?.team || 'Not assigned'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Manager</span>
                          <span className="font-semibold">{user?.manager_name || 'Not assigned'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Schedule</span>
                          <span className="font-semibold">Mon–Fri, 08:00–17:00</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-gray-500 uppercase tracking-wider mb-6">Contact</h3>
                      <div className="space-y-6">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-custom-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Work Email</p>
                            <p className="text-lg font-semibold">{user?.email || 'Not set'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-custom-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Work Phone</p>
                            <p className="text-lg font-semibold">{user?.phone || 'Not set'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 text-center">
                    <button
                      onClick={() => navigate('/profile')}
                      className="px-10 py-4 bg-custom-orange text-white rounded-xl font-medium hover:bg-orange-600 transition text-lg"
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Productivity Graph */}
        <div className="bg-white rounded-2xl shadow-md p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              {isAdmin ? 'Team Productivity (All Employees)' : 'Your Productivity'}
            </h3>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-gray-600" />
                <DatePicker
                  selected={startDate}
                  onChange={date => setStartDate(date)}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  placeholderText="Start Date"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-custom-orange focus:border-custom-orange w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-gray-600" />
                <DatePicker
                  selected={endDate}
                  onChange={date => setEndDate(date)}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate}
                  placeholderText="End Date"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-custom-orange focus:border-custom-orange w-40"
                />
              </div>
            </div>
          </div>

          <div className="h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Dynamic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Hours */}
          {!isAdmin ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md h-[480px] flex flex-col">
              <div className="p-8 border-b">
                <h3 className="text-xl font-semibold text-gray-900">This Week's Hours</h3>
                <p className="text-4xl font-bold text-custom-orange mt-4">
                  {getThisWeekHours()} hrs
                </p>
              </div>
              <div className="p-8 flex-1 overflow-y-auto">
                {timesheets.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">No submissions this week</p>
                ) : (
                  <ul className="space-y-5">
                    {timesheets
                      .filter(ts => {
                        const d = new Date(ts.date);
                        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
                        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
                        return d >= weekStart && d <= weekEnd;
                      })
                      .slice(0, 10)
                      .map(ts => (
                        <li key={ts.id} className="flex justify-between text-base">
                          <span className="text-gray-800 line-clamp-1">{ts.task_description || 'Task'}</span>
                          <span className="font-semibold">{Number(ts.totalHours || 0).toFixed(1)} hrs</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <div className="p-8 border-t">
                <button
                  onClick={() => navigate('/timesheets')}
                  className="w-full py-4 bg-custom-orange text-white rounded-xl hover:bg-orange-600 flex items-center justify-center gap-3 text-lg font-medium"
                >
                  <Plus size={22} /> Submit Timesheet
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md h-[480px] flex flex-col">
              <div className="p-8 border-b">
                <h3 className="text-xl font-semibold text-gray-900">Team Hours This Week</h3>
                <p className="text-4xl font-bold text-custom-orange mt-4">
                  {timesheets
                    .filter(ts => {
                      const d = new Date(ts.date);
                      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
                      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
                      return d >= weekStart && d <= weekEnd;
                    })
                    .reduce((sum, ts) => sum + Number(ts.totalHours || 0), 0)
                    .toFixed(1)} hrs
                </p>
              </div>
              <div className="p-8 flex-1 overflow-y-auto">
                {timesheets.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">No submissions this week</p>
                ) : (
                  <ul className="space-y-4 text-base">
                    {timesheets
                      .filter(ts => {
                        const d = new Date(ts.date);
                        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
                        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
                        return d >= weekStart && d <= weekEnd;
                      })
                      .slice(0, 10)
                      .map(ts => (
                        <li key={ts.id} className="flex justify-between items-center">
                          <span>
                            {usersMap[ts.user_id] || 'Unknown'} • {format(new Date(ts.date), 'MMM dd')}
                          </span>
                          <span className="font-semibold">{Number(ts.totalHours || 0).toFixed(1)} hrs</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <div className="p-8 border-t">
                <button
                  onClick={() => navigate('/timesheets')}
                  className="w-full py-4 bg-custom-orange text-white rounded-xl hover:bg-orange-600 flex items-center justify-center gap-3 text-lg font-medium"
                >
                  <Eye size={22} /> View All Timesheets
                </button>
              </div>
            </div>
          )}

          {/* Card 2: Leave (Dynamic) */}
          {!isAdmin ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md h-[480px] flex flex-col">
              <div className="p-8 border-b">
                <h3 className="text-xl font-semibold text-gray-900">Leave Balance</h3>
                <p className="text-5xl font-bold text-custom-orange mt-4">
                  {leaveBalance !== null ? leaveBalance : '—'} days
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Accrual rate: {accumulationRate} days/month
                </p>
              </div>
              <div className="p-8 flex-1 overflow-y-auto">
                <h4 className="font-semibold mb-4">Recent Leave Applications</h4>
                {recentLeaves.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">No recent applications</p>
                ) : (
                  <ul className="space-y-4">
                    {recentLeaves.slice(0, 5).map(leave => (
                      <li key={leave.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {leave.type} ({leave.days_applied} days)
                        </span>
                        <span className={`font-medium ${
                          leave.status === 'approved' ? 'text-green-600' :
                          leave.status === 'rejected' ? 'text-red-600' :
                          'text-yellow-600'
                        }`}>
                          {leave.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="p-8 border-t">
                <button
                  onClick={() => navigate('/leave')}
                  className="w-full py-4 bg-custom-orange text-white rounded-xl hover:bg-orange-600 flex items-center justify-center gap-3 text-lg font-medium"
                >
                  <Send size={22} /> Apply for Leave
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md h-[480px] flex flex-col">
              <div className="p-8 border-b">
                <h3 className="text-xl font-semibold text-gray-900">Pending Leave Requests</h3>
                <p className="text-5xl font-bold text-custom-orange mt-4">
                  {pendingLeavesCount}
                </p>
                <p className="text-sm text-gray-500 mt-2">Awaiting approval</p>
              </div>
              <div className="p-8 flex-1 overflow-y-auto">
                <h4 className="font-semibold mb-4">Team Leave Summary</h4>
                <p className="text-gray-600">Total remaining team leave days: Calculating...</p>
                {/* Can expand later with aggregate data */}
              </div>
              <div className="p-8 border-t">
                <button
                  onClick={() => navigate('/leave')}
                  className="w-full py-4 bg-custom-orange text-white rounded-xl hover:bg-orange-600 flex items-center justify-center gap-3 text-lg font-medium"
                >
                  <FileText size={22} /> Manage Leave
                </button>
              </div>
            </div>
          )}

          {/* Card 3: Notifications */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md h-[480px] flex flex-col">
            <div className="p-8 border-b">
              <h3 className="text-xl font-semibold text-gray-900">
                {isAdmin ? 'Latest Activity' : 'Notifications'}
              </h3>
              {isAdmin && (
                <p className="text-sm text-gray-600 mt-1">{unreadCount} unread</p>
              )}
            </div>
            <div className="p-8 flex-1 overflow-y-auto max-h-[300px]">
              {notifications.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No recent activity</p>
              ) : (
                <ul className="space-y-5">
                  {notifications.slice(0, 10).map(notif => (
                    <li key={notif.id} className="border-l-4 border-custom-orange pl-4">
                      <p className="font-medium text-gray-900">{notif.title}</p>
                      <p className="text-gray-700 line-clamp-2 mt-1">{notif.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-8 border-t">
              <button
                onClick={() => navigate('/messages')}
                className="w-full py-4 bg-custom-orange text-white rounded-xl hover:bg-orange-600 flex items-center justify-center gap-3 text-lg font-medium"
              >
                <Eye size={22} /> View All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;