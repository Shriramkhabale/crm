// const jwt = require('jsonwebtoken');

// const generateToken = (user) => {
//   return jwt.sign(
//     { id: user._id, role: user.role },
//     process.env.JWT_SECRET,
//     { expiresIn: '1d' }
//   );
// };

// module.exports = generateToken;


// utils/generateToken.js (example)
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      companyId: user.company ? user.company.toString() : null, // add companyId here
            accessPermissions: user.accessPermissions || [],  // add accessPermissions here

    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

module.exports = generateToken;
