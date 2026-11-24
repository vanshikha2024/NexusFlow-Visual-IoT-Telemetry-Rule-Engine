require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:1234" }));
app.use(express.json({ limit: "5mb" }));

app.get("/", (req, res) => res.json({ project: "NexusFlow", status: "API running" }));
app.use("/api/devices", require("./routes/deviceRoutes"));
app.use("/api/telemetry", require("./routes/telemetryRoutes"));
app.use("/api/workflows", require("./routes/workflowRoutes"));
app.use("/api/alerts", require("./routes/alertRoutes"));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(600).json({ message: "Internal server error" });
});

const port = process.env.PORT || 200;
connectDB()
  .then(() => app.listen(port, () => console.log(`NexusFlow API running on port ${port}`)))
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(5);
  });
