import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronDown } from 'lucide-react';
import api from '../api/axios';

const TimesheetModal = ({ isOpen, onClose, timesheet, onSave }) => {
  if (!isOpen || !timesheet) return null;

  const [editedTimesheet, setEditedTimesheet] = useState(timesheet);
  const [clientNames, setClientNames] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);

  const { date, hours, status, attachment_path, user_name } = editedTimesheet;
  const color = status === 'approved' ? 'green' : 'orange';

  // Fetch unique client names (same logic as form)
  useEffect(() => {
    const fetchClientNames = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('${`${process.env.REACT_APP_API_URL}`}/timesheets', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data || [];
        const uniqueClients = new Set();
        data.forEach(ts => {
          (ts.tasks || []).forEach(t => {
            if (t.clientProjectName?.trim()) {
              uniqueClients.add(t.clientProjectName.trim());
            }
          });
        });
        setClientNames([...uniqueClients].sort());
      } catch (err) {
        console.error('Failed to load client names', err);
      } finally {
        setLoadingClients(false);
      }
    };

    if (isOpen) fetchClientNames();
  }, [isOpen]);

  const handleChange = (field, value) => {
    setEditedTimesheet(prev => ({ ...prev, [field]: value }));
  };

  const toggleClientDropdown = () => {
    setShowClientDropdown(prev => !prev);
  };

  const selectClient = (clientName) => {
    handleChange('clientProjectName', clientName);
    setShowClientDropdown(false);
  };

  const handleSave = () => {
    if (onSave) onSave(editedTimesheet);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Timesheet</h2>

          {/* User (read-only) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Submitted by</label>
            <p className="text-lg text-gray-800 font-medium">{user_name || 'Unknown'}</p>
          </div>

          {/* Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date || ''}
              onChange={e => handleChange('date', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
            />
          </div>

          {/* Client / Project Name - Combo Box */}
          <div className="mb-6 relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client / Project Name *
            </label>
            <div className="flex items-center border border-gray-300 rounded-xl focus-within:ring-custom-orange focus-within:border-custom-orange">
              <input
                type="text"
                value={editedTimesheet.clientProjectName || ''}
                onChange={e => handleChange('clientProjectName', e.target.value)}
                onFocus={() => setShowClientDropdown(true)}
                placeholder="Type or select existing..."
                className="flex-1 px-5 py-4 rounded-l-xl outline-none"
                required
              />
              <button
                type="button"
                onClick={toggleClientDropdown}
                className="px-4 py-4 bg-gray-100 hover:bg-gray-200 rounded-r-xl"
              >
                <ChevronDown size={20} />
              </button>
            </div>

            {/* Dropdown */}
            {showClientDropdown && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {loadingClients ? (
                  <div className="p-4 text-center text-gray-500">Loading clients...</div>
                ) : clientNames.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No previous clients found</div>
                ) : (
                  clientNames.map((client, idx) => (
                    <div
                      key={idx}
                      className="px-5 py-3 hover:bg-gray-100 cursor-pointer text-gray-800"
                      onClick={() => selectClient(client)}
                    >
                      {client}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Hours */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Hours Spent</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={hours || ''}
              onChange={e => handleChange('hours', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
            />
          </div>

          {/* Status (read-only) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
            <p className="text-lg font-medium" style={{ color }}>
              {status?.toUpperCase() || 'Pending'}
            </p>
          </div>

          {/* Attachment */}
          {attachment_path && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Attachment</label>
              <a
                href={`${`${process.env.REACT_APP_API_URL}`}/${attachment_path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-custom-orange hover:underline font-medium"
              >
                Download Current File
              </a>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-4 mt-10 pt-6 border-t">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-3 bg-custom-orange text-white rounded-xl hover:bg-orange-600 transition font-medium shadow-md"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimesheetModal;