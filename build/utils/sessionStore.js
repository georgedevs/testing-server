"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionConfig = void 0;
const express_session_1 = __importDefault(require("express-session"));
const connect_redis_1 = __importDefault(require("connect-redis"));
const redis_1 = require("./redis");
const uuid_1 = require("uuid");
// Create Redis store
const RedisStore = (0, connect_redis_1.default)(express_session_1.default);
// Create store instance
const redisStore = new RedisStore({
    client: redis_1.redis,
    prefix: 'sess:'
});
redisStore.setMaxListeners(20);
exports.sessionConfig = {
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'fallback_secret_do_not_use_in_production',
    resave: false,
    saveUninitialized: false,
    store: redisStore,
    genid: (req) => (0, uuid_1.v4)(),
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
};
