// src/components/Layout.js
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import axios from 'axios';
import { 
  Home, Clock, Calendar, Users, MessageSquare, CalendarCheck, Settings, LogOut, Menu, X, Bell, User
} from 'lucide-react';

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef(null);
  const bellRef = useRef(null);

  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdmin = [1, 2].includes(roleId);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <Home size={20} /> },
    { path: '/timesheets', label: 'Timesheets', icon: <Clock size={20} /> },
    { path: '/calendar', label: 'Calendar', icon: <Calendar size={20} /> },
    { path: '/profile', label: 'Profile', icon: <User size={20} /> },
    { path: '/messages', label: 'Messages', icon: <MessageSquare size={20} /> },
    { path: '/leave', label: 'Leave', icon: <CalendarCheck size={20} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={20} />, adminOnly: true },
    { path: '/users', label: 'Users', icon: <Users size={20} />, adminOnly: true },
    { path: '/Reporting', label: 'Reports', icon: <Users size={20} />, adminOnly: true },
  ];

  useEffect(() => {
    const fetchUserAndNotifications = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const userRes = await axios.get('http://localhost:5000/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(userRes.data);

        const notifRes = await axios.get('http://localhost:5000/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const notifs = notifRes.data || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.is_read).length);
      } catch (err) {
        console.error('Header data fetch failed:', err);
      }
    };

    fetchUserAndNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const avatarUrl = user?.avatar_url ? `http://localhost:5000/${user.avatar_url}` : null;
  const initials = (user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase();

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* HEADER */}
      <header className="bg-gray-800 text-white p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <img src="/logo-w.png" alt="Logo" className="h-10" />
        </div>

        <div className="flex items-center gap-6">
          {/* Notification Bell */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-white hover:text-custom-orange transition-colors relative"
            >
              <Bell size={24} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Modal */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[80vh] overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                  <button onClick={() => setShowNotifications(false)}>
                    <X size={20} className="text-gray-500 hover:text-gray-700" />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        className={`p-4 border-b hover:bg-gray-50 transition ${
                          !notif.is_read ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-gray-900">{notif.title}</h4>
                          <span className="text-xs text-gray-500">
                            {new Date(notif.created_at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-700 whitespace-pre-line">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-3 focus:outline-none"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover border-2 border-custom-orange"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-custom-orange flex items-center justify-center text-white font-bold text-lg border-2 border-custom-orange">
                  {initials}
                </div>
              )}
              <span className="hidden md:block font-medium text-white">
                {user?.first_name || user?.username || 'User'}
              </span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-2">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/profile');
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3 text-gray-800"
                >
                  <User size={18} />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/messages');
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3 text-gray-800 relative"
                >
                  <Bell size={18} />
                  Notifications
                  {unreadCount > 0 && (
                    <span className="absolute right-4 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <hr className="my-2 border-gray-200" />
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 transition flex items-center gap-3"
                >
                  <LogOut size={18} />
                  Log out
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-white hover:text-custom-orange focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside
          className={`bg-gradient-to-b from-gray-100 to-gray-200 text-gray-800 w-64 flex-shrink-0 flex flex-col min-h-screen fixed md:relative z-50 transition-transform duration-300 ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="md:hidden p-4 flex justify-between items-center border-b border-gray-300">
            <h2 className="text-lg font-bold">Management App</h2>
            <button onClick={() => setIsMobileMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <h2 className="text-xl font-bold p-6 text-center hidden md:block">Management App</h2>
            <nav className="px-4 pb-6">
              <ul className="space-y-2">
                {navItems.map((item) => {
                  if (item.adminOnly && !isAdmin) return null;
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                          isActive
                            ? 'bg-custom-orange text-white shadow-md'
                            : 'hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {item.icon}
                        <span className="hidden md:inline">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <div className="p-4 border-t border-gray-300">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-custom-orange hover:bg-orange-600 text-white transition-colors"
            >
              <LogOut size={20} />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* MAIN CONTENT AREA – this is where pages render */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet /> {/* ← All pages (Dashboard, Profile, Messages, etc.) render HERE */}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;