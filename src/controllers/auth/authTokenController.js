/**
 * Authentication Token Controller
 * Manages token-related operations, including:
 * - Token renewal
 * - Token management
 * - Token verification
 */

const BaseAuthController = require("./BaseAuthController");
const Users = require("../../models/user_model");
const {
  generateTokens,
  createTokenUser,
  isTokenValid,
} = require("../../utils/jwt");
const { handleResponse } = require("../../utils/handleResponse");

class AuthTokenController extends BaseAuthController {
  /**
   * Renew access token using refresh token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async renewAccessToken(req, res) {
    console.log("Renewing access token..........");
    console.log("Renewing access token..........");
    console.log("Renewing access token..........");
    console.log("Renewing access token..........");
    console.log("Renewing access token..........");
    console.log("Renewing access token..........");
    try {
      const { refreshToken } = req.body;
      console.log("Refresh token from request body:", refreshToken);
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

      try {
        // Verify the token
        isTokenValid(refreshToken, process.env.JWT_REFRESH_SECRET);

        // Find the user with the matching refresh token
        const query = { refreshTokens: refreshToken };

        const user = await Users.findOne(query).select("-password");
        if (!user) {
          console.warn("User not found for provided refresh token");
          return handleResponse(
            res,
            451,
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

        // Update refresh tokens
        if (Array.isArray(user.refreshTokens)) {
          // Remove the old token
          user.refreshTokens = user.refreshTokens.filter(
            (token) => token !== refreshToken
          );
          // Add the new token
          user.refreshTokens.push(newRefreshToken);
        } else {
          user.refreshTokens = newRefreshToken;
        }

        // Update last activity
        user.lastActivity = new Date();

        await user.save();

        return handleResponse(
          res,
          208,
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

  /**
   * Get list of active refresh tokens
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getRefreshTokens(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized!", null, 0);
      }

      const user = await Users.findById(req.user.id).select("-password");
      if (!user) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }

      const refreshTokens = user.refreshTokens || [];

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

  /**
   * Delete a specific refresh token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteRefreshToken(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized!", null, 0);
      }

      const { token, id } = req.body;
      if (!token && !id) {
        return handleResponse(
          res,
          400,
          "error",
          "Refresh token or ID is required",
          null,
          0
        );
      }

      const user = await Users.findById(req.user.id).select("-password");
      if (!user) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }

      // Handle array or string refreshTokens based on schema
      if (Array.isArray(user.refreshTokens)) {
        if (token) {
          user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
        } else if (id && user.refreshTokens.length > id) {
          user.refreshTokens.splice(id, 1);
        } else {
          user.refreshTokens = [];
        }
      } else {
        user.refreshTokens = "";
      }

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

  /**
   * Validate an access token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async validateAccessToken(req, res) {
    try {
      // If request reaches here through auth middleware, token is valid
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      if (!user) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }

      return handleResponse(res, 200, "success", "Token is valid", {
        userId: user._id,
        role: user.role,
        isValid: true,
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

  /**
   * Revoke all refresh tokens for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async revokeAllTokens(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized!", null, 0);
      }

      const user = await Users.findById(req.user.id).select("-password");
      if (!user) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }

      // Clear all refresh tokens
      if (Array.isArray(user.refreshTokens)) {
        user.refreshTokens = [];
      } else {
        user.refreshTokens = "";
      }

      await user.save();

      return handleResponse(
        res,
        200,
        "success",
        "All refresh tokens have been revoked",
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
}

module.exports = new AuthTokenController();
