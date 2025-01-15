process.env.TZ = 'Europe/Paris';  // Set timezone first

import http from 'http';
import { app } from './app';
import connectDB from './utils/db';
import { initSocketEvents, initSocketServer } from './socketServer';

const getCurrentUTC1Time = () => {
    return new Date().toLocaleString('en-US', {
        timeZone: 'Europe/Paris'
    });
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
    console.log(`Server is connected with port ${PORT} at ${getCurrentUTC1Time()}`);
    connectDB();
});