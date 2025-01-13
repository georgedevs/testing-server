import express from 'express';
import { getAvailableAvatars } from '../controllers/avatarController';
import { updateAvatar } from '../controllers/userController';
import { isAuthenticated } from '../middleware/auth';

const avatarRouter = express.Router();

avatarRouter.get('/avatars', getAvailableAvatars);

avatarRouter.post('/update-avatar',isAuthenticated,updateAvatar)

export default avatarRouter;