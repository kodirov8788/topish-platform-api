require("dotenv").config();

const http = require("http");
const connectDB = require("./src/db/connect");
const { initSocketServer } = require("./src/socket/Socket");
const { createApp } = require("./src/app");
const { getConfig, validateEnv } = require("./src/config/env");

const config = getConfig();
validateEnv();

const app = createApp({ includePlatformRoutes: true });
const server = http.createServer(app);

initSocketServer(server);

const start = async () => {
  try {
    await connectDB(config.mongoUri);
    server.listen(config.port, () => {
      console.log(`Topish Platform API listening on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start Topish Platform API", error);
    process.exit(1);
  }
};

start();
