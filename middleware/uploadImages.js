//middleware/uplodimages.js
const multer = require('multer');
// Use memory storage, since we'll upload to Cloudinary from memory buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });
module.exports = upload;