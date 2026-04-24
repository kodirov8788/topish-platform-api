// src/routes/auth-routes.js

// Import the controllers from the new modular structure
const authRegistrationController = require("../controllers/auth/authRegistrationController");
const authLoginController = require("../controllers/auth/authLoginController");
const authAccountController = require("../controllers/auth/authAccountController");
const authTokenController = require("../controllers/auth/authTokenController");

// Or alternatively, import everything from the index file
// const {
//   authRegistrationController,
//   authLoginController,
//   authAccountController,
//   authTokenController
// } = require("../controllers/auth");

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth-middleware");
const { validateUserSignUp, validateUserSignIn, userValidation } = require("../middleware/user-validation");

// Token management routes
router.get(
  "/getRefreshTokens",
  authMiddleware,
  authTokenController.getRefreshTokens
);
router.delete(
  "/deleteRefreshToken",
  authMiddleware,
  authTokenController.deleteRefreshToken
);
router.post("/renewAccessToken", authTokenController.renewAccessToken);
router.post(
  "/validate-token",
  authMiddleware,
  authTokenController.validateAccessToken
);
router.post(
  "/revoke-all-tokens",
  authMiddleware,
  authTokenController.revokeAllTokens
);

// Registration routes
router.post("/create-user", validateUserSignUp, userValidation, authRegistrationController.sendRegisterCode);
router.post(
  "/registerbyadmin",
  authMiddleware,
  authRegistrationController.registerUserByAdmin
);
router.post(
  "/create-user/confirmCode",
  authRegistrationController.confirmRegisterCode
);
router.post(
  "/create-user/resendCode",
  authRegistrationController.resendConfirmationCode
);
router.post(
  "/addUsernamesToAllUsers",
  authMiddleware,
  authRegistrationController.addUsernamesToAllUsers
);
router.post("/sendVoiceCall", authRegistrationController.sendVoiceCall);

// Login routes
router.post("/sign-in", validateUserSignIn, userValidation, authLoginController.sendLoginCode);
router.post("/sign-in/confirm", authLoginController.confirmLogin);
router.post("/sign-out", authMiddleware, authLoginController.signOut);

// Account management routes
router.delete(
  "/deleteAccount",
  authMiddleware,
  authAccountController.deleteAccount
);
router.post(
  "/sendDeleteAccountCode",
  authAccountController.sendDeleteAccountCode
);
router.post(
  "/confirmDeleteAccount",
  authAccountController.confirmDeleteAccount
);
router.post("/checkSmsStatus", authAccountController.checkSmsStatus);
router.post(
  "/update-profile",
  authMiddleware,
  authAccountController.updateProfileInfo
);
router.post(
  "/update-privacy",
  authMiddleware,
  authAccountController.updatePrivacySettings
);

module.exports = router;
