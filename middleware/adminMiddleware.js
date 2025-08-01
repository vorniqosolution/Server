const authorize = (...roles) => {
  return (req, res, next) => {
    // 1. Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // 2. Check if the user's role is included in the list of allowed roles
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied. Admin role required." }); // More specific message
    }

    // 3. If all checks pass, proceed to the next middleware/handler
    next();
  };
};

module.exports = authorize;
