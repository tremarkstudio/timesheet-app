// client/src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { Loader2 } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/login', { username, password });

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role_id', res.data.user.role_id);
      localStorage.setItem('username', username);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.png" // ← Replace with your actual logo path (e.g. public/logo.png)
            alt="Jimmac Timesheet Logo"
            className="h-16 w-auto mb-3 object-contain"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/150x60?text=Jimmac'; // fallback
            }}
          />
          <h1 className="text-3xl font-bold text-gray-900">Jimmac Timesheet</h1>
          <p className="text-sm text-gray-500 mt-1">Employee Time & Leave Management</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-orange focus:border-custom-orange outline-none transition"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-orange focus:border-custom-orange outline-none transition"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-all flex items-center justify-center gap-2 ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-custom-orange hover:bg-orange-600 shadow-md hover:shadow-lg'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        {/* Forgot Password Link */}
        <div className="mt-6 text-center">
          <Link
            to="/forgot-password" // ← Change this to your actual forgot password route
            className="text-custom-orange hover:text-orange-700 font-medium text-sm transition"
          >
            Forgot your password?
          </Link>
        </div>

        {/* Optional: Register link if you want it */}
        {/* <div className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-custom-orange hover:underline">
            Register here
          </Link>
        </div> */}
      </div>
    </div>
  );
};

export default Login;