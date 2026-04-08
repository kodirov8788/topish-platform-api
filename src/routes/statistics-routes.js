// src/routes/statistics-routes.js
const {
  getJobSeekerCount,
  getEmployerCount,
  getJobsCount,
  getApplicantsCount,
  getApplicantsCount,
  getCompaniesCount,
  getSystemHealth
} = require("../controllers/statisticsCTRL");
const router = require("express").Router();

router.route("/jobseekers").get(getJobSeekerCount);
router.route("/employers").get(getEmployerCount);
router.route("/jobs").get(getJobsCount);
router.route("/applicants").get(getApplicantsCount);
router.route("/companies").get(getCompaniesCount);
router.route("/health").get(getSystemHealth);

module.exports = router;
