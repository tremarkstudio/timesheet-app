// client/src/pages/Messages.js
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Send, Bell, MessageSquare, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import api from '../api/axios';

const Messages = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('messages');
  const [notifications, setNotifications] = useState([]);
  const [employees, setEmployees] = useState([]);       // admins only
  const [manager, setManager] = useState(null);         // employees only
  const [selectedUserId, setSelectedUserId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null); // for auto-scroll

  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdmin = [1, 2].includes(roleId);
  const currentUserId = parseInt(localStorage.getItem('user_id')) || null;

  useEffect(() => {
    fetchNotifications();

    if (isAdmin) {
      fetchEmployees();
    } else {
      fetchOwnManager();
    }
  }, [isAdmin]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');
      const res = await axios.get('http://localhost:5000/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Notifications fetch failed:', err);
      setError('Failed to load notifications');
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmployees(res.data.filter(u => u.role_id === 3) || []);
    } catch (err) {
      console.error('Employees fetch failed:', err);
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchOwnManager = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const userRes = await axios.get('http://localhost:5000/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const managerId = userRes.data.manager_id;

      if (managerId) {
        const managerRes = await axios.get(`http://localhost:5000/users/${managerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setManager(managerRes.data);
        setSelectedUserId(managerId);
      } else {
        setError('No team contact (manager) assigned yet — contact admin');
      }
    } catch (err) {
      console.error('Manager fetch failed:', err);
      setError('Failed to load your team contact');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = async (userId) => {
    setSelectedUserId(userId);
    setChatMessages([]);
    if (!userId) return;

    setChatLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/messages/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChatMessages(res.data || []);
    } catch (err) {
      console.error('Chat history load failed:', err);
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedUserId) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/messages', {
        content: messageText.trim(),
        recipientId: selectedUserId,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newMsg = {
        id: Date.now(),
        sender_id: currentUserId,
        content: messageText.trim(),
        created_at: new Date().toISOString(),
        sender_name: 'You',
      };
      setChatMessages(prev => [...prev, newMsg]);
      setMessageText('');
    } catch (err) {
      console.error('Message send failed:', err);
      setError('Failed to send message');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-custom-orange"></div>
          Loading messages...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">Messages & Notifications</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex-1 py-5 px-6 text-center font-medium text-lg transition-all ${
                activeTab === 'messages'
                  ? 'border-b-4 border-custom-orange text-custom-orange bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="inline mr-2" size={20} />
              Messages
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 py-5 px-6 text-center font-medium text-lg transition-all ${
                activeTab === 'notifications'
                  ? 'border-b-4 border-custom-orange text-custom-orange bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Bell className="inline mr-2" size={20} />
              Notifications
            </button>
          </nav>
        </div>

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Selection Panel */}
              <div className="lg:col-span-1 bg-gray-50 p-6 rounded-xl border">
                <h3 className="text-lg font-semibold mb-4">Team Contact</h3>

                {isAdmin ? (
                  // Admins select from employees
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {employees.length === 0 ? (
                      <div className="text-gray-500 p-4">No employees found</div>
                    ) : (
                      employees.map(u => (
                        <button
                          key={u.id}
                          onClick={() => handleUserSelect(u.id)}
                          className={`w-full p-4 text-left border rounded-lg transition hover:shadow-md ${
                            selectedUserId === u.id ? 'bg-custom-orange text-white hover:bg-orange-600' : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          {u.first_name} {u.last_name} ({u.username})
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  // Employees: fixed Team Contact (manager)
                  manager ? (
                    <button
                      onClick={() => handleUserSelect(manager.id)}
                      className={`w-full p-4 text-left border rounded-lg transition hover:shadow-md ${
                        selectedUserId === manager.id ? 'bg-custom-orange text-white hover:bg-orange-600' : 'bg-white hover:bg-gray-100'
                      }`}
                    >
                      Team Contact: {manager.first_name} {manager.last_name} ({manager.username})
                    </button>
                  ) : (
                    <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                      No team contact (manager) assigned yet — contact admin
                    </div>
                  )
                )}
              </div>

              {/* Chat Area */}
              <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm flex flex-col h-[600px]">
                {!selectedUserId ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-center px-4">
                    {isAdmin
                      ? 'Select a team member to start messaging'
                      : manager
                      ? 'Click "Team Contact" above to view conversation'
                      : 'No team contact assigned - cannot send messages'}
                  </div>
                ) : (
                  <>
                    <div className="p-4 border-b bg-gray-50">
                      <h3 className="font-semibold">
                        Conversation with {isAdmin
                          ? employees.find(u => u.id === selectedUserId)?.first_name
                          : manager?.first_name} {isAdmin
                          ? employees.find(u => u.id === selectedUserId)?.last_name
                          : manager?.last_name}
                      </h3>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto space-y-4 pb-4">
                      {chatLoading ? (
                        <div className="text-center py-10">Loading messages...</div>
                      ) : chatMessages.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                          No messages yet. {isAdmin ? 'Start the conversation below.' : 'Wait for a message from your team contact.'}
                        </div>
                      ) : (
                        chatMessages.map(msg => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className="flex flex-col max-w-[70%]">
                              {msg.sender_id !== currentUserId && (
                                <span className="text-xs text-gray-500 mb-1 ml-2">
                                  {msg.sender_name || 'Them'}
                                </span>
                              )}
                              <div
                                className={`p-3 rounded-2xl ${
                                  msg.sender_id === currentUserId
                                    ? 'bg-custom-orange text-white rounded-tr-none'
                                    : 'bg-gray-100 text-gray-900 rounded-tl-none'
                                }`}
                              >
                                <p className="break-words">{msg.content}</p>
                              </div>
                              <span className="text-xs text-gray-400 mt-1 self-end">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 border-t bg-white">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={messageText}
                          onChange={e => setMessageText(e.target.value)}
                          placeholder="Type your message..."
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-custom-orange focus:border-custom-orange"
                          onKeyPress={e => e.key === 'Enter' && sendMessage()}
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!messageText.trim()}
                          className={`px-6 py-3 rounded-lg text-white font-medium transition ${
                            messageText.trim() ? 'bg-custom-orange hover:bg-orange-600' : 'bg-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <Send size={20} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-semibold mb-6">
              {isAdmin ? 'All Timesheet Activity' : 'Your Timesheet Updates'}
            </h2>

            {notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No notifications yet
              </div>
            ) : (
              <div className="space-y-4">
                {notifications
                  .filter(n => n.related_timesheet_id)
                  .map(notif => (
                    <div
                      key={notif.id}
                      className={`p-6 rounded-xl border shadow-sm ${
                        !notif.is_read ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          {notif.title.includes('Approved') ? (
                            <CheckCircle className="text-green-600" size={24} />
                          ) : notif.title.includes('Rejected') ? (
                            <XCircle className="text-red-600" size={24} />
                          ) : (
                            <Clock className="text-yellow-600" size={24} />
                          )}
                          <h3 className="text-lg font-semibold">{notif.title}</h3>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(notif.created_at).toLocaleString('en-ZA', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      <p className="text-gray-700 whitespace-pre-line mb-4">{notif.message}</p>

                      {notif.related_timesheet_id && (
                        <button
                          onClick={() => navigate(`/timesheets?tab=previous&timesheet=${notif.related_timesheet_id}`)}
                          className="text-custom-orange hover:underline font-medium"
                        >
                          View Timesheet →
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;