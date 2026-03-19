const express = require("express");
const process = require("process");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");
require("express-async-errors");

const setupSwagger = require("./utils/swaggerConfig");
const { getSwaggerSpecs } = require("./utils/swaggerConfig");

const createApp = ({ includePlatformRoutes = true } = {}) => {
  const app = express();
  const blockedIPs = {};

  const unblockIP = (ip) => {
    setTimeout(() => {
      delete blockedIPs[ip];
    }, 2 * 60 * 1000);
  };

  app.set("trust proxy", 1);

  if (process.env.NODE_ENV !== "production") {
    app.use(morgan("tiny"));
  }

  app.use(express.json());
  app.use(cookieParser(process.env.JWT_SECRET));
  app.use(bodyParser.json({ limit: "20mb" }));
  app.use(bodyParser.urlencoded({ extended: true, limit: "20mb" }));
  app.use(helmet());
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use(
    cors({
      origin: "*",
      credentials: false,
      optionsSuccessStatus: 200,
    })
  );

  app.use((req, res, next) => {
    if (blockedIPs[req.ip]) {
      return res
        .status(429)
        .json({ message: "Too many requests. Please retry later." });
    }
    next();
  });

  app.use(
    rateLimit({
      windowMs: 2 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        blockedIPs[req.ip] = true;
        unblockIP(req.ip);
        res
          .status(429)
          .json({ message: "Too many requests. Please retry later." });
      },
    })
  );

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      service: "topish-platform-api",
      uptime: process.uptime(),
    });
  });

  app.get("/swagger-spec.json", (req, res) => {
    res.status(200).json(getSwaggerSpecs());
  });

  app.get("/", (req, res) => {
    res.status(200).send("Topish Platform API is running.");
  });

  if (includePlatformRoutes) {
    const MainRouter = require("./routes/index");
    app.use("/", MainRouter);
  }

  app.use((req, res, next) => {
    const nonce = crypto.randomBytes(16).toString("base64");
    res.locals.nonce = nonce;
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'`
    );
    next();
  });

  setupSwagger(app);

  return app;
};

module.exports = {
  createApp,
};
