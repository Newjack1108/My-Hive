import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { requestNotificationPermission, scheduleMaintenanceReminders } from './utils/notifications';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed, continue without it
    });
  });
}

// Initialize notifications
window.addEventListener('load', async () => {
  const hasPermission = await requestNotificationPermission();
  if (hasPermission) {
    scheduleMaintenanceReminders();
  }
});
