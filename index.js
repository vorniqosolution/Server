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

const allowed = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow server-to-server (no origin) and any whitelisted origin
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// Simple health & version routes (great for Docker/ALB checks)
// app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));
// app.get("/version", (req, res) =>
//   res.json({ env: process.env.NODE_ENV || "dev" })
// );

// Connect to MongoDB
connectDB();

// CRM ROUTES (Admin, receptionist, accountant)
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/guests", guestRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/revenue", revenueRoutes);
app.use("/api/invoice", invoice);
app.use("/api/admin", adminRoutes);
app.use("/api/reservation", reservationRoutes);
app.use("/api/tax", SettingRoutes);
// testing purpose
app.get("/test", (req, res) => {
  return res.json({ message: "test api" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`)
);
