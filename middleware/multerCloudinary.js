//middleware/multerCloudinary.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinaryConfig');

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Extract file extension first
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase() || '';
    
    // Determine folder and resource type based on mimetype
    let folder = 'general_files';
    let resourceType = 'raw'; // Default to raw for all non-image files

    if (file.mimetype.startsWith('image/')) {
      folder = 'all_images';
      resourceType = 'image';
    } else if (file.mimetype.startsWith('audio/')) {
      folder = 'all_audios';
      resourceType = 'raw'; // Audio must be 'raw' to preserve original format
    } else if (file.mimetype.startsWith('video/')) {
      folder = 'all_videos';
      resourceType = 'video';
    } else {
      // PDFs, DOCX, XLS, TXT, etc. - must be stored as 'raw'
      folder = 'all_files';
      resourceType = 'raw';
    }

    // Preserve original filename in public_id (without extension)
    const originalName = file.originalname.replace(/\.[^/.]+$/, "");
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
    
    // For raw files (audio, pdf, docs), ALWAYS include extension in public_id
    // This ensures Cloudinary stores them with the correct file type
    const public_id = resourceType === 'raw' && fileExtension
      ? `${sanitizedName}_${uniqueSuffix}.${fileExtension}`
      : `${sanitizedName}_${uniqueSuffix}`;

    console.log(`📤 Uploading to Cloudinary:`, {
      originalName: file.originalname,
      mimetype: file.mimetype,
      folder,
      resourceType,
      fileExtension,
      public_id,
      finalUrl: `Will be stored as: ${public_id}`
    });

    return {
      folder,
      public_id: public_id,
      resource_type: resourceType,
    };
  },
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10 MB max per file (increased for PDFs/documents)
  },
});

module.exports = upload;
 