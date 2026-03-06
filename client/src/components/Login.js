import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/login', { username, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', response.data.user.username);
      localStorage.setItem('role_id', response.data.user.role_id);
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/forgot-password', { email });
      alert('Reset email sent!');
      setShowForgot(false);
      setEmail('');
    } catch (error) {
      alert('Error sending reset email');
      console.error('Forgot password error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="wave"></div>
      </div>
      <div className="relative z-10 bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-xl w-full max-w-md transform transition-all duration-300 hover:shadow-2xl">
        <img src="jimmac-logo.png" alt="jimmac-logo" className="mx-auto mb-6 h-16" />
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-8 tracking-tight">Management App</h1>
        {showForgot ? (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 placeholder-gray-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-custom-orange text-white rounded-lg hover:bg-custom-orange/90 focus:bg-custom-orange/80 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
            >
              Send Reset Link
            </button>
            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="w-full py-3 text-blue-600 text-sm hover:underline"
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 placeholder-gray-500"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 placeholder-gray-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-custom-orange text-white rounded-lg hover:bg-custom-orange/90 focus:bg-custom-orange/80 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="w-full py-3 text-blue-600 text-sm hover:underline"
            >
              Forgot Password?
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;