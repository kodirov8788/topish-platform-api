// swaggerConfig.js
const swaggerUI = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");
// const { MessagesEndpoint } = require('../swaggerDocs/messagesDocs');
const { UserAvatarEndpoint } = require("../docs/userAvatardocs");
const { ProfileEndpoint } = require("../docs/profileDocs");
const { JobsEndpoint } = require("../docs/jobsDocs");
const { QuickjobsEndpoint } = require("../docs/quickjobsDocs");
const { UpdateUser } = require("../docs/UpdateUser");
const { FavoriteUser } = require("../docs/favoriteUser");
const { UsersEndpoint } = require("../docs/userDocs");
const { JobSeekersEndpoint } = require("../docs/jobsSeekersDocs");
const { EmployersEndpoint } = require("../docs/employersDocs");
const { ExpectedSalaryEndpoints } = require("../docs/ExpectedSalaryDocs");
const {
  UserDocResponseSchema,
  userDocSchema,
} = require("../docs/userResponse");
const { AuthEndpoints } = require("../docs/authDocs");
const { AllRoutesSchemas } = require("../docs/AllRoutesSchemas");
const { workExperienceEndpoint } = require("../docs/workExperienceDocs");
const { educationEndpoint } = require("../docs/educationDocs");
const { projectEndpoint } = require("../docs/projectsDocs");
const { AwardsEndpoints } = require("../docs/awardsDocs");
const { certificatesEndpoint } = require("../docs/certificatesDocs");
const { contactEndpoint } = require("../docs/ContactDocs");
const { summaryEndpoint } = require("../docs/SummaryDocs");
const { languagesEndpoint } = require("../docs/languageDocs");
const { skillsEndpoint } = require("../docs/skillsDocs");
const { professionsEndpoint } = require("../docs/professionsDocs");
const { cvFileEndpoints } = require("../docs/cvFileDocs");
const { statisticsEndpoint } = require("../docs/statisticsDocs");
const { galleryEndpoint } = require("../docs/galleryDocs");
const { BannerEndpoint } = require("../docs/bannerDocs");
const { OfficesEndpoint } = require("../docs/officesDocs");
const { BusinessServicesEndpoint } = require("../docs/businessServicesDocs");
const { AdminEndpoint } = require("../docs/AdminDocs");
const { CompanyEndpoint } = require("../docs/companyDocs");
const { reportUserEndPoint } = require("../docs/reportUserDocs");
const { tournamentsEndpoint } = require("../docs/tournamentsDocs");
const { telegramEndpoint } = require("../docs/telegramDocs");
const { othersEndpoint } = require("../docs/otherDocs");
const { MakeFriendsEndpoints } = require("../docs/makeFiendsDocs");
const { StoryEndpoints } = require("../docs/storyDocs");
const { DiscoverEndpoint } = require("../docs/discoverDocs");
const { DiscoverTagsEndpoint } = require("../docs/discoverTagsDocs");
const {
  Business_servicesTagsEndpoint,
} = require("../docs/business_servicesTagsDocs");
const { SearchEndpoints } = require("../docs/searchDocs");
const { SearchJobEndpoints } = require("../docs/SearchJobDocs");
const { IndustryEndpoints } = require("../docs/IndustryDocs");
const { AppVersionDocs } = require("../docs/appVersionDocs");
const { GPTDocs } = require("../docs/gptDocs");
const SecuritySchemes = {
  bearerAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
};

// const URL = `http://localhost:5001/api/v1/`;

const URL = process.env.SWAGGERT_URL || "http://127.0.0.1:8080/api/v1";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Library API",
      version: "1.0.0",
      description: "A simple Express Library API",
    },
    servers: [
      {
        url: URL,
        description: "Development server",
      },
    ],
    tags: [AuthEndpoints.tags, UsersEndpoint.tags],
    components: {
      securitySchemes: {
        ...SecuritySchemes, // Include your security schemes here
      },
      schemas: {
        ...userDocSchema.schemas,
        ...UserDocResponseSchema,
        ...AllRoutesSchemas.components.schemas,
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    paths: {
      ...AuthEndpoints,
      ...UsersEndpoint,
      // ...JobSeekersEndpoint,
      ...EmployersEndpoint,
      ...UpdateUser,
      ...FavoriteUser,
      ...JobsEndpoint,
      ...ProfileEndpoint,
      ...UserAvatarEndpoint,
      ...workExperienceEndpoint,
      ...educationEndpoint,
      ...projectEndpoint,
      ...AwardsEndpoints,
      ...certificatesEndpoint,
      ...contactEndpoint,
      ...summaryEndpoint,
      ...languagesEndpoint,
      ...skillsEndpoint,
      ...cvFileEndpoints,
      ...QuickjobsEndpoint,
      ...statisticsEndpoint,
      ...galleryEndpoint,
      ...BannerEndpoint,
      ...professionsEndpoint,
      ...OfficesEndpoint,
      ...AdminEndpoint,
      ...CompanyEndpoint,
      ...reportUserEndPoint,
      ...tournamentsEndpoint,
      ...telegramEndpoint,
      ...othersEndpoint,
      ...MakeFriendsEndpoints,
      ...StoryEndpoints,
      ...DiscoverEndpoint,
      ...BusinessServicesEndpoint,
      ...DiscoverTagsEndpoint,
      ...Business_servicesTagsEndpoint,
      ...SearchJobEndpoints,
      ...IndustryEndpoints,
      ...ExpectedSalaryEndpoints,
      ...AppVersionDocs,
      ...GPTDocs,
      ...SearchEndpoints,
    },
  },
  apis: ["./routes/*.js"],
};

// Setup Swagger
const swaggerSpecs = swaggerJsDoc(swaggerOptions);

const setupSwagger = (app) => {
  const options = {
    explorer: false,
    swaggerOptions: {
      docExpansion: "none", // This will collapse all sections by default
    },
  };
  app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpecs, options));
  // console.log('Swagger is setup and running');
};

const getSwaggerSpecs = () => swaggerSpecs;

module.exports = setupSwagger;
module.exports.getSwaggerSpecs = getSwaggerSpecs;
