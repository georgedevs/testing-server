import express, { NextFunction, Request, Response } from "express";
export const app = express()
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./middleware/error";
import userRouter from "./routes/userRoute";
import avatarRouter from "./routes/avatarRoute";
import bookingRouter from "./routes/bookingRoute";
import sessionRouter from "./routes/sessionRoute";

const allowedOrigins = [
  'https://testing-george.vercel.app',
  'https://testing-george.vercel.app/',
  'https://www.testing-george.vercel.app',
  'https://www.testing-george.vercel.app/'
];

//body parser
app.use(express.json({limit: "50mb"}))

app.use(cookieParser());

//cookie parser

app.set('trust proxy', 1);



app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'device-id'],
  exposedHeaders: ['set-cookie']
}));


  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'interest-cohort=()'); // Opt out of FLoC
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });


//routes
app.use("/api/v1", userRouter)
app.use("/api/v1", avatarRouter)
app.use("/api/v1", bookingRouter)
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

