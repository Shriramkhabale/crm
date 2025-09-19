const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinaryConfig');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'employee_images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'mp3', 'pdf', 'docx'], // add allowed formats
  },
});

const parser = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB size limit
});

module.exports = parser;