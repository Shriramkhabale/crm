// utils/generateToken.js (example)
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  // Convert ObjectIds to strings to ensure they're properly serialized in JWT
  const payload = {
    id: user._id ? user._id.toString() : user._id,
    role: user.role,
    companyId: user.company ? user.company.toString() : null,
    accessPermissions: user.accessPermissions || [],
    superadmin: user.superadmin ? (typeof user.superadmin === 'string' ? user.superadmin : user.superadmin.toString()) : null,
    franchise: user.franchise ? (typeof user.franchise === 'string' ? user.franchise : user.franchise.toString()) : null,
  };

  console.log('🔐 JWT Payload being signed:', payload);

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
};

module.exports = generateToken;
