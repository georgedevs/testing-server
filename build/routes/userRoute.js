"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const deviceCheck_1 = require("../middleware/deviceCheck");
const userRouter = express_1.default.Router();
userRouter.post('/registration', rateLimit_1.registrationLimiter, userController_1.userRegistration);
userRouter.post('/activation', userController_1.activateUser);
userRouter.post('/login', deviceCheck_1.deviceCheck, userController_1.loginUser);
userRouter.post("/logout", auth_1.isAuthenticated, userController_1.logoutUser);
userRouter.get('/post', userController_1.updateAccessToken);
userRouter.post('/social-auth', userController_1.googleAuth);
userRouter.get('/me', auth_1.isAuthenticated, userController_1.getUserInfo);
userRouter.put('/update-password', auth_1.isAuthenticated, userController_1.updatePassword);
userRouter.post('/forgot-password', userController_1.forgotPassword);
userRouter.post('/reset-password', userController_1.resetPassword);
userRouter.put('/update-client-profile', auth_1.isAuthenticated, userController_1.updateClientProfile);
userRouter.put('/update-counselor-profile', auth_1.isAuthenticated, userController_1.updateCounselorProfile);
userRouter.delete('/delete-account', auth_1.isAuthenticated, userController_1.deleteAccount);
userRouter.post('/generate-counselor-link', auth_1.isAuthenticated, // Your auth middleware
auth_1.isAdmin, // Your admin check middleware
adminController_1.generateCounselorRegistrationLink);
userRouter.get('/admin/pending-counselors', auth_1.isAuthenticated, auth_1.isAdmin, adminController_1.getPendingCounselors);
userRouter.put('/admin/counselors/:counselorId/approve', auth_1.isAuthenticated, auth_1.isAdmin, adminController_1.approveCounselorAccount);
userRouter.delete('/admin/counselors/:counselorId/reject', auth_1.isAuthenticated, auth_1.isAdmin, adminController_1.rejectCounselorAccount);
userRouter.get('/admin/counselors', auth_1.isAuthenticated, auth_1.isAdmin, adminController_1.getAllCounselors);
userRouter.delete('/admin/counselors/:counselorId/delete', auth_1.isAuthenticated, auth_1.isAdmin, adminController_1.deleteCounselorAccount);
userRouter.put('/update-tour-status', auth_1.isAuthenticated, userController_1.updateTourStatus);
exports.default = userRouter;
