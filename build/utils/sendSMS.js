"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = void 0;
require('dotenv').config();
const twilio_1 = __importDefault(require("twilio"));
const twilioClient = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const sendSMS = async (to, message) => {
    try {
        await twilioClient.messages.create({
            body: message,
            to,
            from: process.env.TWILIO_PHONE_NUMBER
        });
    }
    catch (error) {
        console.error('SMS sending failed:', error.message);
    }
};
exports.sendSMS = sendSMS;
