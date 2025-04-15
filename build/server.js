"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Set WAT (West Africa Time, UTC+1) as the default timezone for Nigeria
process.env.TZ = 'Africa/Lagos';
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const db_1 = __importDefault(require("./utils/db"));
const socketServer_1 = require("./socketServer");
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
const server = http_1.default.createServer(app_1.app);
// Initialize socket server
const io = (0, socketServer_1.initSocketServer)(server);
// Initialize socket events
const socketEvents = (0, socketServer_1.initSocketEvents)(io);
app_1.app.set('socketEvents', socketEvents);
// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    const timeInfo = getCurrentTimeInfo();
    console.log(`Server is connected with port ${PORT}`);
    console.log(`Server time info:`, timeInfo);
    (0, db_1.default)();
});
