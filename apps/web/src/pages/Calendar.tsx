import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import './Calendar.css';

interface CalendarEvent {
  id: string;
  type: string;
  date: string;
  title: string;
  description?: string;
  hive_id?: string;
  hive_label?: string;
  entity_id?: string;
  color?: string;
}

// Format date as YYYY-MM-DD using local date (avoids timezone bugs with toISOString)
const formatDateLocal = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Normalize event date to YYYY-MM-DD - API may return "2025-02-25" or "2025-02-25T00:00:00.000Z"
const normalizeEventDate = (date: string | Date | undefined): string => {
  if (!date) return '';
  if (typeof date === 'string') {
    return date.length >= 10 ? date.slice(0, 10) : date;
  }
  return formatDateLocal(new Date(date));
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [eventTypes, setEventTypes] = useState<string[]>([]);

  useEffect(() => {
    loadEvents();
  }, [currentDate, viewMode, eventTypes, selectedDate]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const startDate = getStartDate();
      const endDate = getEndDate();

      const params: any = {
        start_date: formatDateLocal(startDate),
        end_date: formatDateLocal(endDate)
      };

      if (eventTypes.length > 0) {
        params.types = eventTypes;
      }

      const res = await api.get('/calendar/events', { params });
      const eventList = res.data?.events ?? res.data ?? [];
      setEvents(Array.isArray(eventList) ? eventList : []);
    } catch (error: any) {
      console.error('Failed to load calendar events:', error);
      setLoadError(error.response?.data?.error || error.message || 'Failed to load calendar');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = (): Date => {
    const baseDate = viewMode === 'day' ? (selectedDate || currentDate) : currentDate;
    const date = new Date(baseDate);
    if (viewMode === 'month') {
      date.setDate(1);
      date.setDate(date.getDate() - date.getDay()); // Start of week
    } else if (viewMode === 'week') {
      const day = date.getDay();
      date.setDate(date.getDate() - day);
    }
    return date;
  };

  const getEndDate = (): Date => {
    const baseDate = viewMode === 'day' ? (selectedDate || currentDate) : currentDate;
    const date = new Date(baseDate);
    if (viewMode === 'month') {
      date.setMonth(date.getMonth() + 1);
      date.setDate(0);
      const lastDay = date.getDate();
      const lastDayOfWeek = date.getDay();
      date.setDate(lastDay + (6 - lastDayOfWeek)); // End of week
    } else if (viewMode === 'week') {
      date.setDate(date.getDate() + (6 - date.getDay()));
    }
    return date;
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = formatDateLocal(date);
    return events.filter(e => normalizeEventDate(e.date) === dateStr);
  };

  const renderMonthView = () => {
    const startDate = getStartDate();
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    return (
      <div className="calendar-month">
        <div className="calendar-header">
          <button onClick={() => navigateMonth(-1)} className="btn-nav">‹</button>
          <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button onClick={() => navigateMonth(1)} className="btn-nav">›</button>
        </div>
        <div className="calendar-weekdays">
          {weekDays.map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
        </div>
        <div className="calendar-days">
          {days.map((date, idx) => {
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isToday = date.toDateString() === new Date().toDateString();
            const dayEvents = getEventsForDate(date);
            
            return (
              <div
                key={idx}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => {
                  setSelectedDate(date);
                  setViewMode('day');
                }}
              >
                <div className="calendar-day-number">{date.getDate()}</div>
                <div className="calendar-day-events">
                  {dayEvents.slice(0, 3).map((event, eventIdx) => (
                    <div
                      key={eventIdx}
                      className="calendar-event-dot"
                      style={{ backgroundColor: event.color || '#3b82f6' }}
                      title={event.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                      }}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="calendar-event-more">+{dayEvents.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = getStartDate();
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }

    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    return (
      <div className="calendar-week">
        <div className="calendar-header">
          <button onClick={() => navigateWeek(-1)} className="btn-nav">‹</button>
          <h2>
            {monthNames[days[0].getMonth()]} {days[0].getDate()} - {monthNames[days[6].getMonth()]} {days[6].getDate()}, {days[0].getFullYear()}
          </h2>
          <button onClick={() => navigateWeek(1)} className="btn-nav">›</button>
        </div>
        <div className="calendar-week-grid">
          {days.map((date, idx) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const dayEvents = getEventsForDate(date);
            
            return (
              <div key={idx} className={`calendar-week-day ${isToday ? 'today' : ''}`}>
                <div className="calendar-week-day-header">
                  <div className="calendar-week-day-name">{weekDays[idx]}</div>
                  <div className="calendar-week-day-number">{date.getDate()}</div>
                </div>
                <div className="calendar-week-day-events">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="calendar-week-event"
                      style={{ borderLeftColor: event.color || '#3b82f6' }}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="calendar-week-event-title">{event.title}</div>
                      {event.hive_label && (
                        <div className="calendar-week-event-hive">{event.hive_label}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const date = selectedDate || currentDate;
    const dayEvents = getEventsForDate(date);
    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    return (
      <div className="calendar-day-view">
        <div className="calendar-header">
          <button onClick={() => navigateDay(-1)} className="btn-nav">‹</button>
          <h2>
            {weekDays[date.getDay()]}, {monthNames[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
          </h2>
          <button onClick={() => navigateDay(1)} className="btn-nav">›</button>
        </div>
        <div className="calendar-day-events-list">
          {dayEvents.length === 0 ? (
            <p className="empty-state">No events on this day</p>
          ) : (
            dayEvents.map((event) => (
              <div
                key={event.id}
                className="calendar-day-event"
                style={{ borderLeftColor: event.color || '#3b82f6' }}
                onClick={() => setSelectedEvent(event)}
              >
                <div className="calendar-day-event-time">{event.type}</div>
                <div className="calendar-day-event-title">{event.title}</div>
                {event.hive_label && (
                  <div className="calendar-day-event-hive">{event.hive_label}</div>
                )}
                {event.description && (
                  <div className="calendar-day-event-description">{event.description}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const getEventTypeLabel = (type: string): string => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'inspection' && event.entity_id) {
      if (event.hive_id) {
        window.location.href = `/hives/${event.hive_id}`;
      }
    } else if (event.type === 'task' && event.entity_id) {
      window.location.href = `/maintenance`;
    } else if ((event.type === 'maintenance_due' || event.type === 'maintenance_completed') && event.entity_id) {
      window.location.href = `/maintenance`;
    } else if (event.type === 'split' && event.entity_id) {
      window.location.href = `/splits`;
    } else if (event.type === 'harvest' && event.entity_id) {
      window.location.href = `/honey`;
    } else if (event.type === 'seasonal_event' && event.entity_id) {
      window.location.href = `/seasonal-events`;
    }
  };

  if (loading) {
    return <div className="calendar-loading">Loading calendar...</div>;
  }

  return (
    <div className="calendar-page">
      {loadError && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {loadError}
        </div>
      )}
      <div className="page-header">
        <img src="/calendar-icon.png" alt="" className="page-icon" />
        <h2>Calendar</h2>
        <div className="page-actions">
          <button onClick={() => setCurrentDate(new Date())} className="btn-secondary">
            Today
          </button>
        </div>
      </div>

      <div className="calendar-controls">
        <div className="calendar-view-toggle">
          <button
            className={viewMode === 'month' ? 'active' : ''}
            onClick={() => setViewMode('month')}
          >
            Month
          </button>
          <button
            className={viewMode === 'week' ? 'active' : ''}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
          <button
            className={viewMode === 'day' ? 'active' : ''}
            onClick={() => {
              setViewMode('day');
              setSelectedDate(currentDate);
            }}
          >
            Day
          </button>
        </div>

        <div className="calendar-filters">
          <label>
            <input
              type="checkbox"
              checked={eventTypes.includes('inspection')}
              onChange={(e) => {
                if (e.target.checked) {
                  setEventTypes([...eventTypes, 'inspection']);
                } else {
                  setEventTypes(eventTypes.filter(t => t !== 'inspection'));
                }
              }}
            />
            Inspections
          </label>
          <label>
            <input
              type="checkbox"
              checked={eventTypes.includes('task')}
              onChange={(e) => {
                if (e.target.checked) {
                  setEventTypes([...eventTypes, 'task']);
                } else {
                  setEventTypes(eventTypes.filter(t => t !== 'task'));
                }
              }}
            />
            Tasks
          </label>
          <label>
            <input
              type="checkbox"
              checked={eventTypes.includes('split')}
              onChange={(e) => {
                if (e.target.checked) {
                  setEventTypes([...eventTypes, 'split']);
                } else {
                  setEventTypes(eventTypes.filter(t => t !== 'split'));
                }
              }}
            />
            Splits
          </label>
          <label>
            <input
              type="checkbox"
              checked={eventTypes.includes('harvest')}
              onChange={(e) => {
                if (e.target.checked) {
                  setEventTypes([...eventTypes, 'harvest']);
                } else {
                  setEventTypes(eventTypes.filter(t => t !== 'harvest'));
                }
              }}
            />
            Harvests
          </label>
          <label>
            <input
              type="checkbox"
              checked={eventTypes.includes('maintenance_due') || eventTypes.includes('maintenance_completed')}
              onChange={(e) => {
                if (e.target.checked) {
                  setEventTypes([...eventTypes.filter(t => t !== 'maintenance_due' && t !== 'maintenance_completed'), 'maintenance_due', 'maintenance_completed']);
                } else {
                  setEventTypes(eventTypes.filter(t => t !== 'maintenance_due' && t !== 'maintenance_completed'));
                }
              }}
            />
            Maintenance
          </label>
          <label>
            <input
              type="checkbox"
              checked={eventTypes.includes('seasonal_event')}
              onChange={(e) => {
                if (e.target.checked) {
                  setEventTypes([...eventTypes, 'seasonal_event']);
                } else {
                  setEventTypes(eventTypes.filter(t => t !== 'seasonal_event'));
                }
              }}
            />
            Seasonal Events
          </label>
        </div>
      </div>

      <div className="calendar-content">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
      </div>

      {!loadError && events.length === 0 && (
        <p className="empty-state" style={{ marginTop: '1rem', color: 'var(--gray-600)' }}>
          No events in this period. Add inspections, maintenance schedules, or seasonal events to see them here.
        </p>
      )}

      {selectedEvent && (
        <div className="calendar-event-modal" onClick={() => setSelectedEvent(null)}>
          <div className="calendar-event-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedEvent.title}</h3>
            <div className="calendar-event-modal-info">
              <p><strong>Type:</strong> {getEventTypeLabel(selectedEvent.type)}</p>
              <p><strong>Date:</strong> {new Date(selectedEvent.date).toLocaleDateString()}</p>
              {selectedEvent.hive_label && (
                <p><strong>Hive:</strong> {selectedEvent.hive_label}</p>
              )}
              {selectedEvent.description && (
                <p><strong>Description:</strong> {selectedEvent.description}</p>
              )}
            </div>
            <div className="calendar-event-modal-actions">
              <button
                onClick={() => {
                  handleEventClick(selectedEvent);
                  setSelectedEvent(null);
                }}
                className="btn-primary"
              >
                View Details
              </button>
              <button onClick={() => setSelectedEvent(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
