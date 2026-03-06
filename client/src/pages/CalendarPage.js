// client/src/pages/CalendarPage.js
import React from 'react';
import TimesheetCalendar from '../components/TimesheetCalendar';

const CalendarPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Page Header / Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Calendar
          </h1>
          <p className="text-lg text-gray-600">
            View your timesheet entries and planned work
          </p>
        </div>

        {/* Calendar Component */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          <div className="p-6 md:p-10">
            <TimesheetCalendar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;