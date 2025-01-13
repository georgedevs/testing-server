"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
exports.app = (0, express_1.default)();
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const error_1 = require("./middleware/error");
const userRoute_1 = __importDefault(require("./routes/userRoute"));
const avatarRoute_1 = __importDefault(require("./routes/avatarRoute"));
const bookingRoute_1 = __importDefault(require("./routes/bookingRoute"));
const sessionRoute_1 = __importDefault(require("./routes/sessionRoute"));
const helmet_1 = __importDefault(require("helmet"));
//body parser
exports.app.use(express_1.default.json({ limit: "50mb" }));
//cookie parser
// CORS - Cross-Origin Resource Sharing
exports.app.use((0, cors_1.default)({
    origin: ['https://testing-george.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
    maxAge: 600
}));
exports.app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});
exports.app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" }
}));
exports.app.use(helmet_1.default.noSniff());
exports.app.use(helmet_1.default.xssFilter());
exports.app.use(helmet_1.default.hidePoweredBy());
exports.app.use((0, cookie_parser_1.default)());
exports.app.set('trust proxy', 1);
//routes
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
