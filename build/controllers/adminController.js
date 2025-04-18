"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCounselorAccount = exports.getAllCounselors = exports.rejectCounselorAccount = exports.getPendingCounselors = exports.approveCounselorAccount = exports.generateCounselorRegistrationLink = void 0;
const userModel_1 = require("../models/userModel");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const crypto_1 = __importDefault(require("crypto"));
const sendMail_1 = __importDefault(require("../utils/sendMail"));
// Generate a unique registration token
const generateRegistrationToken = () => {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours from now
    return `${token}_${expiresAt}`;
};
exports.generateCounselorRegistrationLink = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const adminId = req.user?._id;
        const { counselorEmail } = req.body;
        if (!counselorEmail) {
            return next(new errorHandler_1.default("Counselor email is required", 400));
        }
        // Generate unique registration token
        const registrationToken = generateRegistrationToken();
        // Save token in admin's activity log
        await userModel_1.Admin.findByIdAndUpdate(adminId, {
            $push: {
                activityLog: {
                    action: "COUNSELOR_INVITATION",
                    timestamp: new Date(),
                    details: `${registrationToken}_unused`, // Changed separator to underscore
                },
            },
        });
        // Generate registration link
        const registrationLink = `${process.env.FRONTEND_URL}/regcounselor?token=${registrationToken}`;
        // Send invitation email to counselor
        const data = {
            registrationLink,
            email: counselorEmail
        };
        try {
            await (0, sendMail_1.default)({
                email: counselorEmail,
                subject: "Invitation to Join MiCounselor as a Counselor",
                template: "counselor-invitation.ejs",
                data,
            });
            res.status(200).json({
                success: true,
                message: `Invitation sent to ${counselorEmail}`,
                registrationToken, // Including for testing purposes
                registrationLink, // Including for testing purposes
            });
        }
        catch (error) {
            return next(new errorHandler_1.default(`Error sending invitation email: ${error.message}`, 500));
        }
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
exports.approveCounselorAccount = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { counselorId } = req.params;
        const counselor = await userModel_1.Counselor.findById(counselorId);
        if (!counselor) {
            return next(new errorHandler_1.default("Counselor not found", 404));
        }
        if (counselor.isActive) {
            return next(new errorHandler_1.default("Counselor is already active", 400));
        }
        // Update counselor status
        counselor.isActive = true;
        await counselor.save();
        // Send approval notification email
        const data = {
            name: counselor.fullName,
            email: counselor.email
        };
        try {
            await (0, sendMail_1.default)({
                email: counselor.email,
                subject: "MiCounselor Account Approved",
                template: "counselor-approval.ejs",
                data,
            });
        }
        catch (error) {
            console.log("Error sending approval email:", error);
            // Continue even if email fails
        }
        res.status(200).json({
            success: true,
            message: "Counselor account approved successfully"
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
// Get pending counselor approvals
exports.getPendingCounselors = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const pendingCounselors = await userModel_1.Counselor.find({
            isActive: false,
            isVerified: true
        }).select('email fullName credentials createdAt');
        res.status(200).json({
            success: true,
            count: pendingCounselors.length,
            counselors: pendingCounselors
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
// Reject counselor account
exports.rejectCounselorAccount = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { counselorId } = req.params;
        const { reason } = req.body;
        const counselor = await userModel_1.Counselor.findById(counselorId);
        if (!counselor) {
            return next(new errorHandler_1.default("Counselor not found", 404));
        }
        // Send rejection email
        const data = {
            name: counselor.fullName,
            email: counselor.email,
            reason: reason || "Your application did not meet our current requirements."
        };
        try {
            await (0, sendMail_1.default)({
                email: counselor.email,
                subject: "MiCounselor Application Status",
                template: "counselor-rejection.ejs",
                data,
            });
        }
        catch (error) {
            console.log("Error sending rejection email:", error);
        }
        // Delete the counselor account
        await counselor.deleteOne();
        res.status(200).json({
            success: true,
            message: "Counselor application rejected and account removed"
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
exports.getAllCounselors = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        // Get query parameters for filtering
        const { isActive, specialization, language, gender, minRating, maxClients } = req.query;
        // Build filter object
        const filter = {};
        // Add filters if they exist in query
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }
        if (specialization) {
            filter.specializations = { $in: [specialization] };
        }
        if (language) {
            filter.languages = { $in: [language] };
        }
        if (gender) {
            filter.gender = gender;
        }
        if (minRating) {
            filter.rating = { $gte: parseFloat(minRating) };
        }
        if (maxClients) {
            filter.activeClients = { $lte: parseInt(maxClients) };
        }
        // Get counselors with all fields except password
        const counselors = await userModel_1.Counselor.find(filter)
            .select('-password -notifications')
            .sort({ rating: -1, totalSessions: -1 });
        // Calculate additional statistics
        const statistics = {
            totalCounselors: counselors.length,
            activeCounselors: counselors.filter(c => c.isActive).length,
            averageRating: counselors.reduce((acc, curr) => acc + curr.rating, 0) / counselors.length || 0,
            totalCompletedSessions: counselors.reduce((acc, curr) => acc + curr.completedSessions, 0)
        };
        res.status(200).json({
            success: true,
            statistics,
            counselors,
            count: counselors.length
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
exports.deleteCounselorAccount = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { counselorId } = req.params;
        const { reason } = req.body;
        const counselor = await userModel_1.Counselor.findById(counselorId);
        if (!counselor) {
            return next(new errorHandler_1.default("Counselor not found", 404));
        }
        // Check if counselor has active clients
        if (counselor.activeClients > 0) {
            return next(new errorHandler_1.default("Cannot delete counselor with active clients", 400));
        }
        // Send notification email to counselor
        const data = {
            name: counselor.fullName,
            email: counselor.email,
            reason: reason || "Your account has been terminated by the administrator."
        };
        try {
            await (0, sendMail_1.default)({
                email: counselor.email,
                subject: "MiCounselor Account Termination",
                template: "counselor-termination.ejs",
                data,
            });
        }
        catch (error) {
            console.log("Error sending termination email:", error);
            // Continue with deletion even if email fails
        }
        // Log the deletion in admin's activity log
        await userModel_1.Admin.findByIdAndUpdate(req.user?._id, {
            $push: {
                activityLog: {
                    action: "COUNSELOR_DELETION",
                    timestamp: new Date(),
                    details: `Deleted counselor: ${counselor.email} - ${reason || 'No reason provided'}`
                }
            }
        });
        // Delete the counselor account
        await counselor.deleteOne();
        res.status(200).json({
            success: true,
            message: "Counselor account successfully deleted"
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
