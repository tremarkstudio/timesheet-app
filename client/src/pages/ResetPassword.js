import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-6">Invalid or Missing Reset Link</h1>
          <p className="mb-6">The password reset link is invalid or has expired.</p>
          <Link
            to="/forgot-password"
            className="text-custom-orange hover:underline font-medium"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const res = await api.post('/reset-password', { token, newPassword });
      setMessage(res.data.message || 'Password reset successful! You can now log in.');
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to reset password. Please try again.';
      setMessage(errMsg);
      console.error('Reset error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Set New Password</h1>

        {message && (
          <div className={`mb-6 p-4 rounded-xl text-center ${message.includes('successful') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-orange outline-none transition"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium transition flex items-center justify-center gap-2 ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-custom-orange hover:bg-orange-600 shadow-md'
            }`}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <Link to="/login" className="text-custom-orange hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;