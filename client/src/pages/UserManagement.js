// client/src/pages/UserManagement.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import api from '../api/axios';
import { Edit, Trash2, Plus, X, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [role, setRole] = useState('3');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    department: '',
    employment_type: 'Full-time',
    start_date: '',
    manager_id: '',
    employee_id: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const currentRoleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdmin = [1, 2].includes(currentRoleId);

  useEffect(() => {
    fetchUsers();
    if (isAdmin) fetchAdmins();
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('${process.env.REACT_APP_API_URL}/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users list');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('${process.env.REACT_APP_API_URL}/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdmins(res.data.filter(u => [1, 2].includes(u.role_id)) || []);
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    }
  };

  const handleRoleChange = (e) => {
    setRole(e.target.value);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      job_title: '',
      department: '',
      employment_type: 'Full-time',
      start_date: '',
      manager_id: '',
      employee_id: '',
    });
    setRole('3');
    setEditingUser(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const token = localStorage.getItem('token');
    const url = editingUser ? `${process.env.REACT_APP_API_URL}/users/${editingUser.id}` : '${process.env.REACT_APP_API_URL}/users';
    const method = editingUser ? 'put' : 'post';

    // Prepare payload - exclude password on edit
    const payload = { ...formData, role_id: parseInt(role) };
    if (editingUser) {
      delete payload.password; // prevent password change via this form
    }

    try {
      await axios[method](url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess(editingUser ? 'User updated successfully' : 'User created successfully');
      resetForm();
      fetchUsers();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Error saving user';
      console.error('Update failed:', err);
      setError(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setRole(user.role_id.toString());
    setFormData({
      username: user.username,
      password: '', // blank on edit - password change not allowed here
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
      job_title: user.job_title || '',
      department: user.department || '',
      employment_type: user.employment_type || 'Full-time',
      start_date: user.start_date ? user.start_date.split('T')[0] : '',
      manager_id: user.manager_id || '',
      employee_id: user.employee_id || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete user? This cannot be undone.')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${process.env.REACT_APP_API_URL}/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess('User deleted successfully');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error deleting user');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-lg text-gray-600">
        <Loader2 className="animate-spin mr-3" size={24} />
        Loading users...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">User Management</h1>

          {isAdmin && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-3 px-8 py-4 bg-custom-orange text-white rounded-xl hover:bg-orange-600 shadow-md transition text-lg font-medium"
            >
              <Plus size={22} /> Add New User
            </button>
          )}
        </div>

        {/* Feedback Messages */}
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

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Username</th>
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                  {isAdmin && (
                    <th className="px-8 py-5 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="text-center py-10 text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition">
                      <td className="px-8 py-6 whitespace-nowrap">
                        {user.first_name} {user.last_name}
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap font-medium">{user.username}</td>
                      <td className="px-8 py-6 whitespace-nowrap">{user.email || '—'}</td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <span
                          className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                            user.role_id === 1
                              ? 'bg-purple-100 text-purple-800'
                              : user.role_id === 2
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {user.role_id === 1 ? 'Developer' : user.role_id === 2 ? 'Admin' : 'Employee'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-8 py-6 whitespace-nowrap">
                          <div className="flex gap-4">
                            <button
                              onClick={() => handleEdit(user)}
                              className="text-blue-600 hover:text-blue-800 transition"
                              title="Edit user"
                            >
                              <Edit size={22} />
                            </button>
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="text-red-600 hover:text-red-800 transition"
                              title="Delete user"
                            >
                              <Trash2 size={22} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit User Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white z-10 border-b px-8 py-6 flex justify-between items-center">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-600 hover:text-gray-800 transition"
                >
                  <X size={32} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-8">
                {/* Role Selection */}
                <div>
                  <label className="block text-lg font-medium text-gray-700 mb-3">Role *</label>
                  <select
                    value={role}
                    onChange={handleRoleChange}
                    className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    required
                  >
                    <option value="3">Employee</option>
                    <option value="2">Admin</option>
                    <option value="1">Developer</option>
                  </select>
                </div>

                {/* Username & Password */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                      required
                      disabled={!!editingUser} // Username can't be changed
                    />
                  </div>
                  {!editingUser && (
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-3">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                        required
                        minLength={8}
                      />
                    </div>
                  )}
                </div>

                {/* Employee ID */}
                <div>
                  <label className="block text-lg font-medium text-gray-700 mb-3">Employee ID</label>
                  <input
                    type="text"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    placeholder="e.g. EMP001"
                  />
                </div>

                {/* Personal Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">First Name</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">Last Name</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    />
                  </div>
                </div>

                {/* Job & Department */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">Job Title</label>
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">Department / Team</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    />
                  </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">Work Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">Work Phone / Extension</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    />
                  </div>
                </div>

                {/* Employment Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">Employment Type</label>
                    <select
                      value={formData.employment_type}
                      onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">Start Date</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    />
                  </div>
                </div>

                {/* Manager - only for employees */}
                {role === '3' && (
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">Manager</label>
                    <select
                      value={formData.manager_id}
                      onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-custom-orange focus:border-transparent text-lg"
                    >
                      <option value="">Select Manager</option>
                      {admins.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.first_name} {admin.last_name} ({admin.role_id === 1 ? 'Dev' : 'Admin'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row gap-6 pt-8 border-t">
                  <button
                    type="submit"
                    disabled={saving}
                    className={`flex-1 py-4 rounded-xl font-medium text-lg shadow-md transition ${
                      saving ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-custom-orange text-white hover:bg-orange-600'
                    }`}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="inline animate-spin mr-2" size={20} />
                        Saving...
                      </>
                    ) : (
                      editingUser ? 'Update User' : 'Create User'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition font-medium text-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;