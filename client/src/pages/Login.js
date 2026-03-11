// client/src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios'; // ← this uses REACT_APP_API_URL automatically

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

      // Success
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role_id', res.data.user.role_id);
      localStorage.setItem('username', username);

      // Optional: store more user info
      // localStorage.setItem('user', JSON.stringify(res.data.user));

      navigate('/dashboard');
    } catch (err) {
      // Improved error messages
      if (err.response) {
        // Backend responded with error (e.g. 401, 400)
        setError(err.response.data?.error || 'Login failed. Please check your credentials.');
      } else if (err.request) {
        // No response received (network issue, CORS, server down)
        setError('Network error. Please check your internet or try again later.');
      } else {
        // Something else (code error)
        setError('An unexpected error occurred. Please try again.');
      }
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">Jimmac Timesheet</h1>

        {error && (
          <p className="text-red-500 text-center mb-6 bg-red-50 p-3 rounded">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-custom-orange"
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-custom-orange"
            required
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 text-white rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-custom-orange hover:bg-orange-600'
            }`}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;