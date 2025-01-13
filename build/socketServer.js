"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketEvents = exports.initSocketServer = void 0;
// src/socketServer.ts
const socket_io_1 = require("socket.io");
const initSocketServer = (server) => {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.ORIGIN || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        }
    });
    io.on("connection", (socket) => {
        console.log('Client connected:', socket.id);
        socket.on("disconnect", () => {
            console.log('Client disconnected:', socket.id);
        });
        socket.on('booking_updated', (data) => {
            console.log('Booking updated:', data);
        });
    });
    return io;
};
exports.initSocketServer = initSocketServer;
const initSocketEvents = (io) => {
    const userSockets = new Map();
    const addUserSocket = (userId, socketId) => {
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId)?.add(socketId);
    };
    const removeUserSocket = (userId, socketId) => {
        const userSocketSet = userSockets.get(userId);
        if (userSocketSet) {
            userSocketSet.delete(socketId);
            if (userSocketSet.size === 0) {
                userSockets.delete(userId);
            }
        }
    };
    io.on("connection", (socket) => {
        console.log('Client connected:', socket.id);
        // Handle user authentication and room joining
        socket.on("authenticate", (user) => {
            console.log('User authenticated:', user);
            // Add user to their personal room
            socket.join(`user_${user.userId}`);
            addUserSocket(user.userId, socket.id);
            // Add to role-specific rooms
            if (user.role === 'counselor') {
                socket.join(`counselor_${user.userId}`);
                socket.join('counselors');
            }
            else if (user.role === 'admin') {
                socket.join('admin');
            }
        });
        socket.on("disconnect", () => {
            console.log('Client disconnected:', socket.id);
            // Clean up socket mappings
            userSockets.forEach((sockets, userId) => {
                if (sockets.has(socket.id)) {
                    removeUserSocket(userId, socket.id);
                }
            });
        });
    });
    const notifyUser = (userId, event, data = {}) => {
        io.to(`user_${userId}`).emit(event, data);
    };
    const notifyCounselor = (counselorId, event, data = {}) => {
        io.to(`counselor_${counselorId}`).emit(event, data);
    };
    const notifyAdmin = (event, data = {}) => {
        io.to('admin').emit(event, data);
    };
    return {
        emitBookingUpdated: (userId, data = {}) => {
            notifyUser(userId, 'booking_updated', data);
            notifyAdmin('admin_update', { type: 'booking', userId });
        },
        emitCounselorAssigned: (userId, counselorId, data = {}) => {
            notifyUser(userId, 'counselor_assigned', data);
            notifyCounselor(counselorId, 'new_assignment', data);
            notifyAdmin('admin_update', { type: 'assignment', userId, counselorId });
        },
        emitTimeSelected: (userId, counselorId, data = {}) => {
            notifyUser(userId, 'time_selected', data);
            notifyCounselor(counselorId, 'time_selected', data);
            notifyAdmin('admin_update', { type: 'time_selected', userId, counselorId });
        },
        emitMeetingConfirmed: (userId, counselorId, data = {}) => {
            notifyUser(userId, 'meeting_confirmed', data);
            notifyCounselor(counselorId, 'meeting_confirmed', data);
            notifyAdmin('admin_update', { type: 'confirmation', userId, counselorId });
        },
        emitMeetingCancelled: (userId, counselorId, data = {}) => {
            notifyUser(userId, 'meeting_cancelled', data);
            notifyCounselor(counselorId, 'meeting_cancelled', data);
            notifyAdmin('admin_update', { type: 'cancellation', userId, counselorId });
        },
        emitAdminUpdate: (data = {}) => {
            notifyAdmin('admin_update', data);
        },
        // Broadcast to all connected clients
        broadcast: (event, data = {}) => {
            io.emit(event, data);
        }
    };
};
exports.initSocketEvents = initSocketEvents;
