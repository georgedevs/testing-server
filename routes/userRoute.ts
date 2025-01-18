import express from 'express';
import { activateUser, forgotPassword, getUserInfo, loginUser, logoutUser, resetPassword, googleAuth, updateAccessToken, updateClientProfile, updateCounselorProfile, updatePassword, userRegistration, deleteAccount, updateTourStatus } from '../controllers/userController';
import { approveCounselorAccount, deleteCounselorAccount, generateCounselorRegistrationLink, getAllCounselors, getPendingCounselors, rejectCounselorAccount,  } from '../controllers/adminController';
import { isAdmin, isAuthenticated, isCounselor } from '../middleware/auth';
import { loginLimiter, registrationLimiter } from '../middleware/rateLimit';
import { deviceCheck } from '../middleware/deviceCheck';
const userRouter = express.Router();

userRouter.post('/registration',registrationLimiter, userRegistration)

userRouter.post('/activation', activateUser)

userRouter.post('/login',deviceCheck,loginUser)

userRouter.post("/logout", isAuthenticated, logoutUser);

userRouter.get('/post', updateAccessToken)

userRouter.post('/social-auth', googleAuth)

userRouter.get('/me', isAuthenticated,getUserInfo);

userRouter.put('/update-password', isAuthenticated, updatePassword)

userRouter.post('/forgot-password', forgotPassword)

userRouter.post('/reset-password', resetPassword)

userRouter.put('/update-client-profile', isAuthenticated, updateClientProfile)

userRouter.put('/update-counselor-profile',isAuthenticated, updateCounselorProfile)

userRouter.delete('/delete-account', isAuthenticated, deleteAccount);

userRouter.post(
    '/generate-counselor-link',
    isAuthenticated, // Your auth middleware
    isAdmin, // Your admin check middleware
    generateCounselorRegistrationLink
  );

  userRouter.get(
    '/admin/pending-counselors', 
    isAuthenticated, 
    isAdmin,
    getPendingCounselors
  );

  userRouter.put(
    '/admin/counselors/:counselorId/approve', 
    isAuthenticated, 
    isAdmin,
    approveCounselorAccount
  );
  
  
  userRouter.delete(
    '/admin/counselors/:counselorId/reject', 
    isAuthenticated, 
    isAdmin,
    rejectCounselorAccount
  );


  userRouter.get(
    '/admin/counselors',
    isAuthenticated,
    isAdmin,
    getAllCounselors
  );

  userRouter.delete(
    '/admin/counselors/:counselorId/delete',
    isAuthenticated,
    isAdmin,
    deleteCounselorAccount
  )

  userRouter.put('/update-tour-status', isAuthenticated, updateTourStatus);
export default userRouter;