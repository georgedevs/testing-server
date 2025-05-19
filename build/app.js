"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const error_1 = require("./middleware/error");
const userRoute_1 = __importDefault(require("./routes/userRoute"));
const avatarRoute_1 = __importDefault(require("./routes/avatarRoute"));
const bookingRoute_1 = __importDefault(require("./routes/bookingRoute"));
const sessionRoute_1 = __importDefault(require("./routes/sessionRoute"));
const express_session_1 = __importDefault(require("express-session"));
const sessionStore_1 = require("./utils/sessionStore");
const helmet_1 = __importDefault(require("helmet"));
exports.app = (0, express_1.default)();
// Security headers
exports.app.use((0, helmet_1.default)());
// Body parser
exports.app.use(express_1.default.json({ limit: "50mb" }));
// Cookie parser
exports.app.use((0, cookie_parser_1.default)());
// Trust proxy - necessary for secure cookies in production with Heroku/Render
exports.app.set('trust proxy', 1);
// Session configuration
exports.app.use((0, express_session_1.default)(sessionStore_1.sessionConfig));
// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://micounselor.vercel.app',
            'http://localhost:3000'
        ];
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'device-id'],
};
exports.app.use((0, cors_1.default)(corsOptions));
// Security headers
exports.app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'interest-cohort=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});
// Routes
exports.app.use("/api/v1", userRoute_1.default);
exports.app.use("/api/v1", avatarRoute_1.default);
exports.app.use("/api/v1", bookingRoute_1.default);
exports.app.use("/api/v1", sessionRoute_1.default);
// Testing API
exports.app.get("/test", (req, res, next) => {
    res.status(200).json({
        success: true,
        message: "API is working",
    });
});
// Unknown route
exports.app.all("*", (req, res, next) => {
    const err = new Error(`Route ${req.originalUrl} not found`);
    err.statusCode = 404;
    next(err);
});
exports.app.use(error_1.ErrorMiddleware);
