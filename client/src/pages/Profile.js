// src/pages/Profile.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    // For demo – later replace with real /users/me call
    setUser({
      username: localStorage.getItem('username') || 'User',
      roleId: localStorage.getItem('role_id') || 'Unknown',
    });
  }, [navigate]);

  if (!user) {
    return <div className="p-10 text-center text-lg">Loading profile...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>

      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <h2 className="text-xl font-semibold mb-5 text-gray-800">Personal Information</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Username</label>
                <p className="text-lg font-medium">{user.username}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Role</label>
                <p className="text-lg font-medium">
                  {user.roleId === '1' ? 'Super Admin' :
                   user.roleId === '2' ? 'Admin' :
                   user.roleId === '3' ? 'Employee' : 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-5 text-gray-800">Account Actions</h2>
            <div className="space-y-4">
              <button className="w-full py-3 px-4 bg-custom-orange text-white rounded-lg hover:bg-orange-600 transition">
                Change Password
              </button>
              <button className="w-full py-3 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
                Update Profile Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}