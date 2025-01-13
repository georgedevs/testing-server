import http from 'http';
import { app } from './app';
import connectDB from './utils/db';
import { initSocketEvents, initSocketServer } from './socketServer';

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
    console.log(`Server is connected with port ${PORT}`);
    connectDB();
});