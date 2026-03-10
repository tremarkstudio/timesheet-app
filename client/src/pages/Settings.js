// client/src/pages/Settings.js
import React, { useState, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';
import api from '../api/axios';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('app');

  const tabs = [
    { id: 'app', label: 'App Settings' },
    { id: 'timesheet', label: 'Timesheet Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Settings</h1>
          <p className="mt-3 text-lg text-gray-600">
            Manage application appearance, behavior and timesheet rules
          </p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg
                  ${activeTab === tab.id
                    ? 'border-custom-orange text-custom-orange'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 md:p-10">
          {activeTab === 'app' && <AppSettings />}
          {activeTab === 'timesheet' && <TimesheetSettings />}
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────
   App Settings Tab
───────────────────────────────────────────────── */
const AppSettings = () => {
  const [formValues, setFormValues] = useState(() => {
    const saved = localStorage.getItem('appSettings');
    return saved
      ? JSON.parse(saved)
      : {
          primaryColor: '#f97316',
          logoUrl: '/logo-w.png',
          appFont: 'Inter',
          darkMode: false,
          companyName: 'Jimmac Projects',
        };
  });

  // Auto-save to localStorage whenever formValues changes
  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(formValues));
  }, [formValues]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    alert('App settings saved successfully!');
    // The useEffect already persisted it
  };

  return (
    <form onSubmit={handleSave} className="space-y-12">
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">General</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company / App Name
            </label>
            <input
              type="text"
              name="companyName"
              value={formValues.companyName}
              onChange={handleChange}
              className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo URL / Path
            </label>
            <input
              type="text"
              name="logoUrl"
              value={formValues.logoUrl}
              onChange={handleChange}
              className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Appearance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Color
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                name="primaryColor"
                value={formValues.primaryColor}
                onChange={handleChange}
                className="w-16 h-16 rounded-lg border border-gray-300 cursor-pointer"
              />
              <span className="text-lg font-medium text-gray-700">
                {formValues.primaryColor}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Font
            </label>
            <select
              name="appFont"
              value={formValues.appFont}
              onChange={handleChange}
              className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
            >
              <option value="Inter">Inter (default)</option>
              <option value="Roboto">Roboto</option>
              <option value="Poppins">Poppins</option>
              <option value="Open Sans">Open Sans</option>
            </select>
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="darkMode"
                checked={formValues.darkMode}
                onChange={handleChange}
                className="w-6 h-6 text-custom-orange border-gray-300 rounded focus:ring-custom-orange"
              />
              <span className="text-lg font-medium text-gray-700">
                Enable Dark Mode by default
              </span>
            </label>
          </div>
        </div>
      </section>

      <div className="pt-8 border-t">
        <button
          type="submit"
          className="px-10 py-4 bg-custom-orange text-white rounded-xl hover:bg-orange-600 transition font-medium text-lg shadow-md"
        >
          Save App Settings
        </button>
      </div>
    </form>
  );
};

/* ────────────────────────────────────────────────
   Timesheet Settings Tab
───────────────────────────────────────────────── */
const TimesheetSettings = () => {
  const [hourlyRate, setHourlyRate] = useState(() => {
    return localStorage.getItem('hourlyRate') || '150.00';
  });

  const [customFields, setCustomFields] = useState(() => {
    const saved = localStorage.getItem('customTimesheetFields');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Project Code', type: 'text', required: true },
      { id: 2, name: 'Task Category', type: 'select', required: false },
      { id: 3, name: 'Travel Distance (km)', type: 'number', required: false },
    ];
  });

  const [newField, setNewField] = useState({ name: '', type: 'text', required: false });

  // Auto-save hourly rate
  useEffect(() => {
    localStorage.setItem('hourlyRate', hourlyRate);
  }, [hourlyRate]);

  // Auto-save custom fields
  useEffect(() => {
    localStorage.setItem('customTimesheetFields', JSON.stringify(customFields));
  }, [customFields]);

  const handleAddField = () => {
    if (!newField.name.trim()) return alert('Field name is required');
    setCustomFields([
      ...customFields,
      { id: Date.now(), ...newField },
    ]);
    setNewField({ name: '', type: 'text', required: false });
  };

  const handleRemoveField = (id) => {
    if (!window.confirm('Remove this field?')) return;
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  const handleSaveTimesheet = (e) => {
    e.preventDefault();
    alert('Timesheet settings saved successfully!');
    // Already auto-saved via useEffect
  };

  return (
    <form onSubmit={handleSaveTimesheet} className="space-y-12">
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Rate Settings</h2>
        <div className="max-w-md">
          <label className="block text-lg font-medium text-gray-700 mb-3">
            Default Hourly Rate (ZAR)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <span className="text-gray-500 text-xl">R</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={hourlyRate}
              onChange={e => setHourlyRate(e.target.value)}
              className="w-full pl-12 pr-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange text-xl font-medium"
              required
            />
          </div>
          <p className="mt-3 text-sm text-gray-500">
            This rate will be used when calculating total earnings unless overridden per user.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Custom Timesheet Fields</h2>

        <div className="space-y-5 mb-10">
          {customFields.length === 0 ? (
            <p className="text-gray-500 italic">No custom fields added yet</p>
          ) : (
            customFields.map(field => (
              <div
                key={field.id}
                className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-200"
              >
                <div>
                  <div className="font-medium text-lg">{field.name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Type: <strong>{field.type}</strong> • {field.required ? 'Required' : 'Optional'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveField(field.id)}
                  className="text-red-600 hover:text-red-800 p-2"
                >
                  <Trash2 size={24} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="bg-gray-50 p-8 rounded-2xl border border-gray-200">
          <h3 className="text-xl font-semibold mb-6">Add New Custom Field</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                Field Name
              </label>
              <input
                type="text"
                value={newField.name}
                onChange={e => setNewField({ ...newField, name: e.target.value })}
                placeholder="e.g. Client Name"
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
              />
            </div>

            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                Field Type
              </label>
              <select
                value={newField.type}
                onChange={e => setNewField({ ...newField, type: e.target.value })}
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:ring-custom-orange focus:border-custom-orange"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Dropdown</option>
                <option value="date">Date</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newField.required}
                  onChange={e => setNewField({ ...newField, required: e.target.checked })}
                  className="w-6 h-6 text-custom-orange border-gray-300 rounded focus:ring-custom-orange"
                />
                <span className="text-lg font-medium text-gray-700">Required field</span>
              </label>
            </div>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={handleAddField}
              className="px-8 py-4 bg-custom-orange text-white rounded-xl hover:bg-orange-600 transition font-medium text-lg shadow-md flex items-center gap-3"
            >
              <Plus size={22} /> Add Field
            </button>
          </div>
        </div>
      </section>

      <div className="pt-10 border-t">
        <button
          type="submit"
          className="px-12 py-5 bg-custom-orange text-white rounded-xl hover:bg-orange-600 transition font-medium text-xl shadow-lg"
        >
          Save Timesheet Settings
        </button>
      </div>
    </form>
  );
};

export default Settings;