const User = require("../model/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Verify user exists
    const user = await User.findOne({ email });
    if (!user) 
      return res.status(404).json({ message: "Invalid credentials" });

    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) 
      return res.status(401).json({ message: "Invalid credentials" });

    // 3. Sign a new token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4. Set it in an HttpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // false in dev
      sameSite: "Lax",                                // allows cross-site POSTs
      maxAge: 60 * 60 * 1000                          // 1 hour
    });

    // 5. Send back user info only
    res.status(200).json({
      message: "Login successful",
      user: {
        name:  user.name,
        email: user.email,
        role:  user.role
      }
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
