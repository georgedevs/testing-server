"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Admin = exports.Counselor = exports.Client = exports.User = void 0;
require('dotenv').config();
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const emailRegexPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Base user schema
const userSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: [true, "Please enter your email"],
        validate: {
            validator: function (email) {
                return emailRegexPattern.test(email);
            },
            message: "Please enter a valid email",
        },
        unique: true,
    },
    password: {
        type: String,
        required: [true, "Please enter your password"],
        minlength: [6, "Password must be at least 6 characters"],
        select: false,
    },
    avatar: {
        avatarId: String,
        imageUrl: String,
    },
    role: {
        type: String,
        enum: ["client", "admin", "counselor"],
        default: "client",
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    notifications: [{
            title: String,
            message: String,
            type: {
                type: String,
                enum: ["meeting", "system", "chat"],
            },
            read: {
                type: Boolean,
                default: false,
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        }],
    lastActive: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});
// Client schema
const clientSchema = new mongoose_1.Schema({
    username: {
        type: String,
        unique: true,
        sparse: true, // This allows multiple documents to have no username
        minlength: [3, "Username must be at least 3 characters"],
        maxlength: [30, "Username cannot exceed 30 characters"],
        trim: true,
        validate: {
            validator: function (username) {
                // Allow letters, numbers, underscores, and hyphens
                const usernameRegex = /^[a-zA-Z0-9_-]+$/;
                return usernameRegex.test(username);
            },
            message: "Username can only contain letters, numbers, underscores, and hyphens"
        }
    },
    marriageYears: Number,
    age: Number,
    issuesExperienced: [String],
    preferredCounselorGender: {
        type: String,
        enum: ["male", "female", "no_preference"],
    },
    sessionHistory: [{
            counselorId: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'Counselor'
            },
            sessionDate: Date,
            sessionType: {
                type: String,
                enum: ["virtual", "physical"],
            },
            status: {
                type: String,
                enum: ["scheduled", "completed", "cancelled"],
                default: "scheduled",
            },
            rating: Number,
            feedback: String,
            issueDescription: String,
        }],
    currentCounselor: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Counselor'
    },
    unreadMessages: {
        type: Number,
        default: 0,
    },
    preferredLanguages: [String],
    timezone: String,
    lastBooking: Date,
});
// Counselor schema
const counselorSchema = new mongoose_1.Schema({
    fullName: {
        type: String,
        required: true,
    },
    registrationToken: String,
    specializations: [String],
    marriageYears: Number,
    preferredAgeGroups: [String],
    gender: {
        type: String,
        enum: ["male", "female"],
    },
    languages: [String],
    unavailableDates: [Date],
    maxDailyMeetings: {
        type: Number,
        default: 8,
    },
    rating: {
        type: Number,
    },
    totalRatings: {
        type: Number,
        default: 0
    },
    averageRating: {
        type: Number,
    },
    totalSessions: {
        type: Number,
        default: 0,
    },
    completedSessions: {
        type: Number,
        default: 0,
    },
    cancelledSessions: {
        type: Number,
        default: 0,
    },
    isAvailable: {
        type: Boolean,
        default: true,
    },
    activeClients: {
        type: Number,
        default: 0,
    },
    workingHours: {
        start: {
            type: String,
            default: "09:00" // Default start time
        },
        end: {
            type: String,
            default: "17:00" // Default end time
        },
        timezone: String,
    },
    meetingPreferences: {
        maxConsecutiveMeetings: {
            type: Number,
            default: 4,
        },
    },
});
// Admin schema
const adminSchema = new mongoose_1.Schema({
    fullName: {
        type: String,
        required: true,
    },
    permissions: {
        canManageCounselors: {
            type: Boolean,
            default: true,
        },
        canManageClients: {
            type: Boolean,
            default: true,
        },
        canAccessAnalytics: {
            type: Boolean,
            default: true,
        },
        canManageSettings: {
            type: Boolean,
            default: true,
        },
    },
    adminLevel: {
        type: String,
        enum: ["super", "regular"],
        default: "regular",
    },
    lastLogin: Date,
    activityLog: [{
            action: String,
            timestamp: Date,
            details: String,
        }],
});
// Password hashing middleware
userSchema.pre("save", async function (next) {
    if (!this.isModified("password"))
        return next();
    this.password = await bcryptjs_1.default.hash(this.password, 10);
    next();
});
// Update lastActive middleware
userSchema.pre("save", function (next) {
    this.lastActive = new Date();
    next();
});
// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcryptjs_1.default.compare(enteredPassword, this.password);
};
// Sign access token method
userSchema.methods.signAccessToken = function () {
    return jsonwebtoken_1.default.sign({ id: this._id }, process.env.ACCESS_TOKEN || "");
};
//sign refresh token 
userSchema.methods.signRefreshToken = function () {
    return jsonwebtoken_1.default.sign({ id: this._id }, process.env.REFRESH_TOKEN || "");
};
// Create the models
const User = mongoose_1.default.model('User', userSchema);
exports.User = User;
const Client = User.discriminator('Client', clientSchema);
exports.Client = Client;
const Counselor = User.discriminator('Counselor', counselorSchema);
exports.Counselor = Counselor;
const Admin = User.discriminator('Admin', adminSchema);
exports.Admin = Admin;
