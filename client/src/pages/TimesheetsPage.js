// client/src/pages/TimesheetsPage.js
import React, { useState } from 'react';
import TimesheetForm from '../components/TimesheetForm';
import api from '../api/axios';
import TimesheetTable from '../components/TimesheetTable';
import { Plus, Eye } from 'lucide-react';   // ← added this import

const TimesheetsPage = () => {
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'previous'

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Timesheets
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Submit new entries or review your previous submissions
            </p>
          </div>
        </div>

        {/* Main Card with Tabs */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('new')}
                className={`flex-1 py-5 px-6 text-center font-medium text-lg transition-all duration-200 ${
                  activeTab === 'new'
                    ? 'border-b-4 border-custom-orange text-custom-orange bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <Plus size={20} />
                  New Timesheet
                </span>
              </button>

              <button
                onClick={() => setActiveTab('previous')}
                className={`flex-1 py-5 px-6 text-center font-medium text-lg transition-all duration-200 ${
                  activeTab === 'previous'
                    ? 'border-b-4 border-custom-orange text-custom-orange bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <Eye size={20} />
                  Previous Timesheets
                </span>
              </button>
            </nav>
          </div>

          {/* Tab Content Area */}
          <div className="p-6 md:p-10 min-h-[60vh]">
            {activeTab === 'new' ? (
              <div className="transition-opacity duration-300 ease-in-out opacity-100">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  Submit New Timesheet
                </h2>
                <TimesheetForm />
              </div>
            ) : (
              <div className="transition-opacity duration-300 ease-in-out opacity-100">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  Your Previous Timesheets
                </h2>
                <TimesheetTable />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimesheetsPage;