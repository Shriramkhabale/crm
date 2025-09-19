//authorizeRole.js
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: Role not allowed' });
    }
    next();
  };
};

module.exports = authorizeRole;
