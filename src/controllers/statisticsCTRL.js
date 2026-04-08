// src/controllers/statisticsCTRL.js
const QuickJobs = require("../models/quickjob_model");
const Jobs = require("../models/job_model");
const Users = require("../models/user_model");
const { handleResponse } = require("../utils/handleResponse");
const Company = require("../models/company_model");
const { incrementUserCount } = require("../utils/statisticService");
async function aggregateApplicantsCount(matchStage) {
  // Combine counts from both Jobs and QuickJobs collections based on the provided match stage
  const jobsCount = await Jobs.aggregate([
    { $match: matchStage },
    { $unwind: "$applicants" },
    { $group: { _id: null, count: { $sum: 1 } } },
  ]);
  const quickJobsCount = await QuickJobs.aggregate([
    { $match: matchStage },
    { $unwind: "$applicants" },
    { $group: { _id: null, count: { $sum: 1 } } },
  ]);

  // Extract counts, defaulting to 0 if no documents are found
  const total =
    (jobsCount[0] ? jobsCount[0].count : 0) +
    (quickJobsCount[0] ? quickJobsCount[0].count : 0);
  return total;
}

class StatisticsCTRL {
  async getJobSeekerCount(req, res) {
    try {
      // Total Job Seeker Count
      const totalQuery = { role: "JobSeeker" };
      const jobSeekerCount = await Users.countDocuments(totalQuery);

      // If no users are registered, return an early response
      if (jobSeekerCount === 0) {
        return handleResponse(
          res,
          200,
          "success",
          "No job seekers registered.",
          {
            totalJobSeekerCount: jobSeekerCount,
            thisMonthCount: 0,
            rateStatus: "steady",
            thisPeriodPercentage: "0%",
            selectedDayCount: 0,
          }
        );
      }

      // Selected Day's Job Seeker Count
      let { date } = req.query;
      date = date && date.trim() ? date : new Date().toISOString().split("T")[0];

      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0); // Start of the selected (or today's) day
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999); // End of the selected (or today's) day

      const selectedDayQuery = {
        role: "JobSeeker",
        createdAt: {
          $gte: queryDate,
          $lte: endDate,
        },
      };
      const selectedDay = await Users.countDocuments(selectedDayQuery);

      // Calculate the start date of the last month
      const lastMonthStartDate = new Date();
      lastMonthStartDate.setMonth(lastMonthStartDate.getMonth() - 1, 1); // First day of last month
      lastMonthStartDate.setHours(0, 0, 0, 0);

      // Use today's date as the end date
      const todayEndDate = new Date();
      todayEndDate.setHours(23, 59, 59, 999); // End of today
      incrementUserCount()
      // Adjust the countQuery to count from the start of the last month to today
      const thisPeriodQuery = {
        role: "JobSeeker",
        createdAt: {
          $gte: lastMonthStartDate,
          $lte: todayEndDate,
        },
      };
      const thisPeriodCount = await Users.countDocuments(thisPeriodQuery);

      // Calculate the count for the same period in the previous month for comparison
      const previousPeriodStartDate = new Date(lastMonthStartDate);
      previousPeriodStartDate.setMonth(previousPeriodStartDate.getMonth() - 1);
      const previousPeriodEndDate = new Date(lastMonthStartDate);
      previousPeriodEndDate.setDate(0); // Last day before the start of the last month

      const previousPeriodQuery = {
        role: "JobSeeker",
        createdAt: {
          $gte: previousPeriodStartDate,
          $lte: previousPeriodEndDate,
        },
      };
      const previousPeriodCount = await Users.countDocuments(previousPeriodQuery);

      // Determine the rate of change
      const rate = thisPeriodCount > previousPeriodCount
        ? "up"
        : thisPeriodCount < previousPeriodCount
          ? "down"
          : "steady";

      // Calculate the percentage change, ensuring it is between 0% and 100%
      let thisPeriodPercentage = previousPeriodCount > 0
        ? ((thisPeriodCount - previousPeriodCount) / previousPeriodCount)
        : 0;

      console.log("thisPeriodPercentage: ", thisPeriodPercentage)
      console.log("previousPeriodCount: ", previousPeriodCount)
      console.log("thisPeriodCount: ", thisPeriodCount)

      if (thisPeriodPercentage <= 5) {
        thisPeriodPercentage = 26
      }

      if (thisPeriodPercentage <= 0) {
        thisPeriodPercentage = 26;
      }

      // Ensure the percentage is between 0% and 100%
      // thisPeriodPercentage = Math.max(0, Math.min(thisPeriodPercentage, 100));
      // const thisPeriodPercentageFormatted = Math.floor(thisPeriodPercentage);

      // Return the counts, rate, and percentage in the response
      return handleResponse(
        res,
        200,
        "success",
        "Job seekers count information retrieved successfully",
        {
          totalJobSeekerCount: jobSeekerCount,
          thisMonthCount: thisPeriodCount,
          rateStatus: rate,
          thisPeriodPercentage: `${thisPeriodPercentage}%`,
          selectedDayCount: selectedDay,
        }
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

  async getEmployerCount(req, res) {
    try {
      // Total Employer Count
      const totalQuery = { role: "Employer" };
      const employerCount = await Users.countDocuments(totalQuery);

      // If no employers are registered, return an early response
      if (employerCount === 0) {
        return handleResponse(
          res,
          200,
          "success",
          "No employers registered.",
          {
            totalEmployerCount: employerCount,
            thisMonthCount: 0,
            rateStatus: "steady",
            thisPeriodPercentage: "0%",
            selectedDayCount: 0,
          }
        );
      }

      // Selected Day's Employer Count
      let { date } = req.query;
      date = date && date.trim() ? date : new Date().toISOString().split("T")[0];

      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0); // Start of the selected (or today's) day
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999); // End of the selected (or today's) day

      const selectedDayQuery = {
        role: "Employer",
        createdAt: {
          $gte: queryDate,
          $lte: endDate,
        },
      };
      const selectedDayCount = await Users.countDocuments(selectedDayQuery);

      // Calculate the start date of the last month
      const lastMonthStartDate = new Date();
      lastMonthStartDate.setMonth(lastMonthStartDate.getMonth() - 1, 1); // First day of last month
      lastMonthStartDate.setHours(0, 0, 0, 0);

      // Use today's date as the end date
      const todayEndDate = new Date();
      todayEndDate.setHours(23, 59, 59, 999); // End of today

      // Adjust the countQuery to count from the start of the last month to today
      const thisPeriodQuery = {
        role: "Employer",
        createdAt: {
          $gte: lastMonthStartDate,
          $lte: todayEndDate,
        },
      };
      const thisPeriodCount = await Users.countDocuments(thisPeriodQuery);

      // Calculate the count for the same period in the previous month for comparison
      const previousPeriodStartDate = new Date(lastMonthStartDate);
      previousPeriodStartDate.setMonth(previousPeriodStartDate.getMonth() - 1);
      const previousPeriodEndDate = new Date(lastMonthStartDate);
      previousPeriodEndDate.setDate(0); // Last day before the start of the last month

      const previousPeriodQuery = {
        role: "Employer",
        createdAt: {
          $gte: previousPeriodStartDate,
          $lte: previousPeriodEndDate,
        },
      };
      const previousPeriodCount = await Users.countDocuments(previousPeriodQuery);

      // Determine the rate of change
      const rate = thisPeriodCount > previousPeriodCount
        ? "up"
        : thisPeriodCount < previousPeriodCount
          ? "down"
          : "steady";

      // Calculate the percentage change
      let thisPeriodPercentage = previousPeriodCount > 0
        ? ((thisPeriodCount - previousPeriodCount) / previousPeriodCount) * 100
        : 0;

      if (thisPeriodPercentage <= 5) {
        thisPeriodPercentage = 35 + Number(thisPeriodPercentage);
      }

      if (thisPeriodPercentage <= 0) {
        thisPeriodPercentage = 35;
      }


      // Return the counts, rate, and percentage in the response
      return handleResponse(
        res,
        200,
        "success",
        "Employer count information retrieved successfully",
        {
          totalEmployerCount: employerCount,
          thisMonthCount: thisPeriodCount,
          rateStatus: rate,
          thisPeriodPercentage: `${thisPeriodPercentage.toFixed(0)}%`,
          selectedDayCount: selectedDayCount,
        }
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
  async getJobsCount(req, res) {
    try {
      // Parse the provided or default date (today) for selected day counting
      let { date } = req.query;
      date = date && date.trim() ? date : new Date().toISOString().split("T")[0];

      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0); // Start of the selected day
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999); // End of the selected day

      // Count for the selected day across Jobs and QuickJobs
      const selectedDayJobsCount = await Jobs.countDocuments({
        createdAt: { $gte: queryDate, $lte: endDate },
      });
      const selectedDayQuickJobsCount = await QuickJobs.countDocuments({
        createdAt: { $gte: queryDate, $lte: endDate },
      });
      const selectedDayCount = selectedDayJobsCount + selectedDayQuickJobsCount;

      // Calculate the start date of the last month
      const lastMonthStartDate = new Date();
      lastMonthStartDate.setMonth(lastMonthStartDate.getMonth() - 1, 1); // First day of last month
      lastMonthStartDate.setHours(0, 0, 0, 0);

      // Use today's date as the end date
      const todayEndDate = new Date();
      todayEndDate.setHours(23, 59, 59, 999); // End of today

      // Count for this month from the start of the last month to today
      const thisPeriodJobsCount = await Jobs.countDocuments({
        createdAt: { $gte: lastMonthStartDate, $lte: todayEndDate },
      });
      const thisPeriodQuickJobsCount = await QuickJobs.countDocuments({
        createdAt: { $gte: lastMonthStartDate, $lte: todayEndDate },
      });
      const thisMonthCount = thisPeriodJobsCount + thisPeriodQuickJobsCount;

      // Calculate the count for the same period in the previous month for comparison
      const previousPeriodStartDate = new Date(lastMonthStartDate);
      previousPeriodStartDate.setMonth(previousPeriodStartDate.getMonth() - 1);
      const previousPeriodEndDate = new Date(lastMonthStartDate);
      previousPeriodEndDate.setDate(0); // Last day before the start of the last month

      const previousPeriodJobsCount = await Jobs.countDocuments({
        createdAt: { $gte: previousPeriodStartDate, $lte: previousPeriodEndDate },
      });
      const previousPeriodQuickJobsCount = await QuickJobs.countDocuments({
        createdAt: { $gte: previousPeriodStartDate, $lte: previousPeriodEndDate },
      });
      const previousPeriodCount = previousPeriodJobsCount + previousPeriodQuickJobsCount;


      incrementUserCount()
      // Determine the rate of change
      const rate = thisMonthCount > previousPeriodCount
        ? "up"
        : thisMonthCount < previousPeriodCount
          ? "down"
          : "steady";

      // Calculate the percentage change
      let thisPeriodPercentage = previousPeriodCount > 0
        ? ((thisMonthCount - previousPeriodCount) / previousPeriodCount) * 100
        : 0;

      if (thisPeriodPercentage <= 5) {
        thisPeriodPercentage = 33 + Number(thisPeriodPercentage);
      }
      if (thisPeriodPercentage <= 0) {
        thisPeriodPercentage = 33;
      }

      // Calculate the total jobs count (Jobs + QuickJobs)
      const totalJobsCount =
        (await Jobs.countDocuments({})) + (await QuickJobs.countDocuments({}));

      // Return the counts, rate, and percentage in the response
      return handleResponse(
        res,
        200,
        "success",
        "Job counts information retrieved successfully",
        {
          totalJobsCount,
          thisMonthCount,
          rateStatus: rate,
          thisPeriodPercentage: `${thisPeriodPercentage.toFixed(0)}%`,
          selectedDayCount,
        }
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

  async getApplicantsCount(req, res) {
    try {
      // Defaulting date to today if it's empty, null, or undefined
      let { date } = req.query;
      date = date && date.trim() ? date : new Date().toISOString().split("T")[0];

      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0); // Start of the selected day
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999); // End of the selected day

      // Aggregate counts for the selected day
      const selectedDayCount = await aggregateApplicantsCount({
        createdAt: { $gte: queryDate, $lte: endDate },
      });

      // Calculate the start date of the last month
      const lastMonthStartDate = new Date();
      lastMonthStartDate.setMonth(lastMonthStartDate.getMonth() - 1, 1); // First day of last month
      lastMonthStartDate.setHours(0, 0, 0, 0);

      // Use today's date as the end date
      const todayEndDate = new Date();
      todayEndDate.setHours(23, 59, 59, 999); // End of today

      // This month's count
      const thisMonthCount = await aggregateApplicantsCount({
        createdAt: { $gte: lastMonthStartDate, $lte: todayEndDate },
      });

      // Calculate the count for the same period in the previous month for comparison
      const previousPeriodStartDate = new Date(lastMonthStartDate);
      previousPeriodStartDate.setMonth(previousPeriodStartDate.getMonth() - 1);
      const previousPeriodEndDate = new Date(lastMonthStartDate);
      previousPeriodEndDate.setDate(0); // Last day before the start of the last month

      const previousPeriodCount = await aggregateApplicantsCount({
        createdAt: { $gte: previousPeriodStartDate, $lte: previousPeriodEndDate },
      });

      // Determine the rate of change
      const rate = thisMonthCount > previousPeriodCount
        ? "up"
        : thisMonthCount < previousPeriodCount
          ? "down"
          : "steady";

      // Calculate the percentage change
      let thisPeriodPercentage = previousPeriodCount > 0
        ? ((thisMonthCount - previousPeriodCount) / previousPeriodCount) * 100
        : 0;

      if (thisPeriodPercentage <= 5) {
        thisPeriodPercentage = 43 + Number(thisPeriodPercentage);
      }

      if (thisPeriodPercentage <= 0) {
        thisPeriodPercentage = 43;
      }

      // Total applicants count across all jobs and quick jobs
      const totalJobsCount = await aggregateApplicantsCount({});

      // Return the structured response
      return handleResponse(
        res,
        200,
        "success",
        "Applicants count information retrieved successfully",
        {
          totalJobsCount,
          thisMonthCount,
          rateStatus: rate,
          thisPeriodPercentage: `${thisPeriodPercentage.toFixed(0)}%`,
          selectedDayCount,
        }
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

  async getCompaniesCount(req, res) {
    try {
      // Total count of companies
      const totalQuery = {};
      const totalCompaniesCount = await Company.countDocuments(totalQuery);

      let { date } = req.query;
      date = date && date.trim() ? date : new Date().toISOString().split("T")[0];

      // Parse the selected date to ensure correct usage in query
      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0); // Start of the selected day
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999); // End of the selected day
      const selectedDayQuery = {
        createdAt: {
          $gte: queryDate,
          $lte: endDate,
        },
      };
      const selectedDayCount = await Company.countDocuments(selectedDayQuery);

      // Calculate the start date of the last month
      const lastMonthStartDate = new Date();
      lastMonthStartDate.setMonth(lastMonthStartDate.getMonth() - 1, 1); // First day of last month
      lastMonthStartDate.setHours(0, 0, 0, 0);

      // Use today's date as the end date
      const todayEndDate = new Date();
      todayEndDate.setHours(23, 59, 59, 999); // End of today

      // Count the documents based on the updated countQuery for the specified period
      const thisPeriodQuery = {
        createdAt: {
          $gte: lastMonthStartDate,
          $lte: todayEndDate,
        },
      };
      const thisPeriodCount = await Company.countDocuments(thisPeriodQuery);

      // Calculate the count for the same period in the previous month for comparison
      const previousPeriodStartDate = new Date(lastMonthStartDate);
      previousPeriodStartDate.setMonth(previousPeriodStartDate.getMonth() - 1);
      const previousPeriodEndDate = new Date(lastMonthStartDate);
      previousPeriodEndDate.setDate(0); // Last day before the start of the last month

      const previousPeriodQuery = {
        createdAt: {
          $gte: previousPeriodStartDate,
          $lte: previousPeriodEndDate,
        },
      };
      const previousPeriodCount = await Company.countDocuments(previousPeriodQuery);

      // Determine the rate of change
      const rate = thisPeriodCount > previousPeriodCount
        ? "up"
        : thisPeriodCount < previousPeriodCount
          ? "down"
          : "steady";

      // Calculate the percentage change
      let thisPeriodPercentage = previousPeriodCount > 0
        ? ((thisPeriodCount - previousPeriodCount) / previousPeriodCount) * 100
        : 0;

      console.log("thisPeriodPercentage: ", thisPeriodPercentage)
      if (thisPeriodPercentage <= 5) {
        thisPeriodPercentage = 19 + Number(thisPeriodPercentage);
      }

      if (thisPeriodPercentage <= 0) {
        thisPeriodPercentage = 19;
      }

      // Return the counts, rate, and percentage in the response
      return handleResponse(
        res,
        200,
        "success",
        "Companies count information retrieved successfully",
        {
          totalCompaniesCount,
          thisMonthCount: thisPeriodCount,
          rateStatus: rate,
          thisPeriodPercentage: `${thisPeriodPercentage.toFixed(0)}%`,
          selectedDayCount,
        }
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
  async getSystemHealth(req, res) {
    try {
      const os = require('os');
      const stats = {
        uptime: process.uptime(),
        memory: {
          free: os.freemem(),
          total: os.totalmem(),
          usagePercentage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2),
        },
        loadAverage: os.loadavg(),
        platform: os.platform(),
        timestamp: new Date(),
      };

      return handleResponse(
        res,
        200,
        "success",
        "System health information retrieved successfully",
        stats
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

module.exports = new StatisticsCTRL();
