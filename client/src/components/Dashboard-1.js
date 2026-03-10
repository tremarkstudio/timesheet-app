// client/src/pages/Dashboard.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import api from '../api/axios';
import { Link, useLocation } from 'react-router-dom';
import { Home, Clock, Calendar, Users, Menu, X, Edit, Trash2, Plus, LogOut } from 'lucide-react';
import TimesheetForm from '../components/TimesheetForm';
import TimesheetTable from '../components/TimesheetTable';
import TimesheetCalendar from '../components/TimesheetCalendar';
import '../components/Dashboard.css';
import React from 'react';
import TimesheetForm from '../components/TimesheetForm';
import TimesheetTable from '../components/TimesheetTable';
import TimesheetCalendar from '../components/TimesheetCalendar';
import Layout from './Layout';

const Dashboard = () => {
  return (
    <Layout title="Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Your cards here */}
      </div>
      <div className="space-y-8">
        <TimesheetForm />
        <TimesheetTable />
        <TimesheetCalendar />
      </div>
    </Layout>
  );
};

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    axios.get(`${${process.env.REACT_APP_API_URL}}/dashboard-data`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setData(res.data || { totalProduction: 0, timeValue: 0, funds: 0 });
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="dashboard min-h-screen">
      {/* HEADER */}
      <header className="bg-gray-800 text-white p-4 flex items-center">
        <img src="/logo-w.png" alt="Jimmac Logo" className="h-10" />
      </header>

      <div className="flex flex-1">
        {/* SIDEBAR - YOUR FAVORITE MOBILE + 220px DESKTOP */}
        <div className={`sidebar bg-gradient-to-b from-gray-100 to-gray-200 text-gray-800 w-56 flex flex-col h-screen fixed top-0 left-0 z-50 md:relative md:w-[220px] transition-all duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          
          {/* Mobile Menu Button */}
          <div className="md:hidden p-4 flex justify-between items-center border-b border-gray-300">
            <h2 className="text-lg font-bold">Timesheet App</h2>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-700">
              <X size={24} />
            </button>
          </div>

          {/* Nav Content */}
          <div className="flex-1 overflow-y-auto">
            <h2 className="text-xl font-bold p-6 text-center hidden md:block">Timesheet App</h2>
            <nav className="px-4 pb-4">
              <ul className="space-y-1">
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
                            : 'hover:bg-gray-300 text-gray-700'
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

          {/* Logout */}
          <div className="p-4 border-t border-gray-300">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-custom-orange hover:bg-custom-orange/90 transition-all text-white font-medium"
            >
              <LogOut size={20} />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Menu Toggle Button */}
        <div className="md:hidden fixed top-4 right-4 z-50">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 bg-gray-800 text-white rounded-lg shadow-lg"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* MAIN CONTENT */}
        <div className="main-content flex-1">
          <div className="top-bar">Welcome, {localStorage.getItem('username') || 'User'}</div>
          <div className="cards">
            <div className="card">Total Production: {data.totalProduction}</div>
            <div className="card">Time Value: {data.timeValue || 0}</div>
            <div className="card">Funds: {data.funds || 0}</div>
          </div>
          <TimesheetForm />
          <TimesheetTable />
          <TimesheetCalendar />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;