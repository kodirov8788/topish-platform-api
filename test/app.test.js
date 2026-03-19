const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test-refresh-secret";
process.env.SWAGGERT_URL =
  process.env.SWAGGERT_URL || "http://127.0.0.1:8080/api/v1";

const { createApp } = require("../src/app");

describe("Topish Platform API boot surface", () => {
  const app = createApp({ includePlatformRoutes: false });

  it("returns a health response without a database connection", async () => {
    const response = await request(app).get("/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.service, "topish-platform-api");
  });

  it("serves swagger JSON", async () => {
    const response = await request(app).get("/swagger-spec.json");

    assert.equal(response.status, 200);
    assert.equal(response.body.openapi, "3.0.0");
    assert.ok(response.body.paths["/auth/create-user"]);
  });

  it("serves a root status page in minimal boot mode", async () => {
    const response = await request(app).get("/");

    assert.equal(response.status, 200);
    assert.match(response.text, /Topish Platform API is running\./);
  });
});
