import { useState, useEffect } from 'react';
import './GraftingSessionCard.css';

interface GraftingSession {
  id: string;
  name: string;
  grafting_date: string;
  method: 'standard' | 'starter_finisher' | 'cell_builder';
  status: 'active' | 'completed' | 'cancelled';
  checklist_completed: Record<string, boolean>;
  queen_name?: string;
  hive_label?: string;
  notes?: string;
}

interface Milestone {
  key: string;
  label: string;
  dayRange: [number, number];
  methodSpecific?: 'starter_finisher';
}

const milestones: Milestone[] = [
  { key: 'grafting', label: 'Grafting', dayRange: [0, 0] },
  { key: 'check_acceptance', label: 'Check Acceptance', dayRange: [1, 2] },
  { key: 'transfer_finisher', label: 'Transfer to Finisher', dayRange: [3, 4], methodSpecific: 'starter_finisher' },
  { key: 'cells_capped', label: 'Queen Cells Capped', dayRange: [5, 6] },
  { key: 'queen_emerged', label: 'Queen Emerged', dayRange: [10, 12] },
  { key: 'mating_flight', label: 'Mating Flight Window', dayRange: [16, 28] },
  { key: 'check_laying', label: 'Check for Laying', dayRange: [28, 35] },
];

interface GraftingSessionCardProps {
  session: GraftingSession;
  onToggleChecklist: (sessionId: string, milestoneKey: string, completed: boolean) => void;
  onUpdateStatus: (sessionId: string, status: 'active' | 'completed' | 'cancelled') => void;
  onDelete: (sessionId: string) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export default function GraftingSessionCard({
  session,
  onToggleChecklist,
  onUpdateStatus,
  onDelete,
  expanded = false,
  onToggleExpand,
}: GraftingSessionCardProps) {
  const [daysElapsed, setDaysElapsed] = useState(0);

  useEffect(() => {
    const calculateDays = () => {
      const graftingDate = new Date(session.grafting_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      graftingDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - graftingDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      setDaysElapsed(diffDays);
    };

    calculateDays();
    const interval = setInterval(calculateDays, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [session.grafting_date]);

  const getRelevantMilestones = () => {
    return milestones.filter(m => 
      !m.methodSpecific || m.methodSpecific === session.method
    );
  };

  const getNextMilestone = () => {
    const relevant = getRelevantMilestones();
    for (const milestone of relevant) {
      const [minDay, maxDay] = milestone.dayRange;
      if (daysElapsed < maxDay && !session.checklist_completed[milestone.key]) {
        return { milestone, daysUntil: Math.max(0, minDay - daysElapsed) };
      }
    }
    return null;
  };

  const getCurrentMilestone = () => {
    const relevant = getRelevantMilestones();
    for (const milestone of relevant) {
      const [minDay, maxDay] = milestone.dayRange;
      if (daysElapsed >= minDay && daysElapsed <= maxDay) {
        return milestone;
      }
    }
    return null;
  };

  const getProgress = () => {
    const relevant = getRelevantMilestones();
    const completed = relevant.filter(m => session.checklist_completed[m.key]).length;
    return Math.round((completed / relevant.length) * 100);
  };

  const nextMilestone = getNextMilestone();
  const currentMilestone = getCurrentMilestone();
  const progress = getProgress();

  const methodLabels: Record<string, string> = {
    standard: 'Standard',
    starter_finisher: 'Starter/Finisher',
    cell_builder: 'Cell Builder',
  };

  return (
    <div className={`grafting-session-card ${session.status}`}>
      <div className="grafting-session-header" onClick={onToggleExpand}>
        <div className="grafting-session-title">
          <h3>{session.name}</h3>
          <span className={`status-badge status-${session.status}`}>{session.status}</span>
        </div>
        <div className="grafting-session-meta">
          {session.queen_name && <span>Queen: {session.queen_name}</span>}
          {session.hive_label && <span>Hive: {session.hive_label}</span>}
          <span>Method: {methodLabels[session.method]}</span>
          <span>Grafted: {new Date(session.grafting_date).toLocaleDateString()}</span>
        </div>
        <div className="grafting-session-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <span>{progress}% Complete</span>
        </div>
        {nextMilestone && (
          <div className="countdown-display">
            <span className="countdown-label">Next: {nextMilestone.milestone.label}</span>
            <span className="countdown-value">
              {nextMilestone.daysUntil === 0 ? 'Due Now' : `${nextMilestone.daysUntil} day${nextMilestone.daysUntil !== 1 ? 's' : ''} remaining`}
            </span>
          </div>
        )}
        {currentMilestone && !nextMilestone && (
          <div className="current-milestone">
            Current: {currentMilestone.label} (Day {daysElapsed})
          </div>
        )}
      </div>

      {expanded && (
        <div className="grafting-session-details">
          <div className="grafting-timeline">
            <h4>Timeline</h4>
            <div className="timeline-items">
              {getRelevantMilestones().map((milestone) => {
                const [minDay, maxDay] = milestone.dayRange;
                const isCompleted = session.checklist_completed[milestone.key] || false;
                const isPast = daysElapsed > maxDay;
                const isCurrent = daysElapsed >= minDay && daysElapsed <= maxDay;
                const daysUntil = Math.max(0, minDay - daysElapsed);

                return (
                  <div
                    key={milestone.key}
                    className={`timeline-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isPast && !isCompleted ? 'overdue' : ''}`}
                  >
                    <div className="timeline-checkbox">
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={(e) => onToggleChecklist(session.id, milestone.key, e.target.checked)}
                        disabled={session.status !== 'active'}
                      />
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-label">{milestone.label}</div>
                      <div className="timeline-days">
                        Day {minDay === maxDay ? minDay : `${minDay}-${maxDay}`}
                        {isCurrent && !isCompleted && (
                          <span className="timeline-status"> - Due Now</span>
                        )}
                        {!isCurrent && !isCompleted && daysUntil > 0 && (
                          <span className="timeline-status"> - {daysUntil} day{daysUntil !== 1 ? 's' : ''} remaining</span>
                        )}
                        {isPast && !isCompleted && (
                          <span className="timeline-status overdue"> - Overdue</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {session.notes && (
            <div className="grafting-notes">
              <h4>Notes</h4>
              <p>{session.notes}</p>
            </div>
          )}

          <div className="grafting-session-actions">
            {session.status === 'active' && (
              <>
                <button
                  className="btn-secondary"
                  onClick={() => onUpdateStatus(session.id, 'completed')}
                >
                  Mark Complete
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => onUpdateStatus(session.id, 'cancelled')}
                >
                  Cancel
                </button>
              </>
            )}
            <button
              className="btn-danger"
              onClick={() => {
                if (confirm('Are you sure you want to delete this grafting session?')) {
                  onDelete(session.id);
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
