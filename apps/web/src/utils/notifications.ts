import { api } from './api';

let notificationPermission: NotificationPermission = 'default';
let checkInterval: number | null = null;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    notificationPermission = 'granted';
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
    return permission === 'granted';
  }

  return false;
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (notificationPermission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      icon: '/bee-icon.png',
      badge: '/bee-icon.png',
      ...options
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

export async function checkMaintenanceReminders() {
  try {
    const res = await api.get('/maintenance/upcoming?days=1');
    const upcoming = res.data.upcoming || [];

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    for (const maintenance of upcoming) {
      const dueDate = maintenance.next_due_date;
      
      // Show notification for items due today or tomorrow
      if (dueDate === today || dueDate === tomorrowStr) {
        const title = 'Maintenance Due';
        const body = `${maintenance.name}${maintenance.hive_label ? ` for ${maintenance.hive_label}` : ''} is due ${dueDate === today ? 'today' : 'tomorrow'}`;
        
        showNotification(title, {
          body,
          tag: `maintenance-${maintenance.id}`, // Prevent duplicate notifications
          requireInteraction: dueDate === today // Require interaction if due today
        });
      }
    }
  } catch (error) {
    console.error('Error checking maintenance reminders:', error);
  }
}

export function scheduleMaintenanceReminders() {
  // Check immediately
  checkMaintenanceReminders();

  // Then check every hour
  if (checkInterval !== null) {
    clearInterval(checkInterval);
  }

  checkInterval = window.setInterval(() => {
    checkMaintenanceReminders();
  }, 60 * 60 * 1000); // 1 hour
}

export function stopMaintenanceReminders() {
  if (checkInterval !== null) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// Initialize permission on module load
if (typeof window !== 'undefined' && 'Notification' in window) {
  notificationPermission = Notification.permission;
}
