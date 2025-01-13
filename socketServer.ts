// src/socketServer.ts
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

export const initSocketServer = (server: http.Server) => {
    const io = new SocketIOServer(server, {
        cors: {
            origin: ["https://testing-george.vercel.app"],
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

// Define event types for type safety
type UserRole = 'client' | 'counselor' | 'admin';
type UpdateType = 'booking' | 'counselor' | 'time' | 'meeting' | 'admin';

interface SocketUser {
    userId: string;
    role: UserRole;
}

export const initSocketEvents = (io: SocketIOServer) => {
    const userSockets = new Map<string, Set<string>>();

    const addUserSocket = (userId: string, socketId: string) => {
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId)?.add(socketId);
    };

    const removeUserSocket = (userId: string, socketId: string) => {
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
        socket.on("authenticate", (user: SocketUser) => {
            console.log('User authenticated:', user);
            
            // Add user to their personal room
            socket.join(`user_${user.userId}`);
            addUserSocket(user.userId, socket.id);

            // Add to role-specific rooms
            if (user.role === 'counselor') {
                socket.join(`counselor_${user.userId}`);
                socket.join('counselors');
            } else if (user.role === 'admin') {
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

    const notifyUser = (userId: string, event: string, data: any = {}) => {
        io.to(`user_${userId}`).emit(event, data);
    };

    const notifyCounselor = (counselorId: string, event: string, data: any = {}) => {
        io.to(`counselor_${counselorId}`).emit(event, data);
    };

    const notifyAdmin = (event: string, data: any = {}) => {
        io.to('admin').emit(event, data);
    };

    return {
        emitBookingUpdated: (userId: string, data: any = {}) => {
            notifyUser(userId, 'booking_updated', data);
            notifyAdmin('admin_update', { type: 'booking', userId });
        },

        emitCounselorAssigned: (userId: string, counselorId: string, data: any = {}) => {
            notifyUser(userId, 'counselor_assigned', data);
            notifyCounselor(counselorId, 'new_assignment', data);
            notifyAdmin('admin_update', { type: 'assignment', userId, counselorId });
        },

        emitTimeSelected: (userId: string, counselorId: string, data: any = {}) => {
            notifyUser(userId, 'time_selected', data);
            notifyCounselor(counselorId, 'time_selected', data);
            notifyAdmin('admin_update', { type: 'time_selected', userId, counselorId });
        },

        emitMeetingConfirmed: (userId: string, counselorId: string, data: any = {}) => {
            notifyUser(userId, 'meeting_confirmed', data);
            notifyCounselor(counselorId, 'meeting_confirmed', data);
            notifyAdmin('admin_update', { type: 'confirmation', userId, counselorId });
        },

        emitMeetingCancelled: (userId: string, counselorId: string, data: any = {}) => {
            notifyUser(userId, 'meeting_cancelled', data);
            notifyCounselor(counselorId, 'meeting_cancelled', data);
            notifyAdmin('admin_update', { type: 'cancellation', userId, counselorId });
        },

        emitAdminUpdate: (data: any = {}) => {
            notifyAdmin('admin_update', data);
        },

        // Broadcast to all connected clients
        broadcast: (event: string, data: any = {}) => {
            io.emit(event, data);
        }
    };
};