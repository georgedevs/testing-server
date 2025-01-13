"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const avatarController_1 = require("../controllers/avatarController");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const avatarRouter = express_1.default.Router();
avatarRouter.get('/avatars', avatarController_1.getAvailableAvatars);
avatarRouter.post('/update-avatar', auth_1.isAuthenticated, userController_1.updateAvatar);
exports.default = avatarRouter;
