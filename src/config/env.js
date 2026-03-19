const requiredInProduction = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"];

const getConfig = () => ({
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8080),
  mongoUri: process.env.MONGO_URI || "",
});

const validateEnv = () => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

module.exports = {
  getConfig,
  validateEnv,
};
