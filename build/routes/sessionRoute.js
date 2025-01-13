"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const sessionController_1 = require("../controllers/sessionController");
const sessionRouter = express_1.default.Router();
sessionRouter.post('/sessions', auth_1.isAuthenticated, sessionController_1.createSession);
sessionRouter.post('/sessions/:sessionId/start', auth_1.isAuthenticated, sessionController_1.startSession);
sessionRouter.post('/sessions/:sessionId/end', auth_1.isAuthenticated, sessionController_1.endSession);
sessionRouter.post('/sessions/:sessionId/feedback', auth_1.isAuthenticated, sessionController_1.submitSessionFeedback);
exports.default = sessionRouter;
