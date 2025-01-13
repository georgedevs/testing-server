import express from 'express';
import { isAuthenticated } from '../middleware/auth';
import { 
  createSession, 
  startSession, 
  endSession, 
  submitSessionFeedback 
} from '../controllers/sessionController';

const sessionRouter = express.Router();

sessionRouter.post('/sessions', isAuthenticated, createSession);
sessionRouter.post('/sessions/:sessionId/start', isAuthenticated, startSession);
sessionRouter.post('/sessions/:sessionId/end', isAuthenticated, endSession);
sessionRouter.post('/sessions/:sessionId/feedback', isAuthenticated, submitSessionFeedback);

export default sessionRouter;