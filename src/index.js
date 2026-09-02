import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import workoutRoutes from "./routes/workouts.js";
import nutritionRoutes from "./routes/nutrition.js";
import subscriptionRoutes from "./routes/subscription.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(requestLogger);
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/workouts", workoutRoutes);
app.use("/nutrition", nutritionRoutes);
app.use("/subscription", subscriptionRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "not_found", message: `Route ${req.method} ${req.path} not found` });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Parent Pressure API running on http://localhost:${PORT}`);
});

export default app;