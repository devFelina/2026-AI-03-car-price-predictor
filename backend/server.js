const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");

dotenv.config();

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT || "5000", 10);
const FASTAPI_BASE_URL = (
  process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const ML_REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.ML_REQUEST_TIMEOUT_MS || "10000",
  10,
);

const app = express();
const mlClient = axios.create({
  baseURL: FASTAPI_BASE_URL,
  timeout: ML_REQUEST_TIMEOUT_MS,
});

app.use(cors());
app.use(express.json());

function isMlServiceUnavailable(error) {
  return !error.response;
}

app.get("/api/health", async (_request, response) => {
  try {
    const mlResponse = await mlClient.get("/health");
    response.json({
      status: "ok",
      express: { status: "ok" },
      fastapi: mlResponse.data,
    });
  } catch (error) {
    if (isMlServiceUnavailable(error)) {
      response.status(503).json({
        status: "unavailable",
        express: { status: "ok" },
        fastapi: { status: "unavailable" },
        detail: "ML service is unavailable.",
      });
      return;
    }

    response.status(error.response.status).json({
      status: "error",
      express: { status: "ok" },
      fastapi: error.response.data,
    });
  }
});

app.post("/api/predict", async (request, response) => {
  try {
    const mlResponse = await mlClient.post("/predict", request.body);
    response.status(mlResponse.status).json(mlResponse.data);
  } catch (error) {
    if (isMlServiceUnavailable(error)) {
      response.status(503).json({ detail: "ML service is unavailable." });
      return;
    }

    response.status(error.response.status).json(error.response.data);
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Backend listening at http://${HOST}:${PORT}`);
  console.log(`FastAPI base URL: ${FASTAPI_BASE_URL}`);
});
