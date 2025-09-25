// utils/generateToken.js (example)
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      companyId: user.company ? user.company.toString() : null,
      accessPermissions: user.accessPermissions || [],
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

module.exports = generateToken;
