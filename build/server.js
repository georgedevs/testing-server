"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const db_1 = __importDefault(require("./utils/db"));
const socketServer_1 = require("./socketServer");
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
    console.log(`Server is connected with port ${PORT}`);
    (0, db_1.default)();
});
