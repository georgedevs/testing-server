"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableAvatars = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const avatarOptions_1 = require("../config/avatarOptions");
const avatar_1 = require("../utils/avatar");
exports.getAvailableAvatars = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { category } = req.query;
        let avatars;
        if (category && ['male', 'female', 'neutral'].includes(category)) {
            // Use the utility function to get avatars by category
            avatars = (0, avatar_1.getAvatarsByCategory)(category);
        }
        else {
            // Get all avatars using utility function
            avatars = {
                male: avatarOptions_1.avatarOptions.male,
                female: avatarOptions_1.avatarOptions.female,
                neutral: avatarOptions_1.avatarOptions.neutral
            };
        }
        res.status(200).json({
            success: true,
            avatars
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(error.message, 500));
    }
});
