const User = require("../model/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  const { email, password } = req.body;
  console.log(req.body);

  try {
    // 1. Verify user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Invalid credentials" });

    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // 3. Sign a new token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 4. Set it in an HttpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax", // allows cross-site POSTs
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 5. Send back user info only
    res.status(200).json({
      message: "Login successful",
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// SIGNUP (Only for receptionist)
exports.signup = async (req, res) => {
  const { name, email, password } = req.body;
  console.log(req.body);
  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already in use" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const receptionist = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "receptionist",
    });

    res.status(201).json({
      message: "Receptionist registered successfully",
      user: {
        id: receptionist._id,
        name: receptionist.name,
        email: receptionist.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.me = async (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

exports.logout = (req, res) => {
  // Clear the cookie named "token"
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
  });
  res.json({ message: "Logout successful" });
};
