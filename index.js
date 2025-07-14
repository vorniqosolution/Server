const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const guestRoutes = require("./routes/guestRoutes");

dotenv.config();
const app = express();

app.use(
  cors({ origin: "http://localhost:3000", credentials: true })
);
app.use(cookieParser());
app.use(express.json());

// Connect to MongoDB
connectDB();
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/guests", guestRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
