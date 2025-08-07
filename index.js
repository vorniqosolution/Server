const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const guestRoutes = require("./routes/guestRoutes");
const discountRoutes = require("./routes/discountRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const revenueRoutes = require("./routes/revenueRoutes");
const adminRoutes = require("./routes/adminRoutes");
const invoice = require("./routes/invoiceRoutes");
const SettingRoutes = require("./routes/taxsettingRoutes");
const reservationRoutes = require("./routes/reservationRoutes");

dotenv.config();
const app = express();

const allowed = ["http://localhost:3000", "http://localhost:8080"];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// Connect to MongoDB
connectDB();
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/guests", guestRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/revenue", revenueRoutes);
app.use("/api/invoice", invoice);
app.use("/api/admin", adminRoutes);
app.use("/api/reservation", SettingRoutes);
// reservation room
app.use("/api/room", reservationRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
