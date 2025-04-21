"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTourStatus = exports.deleteAccount = exports.updateCounselorProfile = exports.updateClientProfile = exports.updateAvatar = exports.resetPassword = exports.forgotPassword = exports.updatePassword = exports.getUserInfo = exports.logoutUser = exports.loginUser = exports.activateUser = exports.userRegistration = void 0;
const userModel_1 = require("../models/userModel");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sendMail_1 = __importDefault(require("../utils/sendMail"));
const redis_1 = require("../utils/redis");
const sessionManager_1 = require("../utils/sessionManager");
const avatar_1 = require("../utils/avatar");
const getRedisKey = (userId) => {
    return userId.toString();
};
// Helper to create activation token
const createActivationToken = (user) => {
    // Generate 6-digit activation code
    const activationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const token = jsonwebtoken_1.default.sign({ user, activationCode }, process.env.ACTIVATION_SECRET, { expiresIn: "5m" });
    return { token, activationCode };
};
const validateCounselorToken = async (token) => {
    try {
        // Split token into its components
        const [tokenPart, expirationPart] = token.split('_');
        if (!tokenPart || !expirationPart) {
            return false;
        }
        // Convert expiration to number
        const expirationTime = parseInt(expirationPart);
        if (isNaN(expirationTime)) {
            return false;
        }
        // Check if token has expired
        if (Date.now() > expirationTime) {
            return false;
        }
        // Find token in admin's activity log
        const admin = await userModel_1.Admin.findOne({
            activityLog: {
                $elemMatch: {
                    details: `${token}_unused`,
                    action: "COUNSELOR_INVITATION"
                }
            }
        });
        if (!admin) {
            return false;
        }
        // Mark token as used
        await userModel_1.Admin.updateOne({
            "activityLog.details": `${token}_unused`,
            "activityLog.action": "COUNSELOR_INVITATION"
        }, {
            $set: {
                "activityLog.$.details": `${token}_used`
            }
        });
        return true;
    }
    catch (error) {
        console.error("Token validation error:", error);
        return false;
    }
};
// Main registration controller
exports.userRegistration = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { email, password, role = "client", registrationToken, fullName } = req.body;
        // Check if email exists
        const emailExists = await userModel_1.User.findOne({ email });
        if (emailExists) {
            return next(new errorHandler_1.default("Email already registered", 400));
        }
        // Validate role-specific requirements
        if (role === "counselor") {
            if (!registrationToken) {
                return next(new errorHandler_1.default("Registration token required for counselor registration", 400));
            }
            if (!fullName) {
                return next(new errorHandler_1.default("Full name required for counselor registration", 400));
            }
            const isValidToken = await validateCounselorToken(registrationToken);
            if (!isValidToken) {
                return next(new errorHandler_1.default("Invalid or expired registration token. Please request a new registration link.", 400));
            }
        }
        if (role === "admin" && !fullName) {
            return next(new errorHandler_1.default("Full name required for admin registration", 400));
        }
        // Create activation token
        const { token, activationCode } = createActivationToken({
            email,
            password,
            role,
            fullName
        });
        // Prepare email data
        const data = {
            user: {
                email,
                fullName: fullName || email.split("@")[0],
                role
            },
            activationCode
        };
        // Send activation email
        try {
            await (0, sendMail_1.default)({
                email,
                subject: "Activate Your MiCounselor Account",
                template: "activation-mail.ejs",
                data
            });
            // Send response
            res.status(201).json({
                success: true,
                message: `Please check your email: ${email} to activate your account!`,
                activationToken: token
            });
        }
        catch (error) {
            return next(new errorHandler_1.default(`Error sending activation email: ${error.message}`, 500));
        }
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
// Activation controller
exports.activateUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { activation_token, activation_code } = req.body;
        const newUser = jsonwebtoken_1.default.verify(activation_token, process.env.ACTIVATION_SECRET);
        if (!activation_code || activation_code.length !== 6) {
            return next(new errorHandler_1.default("Please provide a valid 6-digit activation code", 400));
        }
        if (activation_code !== newUser.activationCode) {
            return next(new errorHandler_1.default("Invalid activation code", 400));
        }
        const { email, password, role, fullName } = newUser.user;
        // Check if user exists
        const existingUser = await userModel_1.User.findOne({ email });
        if (existingUser) {
            return next(new errorHandler_1.default("Email already registered", 400));
        }
        // Create user based on role with isVerified set to true
        let user;
        switch (role) {
            case "client":
                user = await userModel_1.Client.create({
                    email,
                    password,
                    role,
                    isVerified: true // Added this line
                });
                break;
            case "counselor":
                user = await userModel_1.Counselor.create({
                    email,
                    password,
                    role,
                    fullName,
                    isVerified: true, // Added this line
                    isActive: false // Requires admin approval
                });
                break;
            case "admin":
                user = await userModel_1.Admin.create({
                    email,
                    password,
                    role,
                    fullName,
                    isVerified: true, // Added this line
                    adminLevel: "regular"
                });
                break;
            default:
                return next(new errorHandler_1.default("Invalid role specified", 400));
        }
        // Send welcome email
        const welcomeData = {
            user: {
                email,
                fullName: fullName || email.split("@")[0],
                role
            }
        };
        try {
            await (0, sendMail_1.default)({
                email,
                subject: "Welcome to MiCounselor",
                template: "welcome-mail.ejs",
                data: welcomeData
            });
        }
        catch (error) {
            console.error("Welcome email failed:", error);
            // Don't return error as user is already created
        }
        res.status(201).json({
            success: true,
            message: "Account activated successfully"
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
exports.loginUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!req.deviceId) {
            return next(new errorHandler_1.default("Device ID not found", 400));
        }
        // Validation
        if (!email || !password) {
            return next(new errorHandler_1.default("Please enter email and password", 400));
        }
        // Find user and include password field
        const user = await userModel_1.User.findOne({ email })
            .select("+password")
            .exec();
        if (!user) {
            return next(new errorHandler_1.default("Invalid email or password", 401));
        }
        // Check if user is verified
        if (!user.isVerified) {
            return next(new errorHandler_1.default("Please verify your email first", 401));
        }
        if (!user.isActive && user.role !== "counselor") {
            return next(new errorHandler_1.default("Your account has been deactivated", 401));
        }
        // Compare password
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            return next(new errorHandler_1.default("Invalid email or password", 401));
        }
        // Create session
        await sessionManager_1.SessionManager.createSession(user._id.toString(), req.deviceId);
        // Update last active timestamp
        user.lastActive = new Date();
        // For admin users, update last login
        if (user.role === "admin") {
            await userModel_1.User.findByIdAndUpdate(user._id, {
                $set: { lastLogin: new Date() },
                $push: {
                    activityLog: {
                        action: "login",
                        timestamp: new Date(),
                        details: `Login from ${req.ip} with device ${req.deviceId}`,
                    },
                },
            });
        }
        // Send login notification
        user.notifications.push({
            title: "New Login",
            message: `New login detected from ${req.ip} with device ${req.deviceId}`,
            type: "system",
            read: false,
            createdAt: new Date(),
        });
        await user.save();
        // Store user data in session
        if (!req.session) {
            return next(new errorHandler_1.default("Session not available", 500));
        }
        req.session.userId = user._id.toString();
        req.session.user = {
            _id: user._id,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            isActive: user.isActive,
            avatar: user.avatar,
            lastActive: user.lastActive,
        };
        // Send response
        res.status(200).json({
            success: true,
            user: {
                _id: user._id,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                isActive: user.isActive,
                avatar: user.avatar,
                lastActive: user.lastActive,
            }
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
exports.logoutUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const user = req.user;
        if (user) {
            // Remove session
            await sessionManager_1.SessionManager.removeSession(user._id.toString());
            // For admin users, log the logout action
            if (user.role === "admin") {
                await userModel_1.User.findByIdAndUpdate(user._id, {
                    $push: {
                        activityLog: {
                            action: "logout",
                            timestamp: new Date(),
                            details: `Logout from ${req.ip}`,
                        },
                    },
                });
            }
            // Update last active timestamp
            await userModel_1.User.findByIdAndUpdate(user._id, {
                lastActive: new Date()
            });
        }
        // Destroy session
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    return next(new errorHandler_1.default("Failed to logout", 500));
                }
            });
        }
        // Clear session cookie
        res.clearCookie('sid');
        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
;
// Get user info controller
exports.getUserInfo = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user?._id) {
            return next(new errorHandler_1.default("User not authenticated", 401));
        }
        const userId = req.user._id;
        // Get user from DB
        const user = await userModel_1.User.findById(userId).select("-password");
        if (!user) {
            return next(new errorHandler_1.default("User not found", 404));
        }
        res.status(200).json({
            success: true,
            user
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
// Update password for logged-in user
exports.updatePassword = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return next(new errorHandler_1.default("Please provide old and new password", 400));
        }
        // Get user with password field
        const user = await userModel_1.User.findById(req.user?._id).select("+password");
        if (!user) {
            return next(new errorHandler_1.default("User not found", 404));
        }
        // Validate old password
        const isPasswordMatch = await user.comparePassword(oldPassword);
        if (!isPasswordMatch) {
            return next(new errorHandler_1.default("Old password is incorrect", 400));
        }
        // Update password
        user.password = newPassword;
        await user.save();
        // Clear Redis cache
        await redis_1.redis.del(user._id.toString());
        // Send password change notification email
        try {
            await (0, sendMail_1.default)({
                email: user.email,
                subject: "Password Changed Successfully",
                template: "password-changed.ejs",
                data: { user }
            });
        }
        catch (error) {
            console.error("Password change notification email failed:", error);
        }
        res.status(200).json({
            success: true,
            message: "Password updated successfully"
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
// Generate OTP for password reset
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
// Forgot password - send OTP
exports.forgotPassword = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await userModel_1.User.findOne({ email });
        if (!user) {
            return next(new errorHandler_1.default("User not found", 404));
        }
        // Generate OTP
        const otp = generateOTP();
        // Create reset token
        const resetToken = jsonwebtoken_1.default.sign({ email, otp }, process.env.RESET_TOKEN_SECRET, { expiresIn: "15m" });
        // Store reset token in Redis with 15min expiry
        const resetKey = `reset:${user._id}`;
        await redis_1.redis.set(resetKey, resetToken, 'EX', 900); // 15 minutes
        // Send OTP email
        try {
            await (0, sendMail_1.default)({
                email: user.email,
                subject: "Password Reset OTP",
                template: "reset-password.ejs",
                data: { user: { email: user.email, otp } }
            });
            res.status(200).json({
                success: true,
                message: "Password reset OTP sent to your email",
                resetToken
            });
        }
        catch (error) {
            await redis_1.redis.del(resetKey);
            return next(new errorHandler_1.default("Error sending reset email", 500));
        }
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
// Verify OTP and reset password
exports.resetPassword = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { resetToken, newPassword } = req.body;
        // Verify reset token
        const decoded = jsonwebtoken_1.default.verify(resetToken, process.env.RESET_TOKEN_SECRET);
        const user = await userModel_1.User.findOne({ email: decoded.email });
        if (!user) {
            return next(new errorHandler_1.default("User not found", 404));
        }
        // Check if reset token exists in Redis
        const resetKey = `reset:${user._id}`;
        const storedToken = await redis_1.redis.get(resetKey);
        if (!storedToken || storedToken !== resetToken) {
            return next(new errorHandler_1.default("Invalid or expired reset token", 400));
        }
        // Update password
        user.password = newPassword;
        await user.save();
        // Clear reset token from Redis
        await redis_1.redis.del(resetKey);
        // Clear user cache
        await redis_1.redis.del(user._id.toString());
        // Send confirmation email
        try {
            await (0, sendMail_1.default)({
                email: user.email,
                subject: "Password Reset Successful",
                template: "reset-success.ejs",
                data: { user }
            });
        }
        catch (error) {
            console.error("Password reset confirmation email failed:", error);
        }
        res.status(200).json({
            success: true,
            message: "Password reset successful"
        });
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return next(new errorHandler_1.default("Reset token has expired", 400));
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return next(new errorHandler_1.default("Invalid reset token", 400));
        }
        return next(new errorHandler_1.default(error.message, 500));
    }
});
// Update user avatar
exports.updateAvatar = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { avatarId } = req.body;
        const userId = req.user?._id;
        console.log('Update avatar request:', { avatarId, userId }); // Debug log
        if (!userId) {
            return next(new errorHandler_1.default('User not authenticated', 401));
        }
        if (!avatarId) {
            return next(new errorHandler_1.default('Avatar ID is required', 400));
        }
        // Validate avatar using the utility function
        const isValidAvatar = await (0, avatar_1.validateAvatarId)(avatarId);
        if (!isValidAvatar) {
            return next(new errorHandler_1.default('Invalid avatar selection', 400));
        }
        // Get avatar details
        const avatarDetails = (0, avatar_1.getAvatarDetails)(avatarId);
        if (!avatarDetails) {
            return next(new errorHandler_1.default('Avatar details not found', 400));
        }
        const user = await userModel_1.User.findById(userId);
        if (!user) {
            return next(new errorHandler_1.default('User not found', 404));
        }
        // Update user's avatar
        user.avatar = {
            avatarId,
            imageUrl: avatarDetails.imageUrl
        };
        await user.save();
        // Update redis cache
        await redis_1.redis.set(userId.toString(), JSON.stringify(user));
        res.status(200).json({
            success: true,
            user
        });
    }
    catch (error) {
        console.error('Update avatar error:', error); // Debug log
        return next(new errorHandler_1.default(error.message, 500));
    }
});
// Update client profile
exports.updateClientProfile = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { username, marriageYears, age, issuesExperienced, preferredCounselorGender, preferredLanguages, timezone, } = req.body;
        const userId = req.user?._id;
        if (!userId) {
            return next(new errorHandler_1.default('User not authenticated', 401));
        }
        const client = await userModel_1.Client.findById(userId);
        if (!client) {
            return next(new errorHandler_1.default('Client not found', 404));
        }
        // Check if username exists and is different from current username
        if (username && username !== client.username) {
            // Check if new username is already taken
            const existingUsername = await userModel_1.Client.findOne({ username });
            if (existingUsername) {
                return next(new errorHandler_1.default('Username already taken', 400));
            }
            client.username = username;
        }
        // Update optional fields if provided
        if (marriageYears)
            client.marriageYears = marriageYears;
        if (age)
            client.age = age;
        if (issuesExperienced)
            client.issuesExperienced = issuesExperienced;
        if (preferredCounselorGender)
            client.preferredCounselorGender = preferredCounselorGender;
        if (preferredLanguages)
            client.preferredLanguages = preferredLanguages;
        if (timezone)
            client.timezone = timezone;
        await client.save();
        // Convert ObjectId to string for Redis key
        const userIdString = userId.toString();
        await redis_1.redis.set(userIdString, JSON.stringify(client));
        res.status(200).json({
            success: true,
            client
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
// Update counselor profile
exports.updateCounselorProfile = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { fullName, specializations, marriageYears, preferredAgeGroups, gender, languages, availability, unavailableDates, maxDailyMeetings, isAvailable, workingHours, meetingPreferences } = req.body;
        const userId = req.user?._id;
        if (!userId) {
            return next(new errorHandler_1.default('User not authenticated', 401));
        }
        const counselor = await userModel_1.Counselor.findById(userId);
        if (!counselor) {
            return next(new errorHandler_1.default('Counselor not found', 404));
        }
        // Update basic information
        if (fullName)
            counselor.fullName = fullName;
        if (gender)
            counselor.gender = gender;
        // Update professional details
        if (specializations)
            counselor.specializations = specializations;
        if (marriageYears)
            counselor.marriageYears = marriageYears;
        if (preferredAgeGroups)
            counselor.preferredAgeGroups = preferredAgeGroups;
        if (languages)
            counselor.languages = languages;
        // Update availability settings
        if (availability) {
            // Validate availability format
            const isValidAvailability = availability.every((slot) => slot.dayOfWeek >= 0 &&
                slot.dayOfWeek <= 6 &&
                slot.startTime &&
                slot.endTime &&
                typeof slot.isRecurring === 'boolean');
            if (!isValidAvailability) {
                return next(new errorHandler_1.default('Invalid availability format', 400));
            }
        }
        if (unavailableDates) {
            // Validate and convert date strings to Date objects
            const parsedDates = unavailableDates.map((date) => new Date(date));
            if (parsedDates.some((date) => isNaN(date.getTime()))) {
                return next(new errorHandler_1.default('Invalid date format in unavailableDates', 400));
            }
            counselor.unavailableDates = parsedDates;
        }
        // Update working preferences
        if (maxDailyMeetings) {
            if (maxDailyMeetings < 1 || maxDailyMeetings > 20) {
                return next(new errorHandler_1.default('maxDailyMeetings must be between 1 and 20', 400));
            }
            counselor.maxDailyMeetings = maxDailyMeetings;
        }
        if (typeof isAvailable === 'boolean') {
            counselor.isAvailable = isAvailable;
        }
        if (workingHours) {
            // Validate working hours format
            if (!workingHours.start || !workingHours.end || !workingHours.timezone) {
                return next(new errorHandler_1.default('Invalid working hours format', 400));
            }
            counselor.workingHours = workingHours;
        }
        if (meetingPreferences) {
            if (meetingPreferences.maxConsecutiveMeetings &&
                (meetingPreferences.maxConsecutiveMeetings < 1 ||
                    meetingPreferences.maxConsecutiveMeetings > 10)) {
                return next(new errorHandler_1.default('maxConsecutiveMeetings must be between 1 and 10', 400));
            }
            counselor.meetingPreferences = meetingPreferences;
        }
        // Save the updated counselor profile
        await counselor.save();
        // Update Redis cache
        const userIdString = userId.toString();
        await redis_1.redis.set(userIdString, JSON.stringify(counselor));
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            counselor
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
exports.deleteAccount = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { password } = req.body;
        if (!userId) {
            return next(new errorHandler_1.default("User not authenticated", 401));
        }
        // Find user and include password field for verification
        const user = await userModel_1.User.findById(userId).select("+password");
        if (!user) {
            return next(new errorHandler_1.default("User not found", 404));
        }
        // Verify password before proceeding with deletion
        if (password) {
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                return next(new errorHandler_1.default("Invalid password", 401));
            }
        }
        // Perform role-specific cleanup
        switch (user.role) {
            case "client": {
                // Cast user to IClient type for client-specific properties
                const clientUser = await userModel_1.Client.findById(userId);
                if (clientUser?.currentCounselor) {
                    await userModel_1.Counselor.findByIdAndUpdate(clientUser.currentCounselor, {
                        $inc: { activeClients: -1 }
                    });
                }
                break;
            }
            case "counselor": {
                // Update clients who have this counselor assigned
                await userModel_1.Client.updateMany({ currentCounselor: userId }, { $unset: { currentCounselor: 1 } });
                break;
            }
            case "admin": {
                // Cast user to IAdmin type for admin-specific properties
                const adminUser = await userModel_1.Admin.findById(userId);
                if (adminUser?.adminLevel === "super") {
                    const superAdminCount = await userModel_1.Admin.countDocuments({
                        adminLevel: "super",
                        _id: { $ne: userId }
                    });
                    if (superAdminCount === 0) {
                        return next(new errorHandler_1.default("Cannot delete the last super admin account", 400));
                    }
                }
                break;
            }
        }
        // Clean up sessions and cached user data
        const redisKey = userId.toString();
        await redis_1.redis.del(redisKey);
        await sessionManager_1.SessionManager.removeSession(userId.toString());
        // Destroy the current session
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    console.error("Error destroying session during account deletion:", err);
                }
            });
        }
        // Clear session cookie
        res.clearCookie('sid');
        // Delete the user account
        await userModel_1.User.findByIdAndDelete(userId);
        res.status(200).json({
            success: true,
            message: "Account deleted successfully"
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
exports.updateTourStatus = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return next(new errorHandler_1.default("User not authenticated", 401));
        }
        const user = await userModel_1.User.findById(userId);
        if (!user) {
            return next(new errorHandler_1.default("User not found", 404));
        }
        user.tourViewed = true;
        await user.save();
        // Update Redis cache
        const redisKey = getRedisKey(userId);
        await redis_1.redis.set(redisKey, JSON.stringify(user));
        res.status(200).json({
            success: true,
            message: "Tour status updated successfully"
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
