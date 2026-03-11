// client/src/pages/LeaveApplication.js
import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Send, Loader2, AlertTriangle, Filter } from 'lucide-react';
import api from '../api/axios';

const LeaveApplication = () => {
  const [activeTab, setActiveTab] = useState('info');
  const [leaveBalances, setLeaveBalances] = useState({
    annual: 23,
    sick: 30,
    compassionate: null,
    paternity: null,
    familyResponsibility: 3,
    unpaid: 0,
    study: 10,
  });
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    type: 'Annual Leave',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'
  const [onBehalfOf, setOnBehalfOf] = useState('');
  const [admins, setAdmins] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdmin = [1, 2].includes(roleId);

  const leaveTypes = [
    'Annual Leave',
    'Sick leave',
    'Compassionate leave',
    'Paternity Leave',
    'Family Responsibility',
    'Unpaid Leave',
    'Study leave',
  ];

  useEffect(() => {
    fetchLeaveData();
    if (isAdmin) {
      fetchUsers();
      fetchAdmins();
    }
  }, [isAdmin, selectedUserId]);

  const fetchLeaveData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/leave', {
        params: selectedUserId ? { user_id: selectedUserId } : {},
      });

      // Safely handle response (backend might return different structure per role)
      const data = res.data || {};
      setLeaveBalances({
        annual: data.annual_balance ?? 23,
        sick: data.sick_balance ?? 30,
        familyResponsibility: data.family_responsibility_balance ?? 3,
        study: data.study_balance ?? 10,
        paternity: data.paternity_balance ?? 3,
        compassionate: null,
        unpaid: 0,
      });

      setRecentLeaves(Array.isArray(data.recent) ? data.recent : []);
      setPendingLeaves(Array.isArray(data.pending) ? data.pending : []);
    } catch (err) {
      console.error('Failed to load leave data:', err);
      setError('Failed to load leave information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await api.get('/managers');
      setAdmins(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load admins:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/leave', formData);
      setSuccess('Leave application submitted successfully!');
      setFormData({ type: 'Annual Leave', startDate: '', endDate: '', reason: '' });
      fetchLeaveData(); // refresh
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit leave application');
    } finally {
      setSubmitting(false);
    }
  };

  const openActionModal = (request, type) => {
    setSelectedRequest(request);
    setActionType(type);
    setOnBehalfOf('');
    setError('');
  };

  const closeActionModal = () => {
    setSelectedRequest(null);
    setActionType('');
    setOnBehalfOf('');
    setError('');
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;

    setActionLoading(true);
    setError('');

    try {
      const endpoint = actionType === 'approve' ? 'approve' : 'reject';
      const payload = actionType === 'approve' ? { onBehalfOf } : {};

      await api.put(`/leave/${selectedRequest.id}/${endpoint}`, payload);

      setSuccess(`Leave ${actionType}d successfully`);
      fetchLeaveData();
      closeActionModal();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${actionType} leave`);
    } finally {
      setActionLoading(false);
    }
  };

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">Leave Management</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertTriangle size={20} />
          <p>{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-5 px-6 text-center font-medium text-lg transition-all ${
                activeTab === 'info'
                  ? 'border-b-4 border-custom-orange text-custom-orange bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Leave Information & Details
            </button>
            <button
              onClick={() => setActiveTab('application')}
              className={`flex-1 py-5 px-6 text-center font-medium text-lg transition-all ${
                activeTab === 'application'
                  ? 'border-b-4 border-custom-orange text-custom-orange bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Leave Application
            </button>
          </nav>
        </div>

        {/* Tab: Leave Information & Details */}
        {activeTab === 'info' && (
          <div className="p-6 md:p-8">
            {isAdmin && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Filter size={18} />
                  Filter by Employee
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    fetchLeaveData();
                  }}
                  className="w-full md:w-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-custom-orange focus:border-custom-orange"
                >
                  <option value="">All Employees</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin mr-3" size={24} />
                Loading leave information...
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow border overflow-hidden">
                {/* Leave Entitlement Policy */}
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold mb-6">Leave Entitlement Policy</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-5">
                      <div>
                        <h3 className="font-medium text-gray-800">Annual Leave</h3>
                        <p className="text-gray-600">
                          23 days every year – accrues at 1.36 days per month
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          All annual leave is deducted from this entitlement.
                        </p>
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-800">Sick Leave</h3>
                        <p className="text-gray-600">
                          30 days over a 36-month cycle
                        </p>
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-800">Compassionate Leave</h3>
                        <p className="text-gray-600">
                          • Parent, sibling, child, spouse/life partner: <strong>5 days</strong><br />
                          • Uncle, aunt, grandparents, nephew, niece: <strong>3 days</strong>
                        </p>
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-800">Paternity Leave</h3>
                        <p className="text-gray-600">3 days</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <h3 className="font-medium text-gray-800">Family Responsibility Leave</h3>
                        <p className="text-gray-600">
                          3 days per year (does not accrue)
                        </p>
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-800">Unpaid Leave</h3>
                        <p className="text-gray-600">
                          0 days – granted only when other leave is exhausted
                        </p>
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-800">Study Leave</h3>
                        <p className="text-gray-600">
                          10 days per year (does not accrue)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Leave balances are tracked separately per type where applicable. Annual leave accrues monthly and is the primary paid leave type.
                    </p>
                  </div>
                </div>

                {/* Current Balances */}
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Your Current Leave Balances</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-gray-50 p-5 rounded-xl border">
                      <p className="font-medium text-gray-700">Annual Leave</p>
                      <p className="text-2xl font-bold text-custom-orange mt-2">
                        {leaveBalances.annual ?? '—'} days
                      </p>
                      <p className="text-sm text-gray-500 mt-1">Accrues at 1.36 days/month</p>
                    </div>

                    <div className="bg-gray-50 p-5 rounded-xl border">
                      <p className="font-medium text-gray-700">Sick Leave</p>
                      <p className="text-2xl font-bold text-custom-orange mt-2">
                        {leaveBalances.sick ?? '—'} days
                      </p>
                      <p className="text-sm text-gray-500 mt-1">36-month cycle</p>
                    </div>

                    <div className="bg-gray-50 p-5 rounded-xl border">
                      <p className="font-medium text-gray-700">Family Responsibility</p>
                      <p className="text-2xl font-bold text-custom-orange mt-2">
                        {leaveBalances.familyResponsibility ?? '—'} days
                      </p>
                      <p className="text-sm text-gray-500 mt-1">Per year, no accrual</p>
                    </div>

                    <div className="bg-gray-50 p-5 rounded-xl border">
                      <p className="font-medium text-gray-700">Study Leave</p>
                      <p className="text-2xl font-bold text-custom-orange mt-2">
                        {leaveBalances.study ?? '—'} days
                      </p>
                      <p className="text-sm text-gray-500 mt-1">Per year, no accrual</p>
                    </div>

                    <div className="bg-gray-50 p-5 rounded-xl border">
                      <p className="font-medium text-gray-700">Paternity Leave</p>
                      <p className="text-2xl font-bold text-custom-orange mt-2">
                        {leaveBalances.paternity ?? '3'} days
                      </p>
                    </div>

                    <div className="bg-gray-50 p-5 rounded-xl border">
                      <p className="font-medium text-gray-700">Compassionate Leave</p>
                      <p className="text-2xl font-bold text-custom-orange mt-2">
                        {leaveBalances.compassionate ?? '—'} days
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        5 days (immediate family) / 3 days (extended family)
                      </p>
                    </div>

                    <div className="bg-gray-50 p-5 rounded-xl border">
                      <p className="font-medium text-gray-700">Unpaid Leave</p>
                      <p className="text-2xl font-bold text-custom-orange mt-2">
                        {leaveBalances.unpaid ?? '0'} days
                      </p>
                      <p className="text-sm text-gray-500 mt-1">Only when other leave exhausted</p>
                    </div>
                  </div>
                </div>

                {/* Recent Applications */}
                <div className="p-6 border-t">
                  <h3 className="text-lg font-semibold mb-4">Recent Leave Applications</h3>
                  {recentLeaves.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No recent leave applications
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Applicant</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Start Date</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">End Date</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Days</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Type</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Applied On</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {recentLeaves.map((leave) => (
                            <tr key={leave.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">{leave.applicant_name || '—'}</td>
                              <td className="px-6 py-4">{new Date(leave.start_date).toLocaleDateString()}</td>
                              <td className="px-6 py-4">{new Date(leave.end_date).toLocaleDateString()}</td>
                              <td className="px-6 py-4 font-medium">{leave.days_applied}</td>
                              <td className="px-6 py-4">{leave.type}</td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {new Date(leave.application_date).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Leave Application */}
        {activeTab === 'application' && (
          <div className="p-6 md:p-8">
            {!isAdmin && (
              <>
                <h2 className="text-2xl font-bold mb-6">Submit Leave Request</h2>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3">
                    <AlertTriangle size={20} />
                    <p>{error}</p>
                  </div>
                )}
                {success && (
                  <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-3">
                    <CheckCircle size={20} />
                    <p>{success}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-sm">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Leave Type *</label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-custom-orange focus:border-custom-orange"
                      required
                    >
                      {leaveTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Start Date *</label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-custom-orange focus:border-custom-orange"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End Date *</label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-custom-orange focus:border-custom-orange"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reason *</label>
                    <textarea
                      name="reason"
                      value={formData.reason}
                      onChange={handleChange}
                      rows={4}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-custom-orange focus:border-custom-orange"
                      required
                      placeholder="Please provide details about your leave request..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-3 px-4 rounded-lg text-white font-medium flex items-center justify-center gap-2 ${
                      submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-custom-orange hover:bg-orange-600'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Leave Request'
                    )}
                  </button>
                </form>
              </>
            )}

            {/* Leave Applications Table */}
            <div className="mt-12">
              <h2 className="text-2xl font-semibold mb-6">
                {isAdmin ? 'Pending Leave Applications' : 'Your Leave Applications'}
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin mr-3" size={24} />
                  Loading...
                </div>
              ) : (isAdmin ? pendingLeaves : recentLeaves).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {isAdmin ? 'No pending applications' : 'No leave applications submitted yet'}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Applicant</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Application Date</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Days</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Reason</th>
                        {isAdmin && <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(isAdmin ? pendingLeaves : recentLeaves).map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">{req.applicant_name || '—'}</td>
                          <td className="px-6 py-4">{new Date(req.application_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 font-medium">{req.days_applied}</td>
                          <td className="px-6 py-4 text-gray-700">{req.reason}</td>
                          {isAdmin && (
                            <td className="px-6 py-4">
                              <div className="flex gap-3">
                                <button
                                  onClick={() => openActionModal(req, 'approve')}
                                  className="text-green-600 hover:text-green-800 transition"
                                  title="Approve"
                                >
                                  <CheckCircle size={22} />
                                </button>
                                <button
                                  onClick={() => openActionModal(req, 'reject')}
                                  className="text-red-600 hover:text-red-800 transition"
                                  title="Reject"
                                >
                                  <XCircle size={22} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Modal (Admin only) */}
      {selectedRequest && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
            <h2 className="text-2xl font-bold mb-6">
              {actionType === 'approve' ? 'Approve Leave' : 'Reject Leave'}
            </h2>

            <div className="space-y-4 mb-8">
              <p><strong>Applicant:</strong> {selectedRequest.applicant_name}</p>
              <p><strong>Type:</strong> {selectedRequest.type}</p>
              <p><strong>Dates:</strong> {new Date(selectedRequest.start_date).toLocaleDateString()} - {new Date(selectedRequest.end_date).toLocaleDateString()}</p>
              <p><strong>Days:</strong> {selectedRequest.days_applied}</p>
              <p><strong>Reason:</strong> {selectedRequest.reason}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">On behalf of another manager (optional)</label>
              <select
                value={onBehalfOf}
                onChange={e => setOnBehalfOf(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-custom-orange focus:border-custom-orange"
              >
                <option value="">Myself</option>
                {admins.map(admin => (
                  <option key={admin.id} value={admin.id}>
                    {admin.first_name} {admin.last_name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button
                onClick={closeActionModal}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition"
              >
                Close
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={`px-8 py-3 text-white rounded-xl font-medium transition flex items-center gap-2 ${
                  actionLoading ? 'bg-gray-400 cursor-not-allowed' : actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading && <Loader2 size={20} className="animate-spin" />}
                {actionType === 'approve' ? 'Accept' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveApplication;