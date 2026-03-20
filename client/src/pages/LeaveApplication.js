// client/src/pages/LeaveApplication.js
import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Send, Loader2, AlertTriangle, FileUp, Info } from 'lucide-react';
import api from '../api/axios';

const LeaveApplication = () => {
  const [activeTab, setActiveTab] = useState('application'); // Default to application tab
  const [leaveBalances, setLeaveBalances] = useState({
    annual: 23,
    sick: 30,
    compassionate: null,
    paternity: null,
    familyResponsibility: 3,
    unpaid: 0,
    study: 10,
    maternity: '4 months (16 weeks)',
  });
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [formData, setFormData] = useState({
    type: 'Annual Leave',
    startDate: '',
    endDate: '',
    reason: '',
    attachment: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'
  const [onBehalfOf, setOnBehalfOf] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdmin = [1, 2].includes(roleId);

  const leaveTypes = [
    'Annual Leave',
    'Sick leave',
    'Maternity Leave',
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

      const data = res.data || {};
      setLeaveBalances({
        annual: data.annual_balance ?? 23,
        sick: data.sick_balance ?? 30,
        familyResponsibility: data.family_responsibility_balance ?? 3,
        study: data.study_balance ?? 10,
        paternity: data.paternity_balance ?? 3,
        maternity: '4 months (16 weeks)',
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
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    setFormData({ ...formData, attachment: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('type', formData.type);
      formDataToSend.append('startDate', formData.startDate);
      formDataToSend.append('endDate', formData.endDate);
      formDataToSend.append('reason', formData.reason);
      if (formData.attachment) {
        formDataToSend.append('attachment', formData.attachment);
      }

      await api.post('/leave', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess('Leave application submitted successfully!');
      setFormData({
        type: 'Annual Leave',
        startDate: '',
        endDate: '',
        reason: '',
        attachment: null,
      });
      fetchLeaveData();
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">Leave Management</h1>

      {error && (
        <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 flex items-center gap-3 shadow-sm">
          <AlertTriangle size={20} />
          <p>{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('application')}
              className={`flex-1 py-5 px-6 text-center font-semibold text-lg transition-all ${
                activeTab === 'application'
                  ? 'border-b-4 border-custom-orange text-custom-orange bg-gradient-to-r from-orange-50 to-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Leave Application
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-5 px-6 text-center font-semibold text-lg transition-all ${
                activeTab === 'info'
                  ? 'border-b-4 border-custom-orange text-custom-orange bg-gradient-to-r from-orange-50 to-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Leave Information & Balances
            </button>
          </nav>
        </div>

        {/* Tab: Leave Application (first tab) */}
        {activeTab === 'application' && (
          <div className="p-6 md:p-10">
            {!isAdmin && (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Submit a Leave Request</h2>
                  <p className="text-gray-600">Please fill in the details below to submit your leave application.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                  {/* Leave Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Leave Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-custom-orange outline-none transition shadow-sm hover:border-custom-orange/50"
                      required
                    >
                      {leaveTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Conditional File Upload for Sick Leave */}
                  {formData.type === 'Sick leave' && (
                    <div className="bg-amber-50 p-6 rounded-xl border border-amber-200">
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <FileUp size={18} className="text-amber-600" />
                        Medical Certificate <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="file"
                        name="attachment"
                        onChange={handleFileChange}
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-custom-orange file:text-white hover:file:bg-orange-600 transition"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Please upload a valid medical certificate (PDF, JPG, PNG).
                      </p>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-custom-orange outline-none transition shadow-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        End Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-custom-orange outline-none transition shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Reason for Leave <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="reason"
                      value={formData.reason}
                      onChange={handleChange}
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-custom-orange outline-none transition shadow-sm resize-none"
                      placeholder="Please provide details about your leave request..."
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all flex items-center justify-center gap-3 shadow-md ${
                      submitting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-custom-orange hover:bg-orange-600 hover:shadow-lg'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={24} className="animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={22} />
                        Submit Leave Request
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            {/* Leave Applications Table (for both admin and employee) */}
            <div className="mt-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
                {isAdmin ? 'Pending Leave Applications' : 'Your Leave Applications'}
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="animate-spin mr-4 text-custom-orange" size={32} />
                  <p className="text-lg text-gray-600">Loading leave records...</p>
                </div>
              ) : (isAdmin ? pendingLeaves : recentLeaves).length === 0 ? (
                <div className="bg-white p-12 rounded-2xl shadow-md text-center text-gray-500 border border-gray-200">
                  {isAdmin ? 'No pending leave applications at the moment.' : 'You have not submitted any leave requests yet.'}
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th className="px-8 py-5 text-left text-sm font-semibold text-gray-700">Applicant</th>
                          <th className="px-8 py-5 text-left text-sm font-semibold text-gray-700">Application Date</th>
                          <th className="px-8 py-5 text-left text-sm font-semibold text-gray-700">Days</th>
                          <th className="px-8 py-5 text-left text-sm font-semibold text-gray-700">Reason</th>
                          {isAdmin && <th className="px-8 py-5 text-left text-sm font-semibold text-gray-700">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(isAdmin ? pendingLeaves : recentLeaves).map((req) => (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-8 py-6 font-medium text-gray-800">{req.applicant_name || '—'}</td>
                            <td className="px-8 py-6 text-gray-600">
                              {new Date(req.application_date).toLocaleDateString('en-ZA')}
                            </td>
                            <td className="px-8 py-6 font-medium text-gray-800">{req.days_applied}</td>
                            <td className="px-8 py-6 text-gray-700">{req.reason}</td>
                            {isAdmin && (
                              <td className="px-8 py-6">
                                <div className="flex gap-4">
                                  <button
                                    onClick={() => openActionModal(req, 'approve')}
                                    className="text-green-600 hover:text-green-800 transition-transform hover:scale-110"
                                    title="Approve"
                                  >
                                    <CheckCircle size={28} />
                                  </button>
                                  <button
                                    onClick={() => openActionModal(req, 'reject')}
                                    className="text-red-600 hover:text-red-800 transition-transform hover:scale-110"
                                    title="Reject"
                                  >
                                    <XCircle size={28} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Leave Information & Balances */}
        {activeTab === 'info' && (
          <div className="p-6 md:p-10">
            {isAdmin && (
              <div className="mb-10">
                <label className="block text-lg font-semibold text-gray-700 mb-3 flex items-center gap-3">
                  <Filter size={22} className="text-custom-orange" />
                  Filter by Employee
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    fetchLeaveData();
                  }}
                  className="w-full md:w-80 px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-custom-orange outline-none transition shadow-sm text-lg"
                >
                  <option value="">All Employees</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin mr-4 text-custom-orange" size={32} />
                <p className="text-lg text-gray-600">Loading leave balances and policy...</p>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Leave Entitlement Policy */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                    Leave Entitlement Policy
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[
                      { label: 'Annual Leave', value: leaveBalances.annual, note: '23 days/year – accrues at 1.36 days/month' },
                      { label: 'Sick Leave', value: leaveBalances.sick, note: '30 days over a 36-month cycle' },
                      { label: 'Maternity Leave', value: leaveBalances.maternity, note: '4 months (16 weeks)' },
                      { label: 'Compassionate Leave', value: leaveBalances.compassionate, note: '5 days (immediate family) / 3 days (extended)' },
                      { label: 'Paternity Leave', value: leaveBalances.paternity, note: '3 days' },
                      { label: 'Family Responsibility', value: leaveBalances.familyResponsibility, note: '3 days per year (no accrual)' },
                      { label: 'Study Leave', value: leaveBalances.study, note: '10 days per year (no accrual)' },
                      { label: 'Unpaid Leave', value: leaveBalances.unpaid, note: 'Granted only when other leave is exhausted' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <h3 className="font-semibold text-lg text-gray-800 mb-2">{item.label}</h3>
                        <p className="text-2xl font-bold text-custom-orange mb-2">
                          {item.value ?? '—'}
                        </p>
                        <p className="text-sm text-gray-600">{item.note}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 p-6 bg-blue-50 rounded-2xl border border-blue-200">
                    <p className="text-sm text-blue-800 leading-relaxed">
                      <strong>Note:</strong> Leave balances are tracked separately where applicable. Annual leave accrues monthly and is the primary paid leave type. Maternity leave is granted as a continuous period.
                    </p>
                  </div>
                </div>

                {/* Current Balances (repeated here for clarity in this tab) */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-8">Your Current Leave Balances</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Object.entries(leaveBalances).map(([key, value]) => (
                      <div
                        key={key}
                        className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-center hover:shadow-md transition-shadow"
                      >
                        <p className="font-medium text-gray-700 capitalize mb-2">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="text-3xl font-bold text-custom-orange">
                          {value ?? '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Modal (Admin only) */}
      {selectedRequest && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-10">
            <h2 className="text-3xl font-bold mb-8 text-gray-900">
              {actionType === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </h2>

            <div className="space-y-5 mb-10 text-gray-700">
              <p><strong>Applicant:</strong> {selectedRequest.applicant_name}</p>
              <p><strong>Type:</strong> {selectedRequest.type}</p>
              <p><strong>Dates:</strong> {new Date(selectedRequest.start_date).toLocaleDateString('en-ZA')} – {new Date(selectedRequest.end_date).toLocaleDateString('en-ZA')}</p>
              <p><strong>Days:</strong> {selectedRequest.days_applied}</p>
              <p><strong>Reason:</strong> {selectedRequest.reason}</p>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                On behalf of another manager (optional)
              </label>
              <select
                value={onBehalfOf}
                onChange={(e) => setOnBehalfOf(e.target.value)}
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-custom-orange outline-none transition shadow-sm text-lg"
              >
                <option value="">Myself</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.first_name} {admin.last_name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3">
                <AlertTriangle size={20} />
                <p>{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-6">
              <button
                onClick={closeActionModal}
                className="px-8 py-4 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition font-medium text-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={`px-10 py-4 text-white rounded-xl font-medium text-lg transition flex items-center gap-3 shadow-md ${
                  actionLoading ? 'bg-gray-400 cursor-not-allowed' : actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading && <Loader2 size={24} className="animate-spin" />}
                {actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveApplication;