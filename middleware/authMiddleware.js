const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  //  console.log("1. Middleware HIT for URL:", req.originalUrl); // <--- Log 1
  const token = req.headers.authorization?.split(" ")[1] || req.cookies?.token;

  if (!token) {
    // console.log("2. Middleware: No Token Found"); // <--- Log 2
    return res
      .status(401)
      .json({ message: "No token provided !! Re-login Please" });
  }

  try {
    // Verify & attach payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, iat, exp }
    // console.log("3. Middleware: Token Verified. User set to:", req.user); // <--- Log 3
    next();
  } catch (err) {
    console.log("4. Middleware: Verification Failed", err.message); // <--- Log 4
    return res
      .status(401)
      .json({ message: "Invalid or expired token !! Re-login Please" });
  }
};

module.exports = authenticate;
