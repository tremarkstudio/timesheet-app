// client/src/pages/Profile.js
import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Calendar, Briefcase, Edit2, X, Camera } from 'lucide-react';
import api from '../api/axios';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/me');
      setUser(res.data);
      setEditForm(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Profile Photo Upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      await api.put('/users/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchProfile(); // Refresh to show new photo
      alert('Profile photo updated successfully!');
    } catch (err) {
      alert('Failed to upload photo');
      console.error(err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openEditModal = () => {
    setEditForm({ ...user });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => setIsEditModalOpen(false);

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const saveProfile = async () => {
  setSaving(true);
  try {
    // Remove avatar_url from text update (handled separately by multer)
    const { avatar_url, ...safeForm } = editForm;

    const response = await api.put('/users/me', safeForm);

    setUser(prev => ({ ...prev, ...safeForm }));
    setIsEditModalOpen(false);
    alert('Profile updated successfully!');
  } catch (err) {
    console.error('Save profile error:', err.response?.data || err.message);
    alert(err.response?.data?.error || 'Failed to update profile. Please try again.');
  } finally {
    setSaving(false);
  }
};

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl">Loading profile...</div>;
  if (error || !user) return <div className="text-center py-20 text-red-600">{error || 'Profile not found'}</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-3xl p-10 shadow-xl mb-12 relative">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <div 
              className="w-32 h-32 bg-white rounded-3xl flex items-center justify-center text-7xl font-bold text-orange-600 shadow-inner overflow-hidden cursor-pointer"
              onClick={() => fileInputRef.current.click()}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user.first_name?.[0] || user.username?.[0] || 'G'
              )}
            </div>

            <div 
              className="absolute inset-0 bg-black bg-opacity-40 rounded-3xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
              onClick={() => fileInputRef.current.click()}
            >
              <div className="text-white flex flex-col items-center">
                <Camera size={28} />
                <span className="text-sm mt-1">Change Photo</span>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold">{user.first_name} {user.last_name}</h1>
            <p className="text-xl text-orange-100 mt-2">{user.job_title || 'Team Member'}</p>
            <p className="text-orange-100 mt-4 flex items-center justify-center md:justify-start gap-3">
              <Briefcase size={22} /> Employee ID: <span className="font-medium">{user.employee_id || 'Not assigned'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Employment */}
        <div className="bg-white rounded-3xl shadow p-8">
          <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3">
            <Briefcase className="text-custom-orange" /> Employment
          </h2>
          <div className="space-y-8">
            <div><p className="text-sm text-gray-500">Type</p><p className="text-2xl font-semibold">{user.employment_type || 'Full-time'}</p></div>
            <div><p className="text-sm text-gray-500">Status</p><p className="text-2xl font-semibold text-green-600">Active</p></div>
            <div><p className="text-sm text-gray-500">Start Date</p><p className="text-2xl font-semibold">{user.start_date ? new Date(user.start_date).toLocaleDateString('en-ZA') : 'Not set'}</p></div>
            <div><p className="text-sm text-gray-500">Tenure</p><p className="text-2xl font-semibold">1 year</p></div>
          </div>
        </div>

        {/* Organization */}
        <div className="bg-white rounded-3xl shadow p-8">
          <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3">
            <User className="text-custom-orange" /> Organization
          </h2>
          <div className="space-y-8">
            <div><p className="text-sm text-gray-500">Department</p><p className="text-2xl font-semibold">{user.department || 'Not assigned'}</p></div>
            <div><p className="text-sm text-gray-500">Team</p><p className="text-2xl font-semibold">{user.team || 'Not assigned'}</p></div>
            <div>
              <p className="text-sm text-gray-500">Manager</p>
              <p className="text-2xl font-semibold">{user.manager_name || 'Not assigned'}</p>
            </div>
            <div><p className="text-sm text-gray-500">Job Title</p><p className="text-2xl font-semibold">{user.job_title || 'Not set'}</p></div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-3xl shadow p-8">
          <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3">
            <Mail className="text-custom-orange" /> Contact
          </h2>
          <div className="space-y-8">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Mail className="text-orange-600" size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Work Email</p>
                <p className="text-xl font-semibold break-all">{user.email || 'Not set'}</p>
              </div>
            </div>
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Phone className="text-orange-600" size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Work Phone</p>
                <p className="text-xl font-semibold">{user.phone || 'Not set'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Button */}
      <div className="flex justify-center mt-12">
        <button
          onClick={openEditModal}
          className="flex items-center gap-3 bg-custom-orange hover:bg-orange-600 text-white px-12 py-5 rounded-2xl font-semibold text-lg shadow-lg transition-all active:scale-95"
        >
          <Edit2 size={24} />
          Edit Profile
        </button>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 border-b px-8 py-6 flex justify-between items-center">
              <h2 className="text-3xl font-bold">Edit Profile</h2>
              <button onClick={closeEditModal}><X size={32} /></button>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input name="first_name" value={editForm.first_name || ''} onChange={handleEditChange} className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-custom-orange" />
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input name="last_name" value={editForm.last_name || ''} onChange={handleEditChange} className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-custom-orange" />
                </div>
              </div>

              <div><label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input name="email" type="email" value={editForm.email || ''} onChange={handleEditChange} className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-custom-orange" />
              </div>

              <div><label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input name="phone" value={editForm.phone || ''} onChange={handleEditChange} className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-custom-orange" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                  <input name="job_title" value={editForm.job_title || ''} onChange={handleEditChange} className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-custom-orange" />
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <input name="department" value={editForm.department || ''} onChange={handleEditChange} className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-custom-orange" />
                </div>
              </div>

              <div><label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
                <input name="team" value={editForm.team || ''} onChange={handleEditChange} className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-custom-orange" />
              </div>

              <div><label className="block text-sm font-medium text-gray-700 mb-2">Employment Type</label>
                <select name="employment_type" value={editForm.employment_type || ''} onChange={handleEditChange} className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-custom-orange">
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>

              {/* Disabled Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Manager (Cannot change)</label>
                  <input value={user.manager_name || 'Not assigned'} disabled className="w-full px-5 py-4 border border-gray-200 rounded-2xl bg-gray-100 text-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date (Cannot change)</label>
                  <input value={user.start_date ? new Date(user.start_date).toLocaleDateString('en-ZA') : 'Not set'} disabled className="w-full px-5 py-4 border border-gray-200 rounded-2xl bg-gray-100 text-gray-500" />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-8 py-6 flex justify-end gap-4">
              <button onClick={closeEditModal} className="px-10 py-4 bg-gray-200 text-gray-800 rounded-2xl font-medium hover:bg-gray-300">Cancel</button>
              <button onClick={saveProfile} disabled={saving} className={`px-10 py-4 text-white font-medium rounded-2xl transition ${saving ? 'bg-gray-400' : 'bg-custom-orange hover:bg-orange-600'}`}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;