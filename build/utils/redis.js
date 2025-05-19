"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = require("ioredis");
const dotenv_1 = __importDefault(require("dotenv"));
const events_1 = require("events");
dotenv_1.default.config();
events_1.EventEmitter.defaultMaxListeners = 20;
const redisClient = () => {
    if (process.env.REDIS_URL) {
        console.log(`Redis Connected`);
        return process.env.REDIS_URL;
    }
    throw new Error('Redis connection failed');
};
exports.redis = new ioredis_1.Redis(redisClient());
exports.redis.setMaxListeners(20);
