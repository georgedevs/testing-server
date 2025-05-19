// Set WAT (West Africa Time, UTC+1) as the default timezone for Nigeria
process.env.TZ = 'Africa/Lagos';

import http from 'http';
import { app } from './app';
import connectDB from './utils/db';
import { initSocketEvents, initSocketServer } from './socketServer';
import { initSessionCleanup } from './utils/sessionCleanup';

const getCurrentTimeInfo = () => {
  const now = new Date();
  return {
    localTime: now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
    isoTime: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: now.getTimezoneOffset(),
    systemTZ: process.env.TZ
  };
};

// Create HTTP server
const server = http.createServer(app);

// Initialize socket server
const io = initSocketServer(server);

// Initialize socket events
const socketEvents = initSocketEvents(io);

app.set('socketEvents', socketEvents);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    const timeInfo = getCurrentTimeInfo();
    console.log(`Server is connected with port ${PORT}`);
    console.log(`Server time info:`, timeInfo);
    connectDB();

    initSessionCleanup();
    console.log('Starting cleanup job')
});