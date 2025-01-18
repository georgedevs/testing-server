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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Meeting = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const meetingSchema = new mongoose_1.Schema({
    clientId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },
    counselorId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Counselor'
    },
    meetingType: {
        type: String,
        enum: ['virtual', 'physical'],
        required: true
    },
    issueDescription: {
        type: String,
        required: true
    },
    meetingDate: {
        type: Date
    },
    meetingTime: {
        type: String
    },
    status: {
        type: String,
        enum: ['request_pending', 'counselor_assigned', 'time_selected', 'confirmed', 'cancelled', 'completed', 'abandoned'],
        default: 'request_pending'
    },
    autoAssigned: {
        type: Boolean,
        default: false
    },
    cancellationReason: String,
    noShowReason: String,
    noShowReportedBy: {
        type: String,
        enum: ['client', 'counselor']
    },
    adminAssignedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    adminAssignedAt: Date,
    counselorResponseDeadline: Date,
    autoExpireAt: {
        type: Date
    },
    isExpired: {
        type: Boolean,
        default: false
    },
    dailyRoomName: {
        type: String,
    },
    dailyRoomUrl: {
        type: String,
    },
    dailyToken: {
        type: String,
    },
    meetingDuration: {
        type: Number,
        default: 45
    }
}, {
    timestamps: true
});
// Add middleware to check and update isExpired status
meetingSchema.pre('save', function (next) {
    if (this.autoExpireAt && new Date() > this.autoExpireAt) {
        this.isExpired = true;
    }
    next();
});
// Add middleware to filter out expired meetings in certain states
meetingSchema.pre('find', function (next) {
    // Only filter out expired meetings that are in pending states
    const pendingStates = ['request_pending', 'counselor_assigned', 'time_selected'];
    const currentQuery = this.getQuery();
    if (!currentQuery.status || (Array.isArray(currentQuery.status) &&
        currentQuery.status.some((s) => pendingStates.includes(s)))) {
        this.where({
            $or: [
                { isExpired: { $ne: true } },
                { status: { $nin: pendingStates } }
            ]
        });
    }
    next();
});
exports.Meeting = mongoose_1.default.model('Meeting', meetingSchema);
