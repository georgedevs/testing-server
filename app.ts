import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./middleware/error";
import userRouter from "./routes/userRoute";
import avatarRouter from "./routes/avatarRoute";
import bookingRouter from "./routes/bookingRoute";
import sessionRouter from "./routes/sessionRoute";
import expressSession from "express-session";
import { sessionConfig } from "./utils/sessionStore";
import helmet from "helmet";  

export const app = express();

// Security headers
app.use(helmet());

// Body parser
app.use(express.json({ limit: "50mb" }));

// Cookie parser
app.use(cookieParser());

// Trust proxy - necessary for secure cookies in production with Heroku/Render
app.set('trust proxy', 1);

// Session configuration
app.use(expressSession(sessionConfig));

// CORS configuration
const corsOptions = {
  origin: function(origin:any, callback:any) {
    const allowedOrigins = [
      'https://micounselor.vercel.app', 
      'http://localhost:3000'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
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

app.use(cors(corsOptions));
// Security headers
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'interest-cohort=()'); 
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Routes
app.use("/api/v1", userRouter);
app.use("/api/v1", avatarRouter);
app.use("/api/v1", bookingRouter);
app.use("/api/v1", sessionRouter);

// Testing API
app.get("/test", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    success: true,
    message: "API is working",
  });
});

// Unknown route
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;
  err.statusCode = 404;
  next(err);
});

app.use(ErrorMiddleware);