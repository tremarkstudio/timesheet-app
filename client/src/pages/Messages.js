// client/src/pages/Messages.js
import React, { useEffect, useState, useRef } from 'react';
import { Send, Bell, MessageSquare, CheckCircle, XCircle, Clock, AlertTriangle, Paperclip, FileText, Upload ,X,} from 'lucide-react';
import api from '../api/axios';

const Messages = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const [notifications, setNotifications] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [manager, setManager] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdmin = [1, 2].includes(roleId);
  const currentUserId = parseInt(localStorage.getItem('user_id')) || null;

  useEffect(() => {
    fetchNotifications();
    if (isAdmin) fetchEmployees();
    else fetchOwnManager();
  }, [isAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Notifications fetch failed:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/users');
      setEmployees(res.data.filter(u => u.role_id === 3) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOwnManager = async () => {
    try {
      const userRes = await api.get('/users/me');
      const managerId = userRes.data.manager_id;

      if (managerId) {
        const managerRes = await api.get(`/users/${managerId}`);
        setManager(managerRes.data);
        setSelectedUserId(managerId);
      }
    } catch (err) {
      console.error(err);
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
      const res = await api.get(`/messages/user/${userId}`);
      setChatMessages(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    setAttachment(file);
    setAttachmentPreview({
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'file'
    });
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachmentPreview(null);
    fileInputRef.current.value = '';
  };

  const sendMessage = async () => {
    if (!messageText.trim() && !attachment) return;
    if (!selectedUserId) return;

    const formData = new FormData();
    formData.append('content', messageText.trim());
    formData.append('recipientId', selectedUserId);
    if (attachment) {
      formData.append('attachment', attachment);
    }

    try {
      await api.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Add message to UI immediately
      const newMsg = {
        id: Date.now(),
        sender_id: currentUserId,
        content: messageText.trim(),
        attachment_name: attachment ? attachment.name : null,
        created_at: new Date().toISOString(),
        sender_name: 'You',
      };

      setChatMessages(prev => [...prev, newMsg]);
      setMessageText('');
      setAttachment(null);
      setAttachmentPreview(null);
    } catch (err) {
      console.error('Message send failed:', err);
      alert('Failed to send message');
    }
  };

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
            <button onClick={() => setActiveTab('messages')} className={`flex-1 py-5 px-6 text-center font-medium text-lg transition-all ${activeTab === 'messages' ? 'border-b-4 border-custom-orange text-custom-orange' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
              Messages
            </button>
            <button onClick={() => setActiveTab('notifications')} className={`flex-1 py-5 px-6 text-center font-medium text-lg transition-all ${activeTab === 'notifications' ? 'border-b-4 border-custom-orange text-custom-orange' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
              Notifications
            </button>
          </nav>
        </div>

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User Selection */}
              <div className="lg:col-span-1 bg-gray-50 p-6 rounded-xl border">
                <h3 className="text-lg font-semibold mb-4">Team Contact</h3>
                {isAdmin ? (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {employees.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleUserSelect(u.id)}
                        className={`w-full p-4 text-left border rounded-lg transition hover:shadow-md ${selectedUserId === u.id ? 'bg-custom-orange text-white' : 'bg-white hover:bg-gray-50'}`}
                      >
                        {u.first_name} {u.last_name}
                      </button>
                    ))}
                  </div>
                ) : manager ? (
                  <button onClick={() => handleUserSelect(manager.id)} className={`w-full p-4 text-left border rounded-lg transition hover:shadow-md ${selectedUserId === manager.id ? 'bg-custom-orange text-white' : 'bg-white'}`}>
                    Team Contact: {manager.first_name} {manager.last_name}
                  </button>
                ) : (
                  <div className="p-4 bg-red-50 text-red-700 rounded-lg">No manager assigned</div>
                )}
              </div>

              {/* Chat Area */}
              <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm flex flex-col h-[620px]">
                {!selectedUserId ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500">Select a contact to start messaging</div>
                ) : (
                  <>
                    <div className="p-4 border-b bg-gray-50 font-semibold">
                      Conversation with {isAdmin ? employees.find(u => u.id === selectedUserId)?.first_name : manager?.first_name}
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {chatMessages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] p-4 rounded-2xl ${msg.sender_id === currentUserId ? 'bg-custom-orange text-white' : 'bg-gray-100'}`}>
                            <p>{msg.content}</p>
                            {msg.attachment_name && (
                              <div className="mt-2 text-xs opacity-75 flex items-center gap-1">
                                <Paperclip size={14} /> {msg.attachment_name}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input with Attachment */}
                    <div className="p-4 border-t">
                      {attachmentPreview && (
                        <div className="mb-3 p-3 bg-gray-100 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText size={20} />
                            <span className="text-sm">{attachmentPreview.name}</span>
                          </div>
                          <button onClick={removeAttachment} className="text-red-600 hover:text-red-800">
                            <X size={18} />
                          </button>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={messageText}
                          onChange={e => setMessageText(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && sendMessage()}
                          placeholder="Type a message..."
                          className="flex-1 px-5 py-4 border border-gray-300 rounded-2xl focus:ring-custom-orange focus:border-custom-orange"
                        />

                        <button
                          type="button"
                          onClick={() => fileInputRef.current.click()}
                          className="px-5 py-4 bg-gray-100 hover:bg-gray-200 rounded-2xl transition"
                        >
                          <Paperclip size={22} />
                        </button>

                        <button
                          onClick={sendMessage}
                          disabled={!messageText.trim() && !attachment}
                          className={`px-8 py-4 rounded-2xl text-white font-medium transition ${(!messageText.trim() && !attachment) ? 'bg-gray-400' : 'bg-custom-orange hover:bg-orange-600'}`}
                        >
                          <Send size={22} />
                        </button>
                      </div>

                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab - unchanged */}
        {activeTab === 'notifications' && (
          <div className="p-6 md:p-8">
            {/* Your existing notifications code */}
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;