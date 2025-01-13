"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSessionReminders = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const sessionModel_1 = require("../models/sessionModel");
const sendMail_1 = __importDefault(require("../utils/sendMail"));
const setupSessionReminders = () => {
    // Run every 5 minutes
    node_cron_1.default.schedule('*/5 * * * *', async () => {
        try {
            // Find sessions starting in the next hour that haven't sent reminders
            const upcomingSessions = await sessionModel_1.Session.find({
                status: 'scheduled',
                startTime: {
                    $gt: new Date(),
                    $lte: new Date(Date.now() + 60 * 60 * 1000) // Next hour
                }
            }).populate('clientId counselorId');
            for (const session of upcomingSessions) {
                // Send email to client
                const client = session.clientId;
                await (0, sendMail_1.default)({
                    email: client.email,
                    subject: 'Upcoming Session Reminder',
                    template: 'sessionReminder.ejs',
                    data: {
                        startTime: session.startTime,
                        type: 'client'
                    }
                });
                // Send email to counselor
                const counselor = session.counselorId;
                await (0, sendMail_1.default)({
                    email: counselor.email,
                    subject: 'Upcoming Session Reminder',
                    template: 'sessionReminder.ejs',
                    data: {
                        startTime: session.startTime,
                        type: 'counselor'
                    }
                });
            }
        }
        catch (error) {
            console.error('Error sending session reminders:', error);
        }
    });
};
exports.setupSessionReminders = setupSessionReminders;
