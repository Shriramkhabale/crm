// routes/fileRoutes.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * Download file from Cloudinary through backend proxy
 * This solves CORS issues and ensures proper content-type headers
 * GET /api/files/download?fileUrl=<cloudinary_url>
 */
router.get('/download', async (req, res) => {
  try {
    const { fileUrl } = req.query;

    if (!fileUrl) {
      return res.status(400).json({ error: "Missing fileUrl parameter" });
    }

    console.log('📥 File download request:', fileUrl);

    // Fetch file from Cloudinary
    const fileResponse = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      timeout: 30000, // 30 second timeout
    });

    // Determine content type from response or URL
    let contentType = fileResponse.headers['content-type'] || 'application/octet-stream';
    
    // Extract filename from URL or use generic name
    const urlParts = fileUrl.split('/');
    const fileNameWithParams = urlParts[urlParts.length - 1];
    const fileName = fileNameWithParams.split('?')[0]; // Remove query params
    
    // Detect file extension and set proper content-type
    const extension = fileName.split('.').pop()?.toLowerCase();
    const contentTypeMap = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'mp4': 'video/mp4',
    };

    if (extension && contentTypeMap[extension]) {
      contentType = contentTypeMap[extension];
    }

    console.log('✅ File fetched successfully:', {
      fileName,
      contentType,
      size: fileResponse.data.length
    });

    // Set proper headers for download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileResponse.data.length);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Send file data
    res.send(fileResponse.data);

  } catch (err) {
    console.error('❌ File download error:', err.message);
    res.status(500).json({ 
      error: 'Error downloading file', 
      message: err.message 
    });
  }
});

/**
 * Stream file from Cloudinary (for large files)
 * GET /api/files/stream?fileUrl=<cloudinary_url>
 */
router.get('/stream', async (req, res) => {
  try {
    const { fileUrl } = req.query;

    if (!fileUrl) {
      return res.status(400).json({ error: "Missing fileUrl parameter" });
    }

    console.log('📺 File stream request:', fileUrl);

    // Stream file from Cloudinary
    const fileResponse = await axios.get(fileUrl, {
      responseType: 'stream',
      timeout: 60000, // 60 second timeout for streaming
    });

    // Extract filename
    const urlParts = fileUrl.split('/');
    const fileNameWithParams = urlParts[urlParts.length - 1];
    const fileName = fileNameWithParams.split('?')[0];
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    let contentType = fileResponse.headers['content-type'] || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    if (fileResponse.headers['content-length']) {
      res.setHeader('Content-Length', fileResponse.headers['content-length']);
    }

    console.log('✅ Streaming file:', fileName);

    // Pipe the stream directly to response
    fileResponse.data.pipe(res);

  } catch (err) {
    console.error('❌ File stream error:', err.message);
    res.status(500).json({ 
      error: 'Error streaming file', 
      message: err.message 
    });
  }
});

module.exports = router;
