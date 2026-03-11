// client/src/components/TimesheetCalendar.js
import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import axios from 'axios';
import { Eye } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../api/axios';
import '../components/Dashboard.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
});

// Consistent color per user ID (same across sessions)
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).slice(-2);
  }
  return color;
};

const TimesheetCalendar = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  const isAdmin = [1, 2].includes(roleId);
  const currentUserId = parseInt(localStorage.getItem('user_id')) || null;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    api
      .get('${`${process.env.REACT_APP_API_URL}`}/timesheets', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const tsData = res.data || [];

        // For employees: only their own timesheets
        const relevantTs = isAdmin ? tsData : tsData.filter(ts => ts.user_id === currentUserId);

        const formattedEvents = relevantTs.flatMap((entry) => {
          return (entry.tasks || []).map((task) => ({
            id: `${entry.id}-${task.id || Math.random()}`,
            title: `${task.clientProjectName ? task.clientProjectName + ' - ' : ''}${task.description || 'Task'} (${Number(task.hours || 0).toFixed(1)}h)`,
            start: new Date(entry.date),
            end: new Date(entry.date),
            allDay: true,
            resource: {
              ...task,
              date: entry.date,
              status: entry.status,
              approvedBy: entry.approved_by,
              userName: entry.user_name || 'Unknown',
              userId: entry.user_id,
              entryId: entry.id,
            },
          }));
        });

        setEvents(formattedEvents);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load timesheets for calendar:', err);
        setLoading(false);
      });
  }, [isAdmin, currentUserId]);

  const eventStyleGetter = (event) => {
    if (isAdmin) {
      // Unique color per employee
      const userId = event.resource?.userId;
      const color = userId ? stringToColor(userId.toString()) : '#EB7638';
      return {
        style: {
          backgroundColor: color,
          borderRadius: '8px',
          opacity: 0.9,
          color: 'white',
          border: '0px',
          fontWeight: '600',
        },
      };
    }
    // Employee: consistent orange
    return {
      style: {
        backgroundColor: '#EB7638',
        borderRadius: '8px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        fontWeight: '600',
      },
    };
  };

  const dayPropGetter = (date) => {
    const today = new Date();
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return {
        style: {
          backgroundColor: '#FEF3C7',
          border: '2px solid #F59E0B',
        },
      };
    }
    return {};
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event.resource);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const goToReview = () => {
    closeModal();
    // Navigate to timesheets and force "Previous" tab
    window.location.href = '/timesheets?tab=previous';
  };

  if (loading) return <div className="text-center py-10">Loading calendar...</div>;

  return (
    <div className="my-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 text-right">Timesheet Calendar</h2>
      <div className="bg-white p-4 rounded-xl shadow-sm border" style={{ height: 650 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          views={['month', 'week', 'day', 'agenda']}
          defaultView="month"
          popup
          eventPropGetter={eventStyleGetter}
          dayPropGetter={dayPropGetter}
          onSelectEvent={handleSelectEvent}
          messages={{
            next: "→",
            previous: "←",
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day",
            agenda: "Year",
          }}
        />
      </div>

      {/* Task Detail Modal */}
      {isModalOpen && selectedEvent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Task Details
              </h2>

              <div className="space-y-5 text-gray-800">
                {!isAdmin && (
                  <div>
                    <span className="font-semibold">Submitted by:</span> You
                  </div>
                )}
                {isAdmin && (
                  <div>
                    <span className="font-semibold">Employee:</span>{' '}
                    {selectedEvent.userName || 'Unknown'}
                  </div>
                )}
                <div>
                  <span className="font-semibold">Date:</span>{' '}
                  {new Date(selectedEvent.date).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-semibold">Client/Project:</span>{' '}
                  {selectedEvent.clientProjectName || '—'}
                </div>
                <div>
                  <span className="font-semibold">Task Type:</span>{' '}
                  {selectedEvent.projectType || selectedEvent.type || '—'}
                </div>
                <div>
                  <span className="font-semibold">Project/Opportunity No.:</span>{' '}
                  {selectedEvent.projectNumber || '—'}
                </div>
                <div>
                  <span className="font-semibold">Description:</span>{' '}
                  {selectedEvent.description || selectedEvent.title || '—'}
                </div>
                <div>
                  <span className="font-semibold">Hours:</span>{' '}
                  <span className="text-custom-orange font-bold">
                    {Number(selectedEvent.hours || 0).toFixed(2)} hrs
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Status:</span>{' '}
                  <span style={{ color: selectedEvent.status === 'approved' ? 'green' : 'orange' }}>
                    {selectedEvent.status?.toUpperCase() || 'Pending'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 mt-10 pt-6 border-t">
                <button
                  onClick={closeModal}
                  className="px-8 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition font-medium"
                >
                  Close
                </button>
                <button
                  onClick={goToReview}
                  className="px-8 py-3 bg-custom-orange text-white rounded-xl hover:bg-orange-600 transition font-medium shadow-md flex items-center gap-2"
                >
                  <Eye size={20} />
                  Review in Timesheets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimesheetCalendar;