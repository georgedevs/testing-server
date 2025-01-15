import express, { NextFunction, Request, Response } from "express";
export const app = express()
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./middleware/error";
import userRouter from "./routes/userRoute";
import avatarRouter from "./routes/avatarRoute";
import bookingRouter from "./routes/bookingRoute";
import sessionRouter from "./routes/sessionRoute";

//body parser
app.use(express.json({limit: "50mb"}))

app.use(cookieParser());

//cookie parser

app.set('trust proxy', 1);


// CORS - Cross-Origin Resource Sharing
app.use(cors({
    origin: ['https://testing-george.vercel.app'],
    credentials: true,
}));


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

