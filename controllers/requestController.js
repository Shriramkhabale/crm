const Request = require('../models/Request');

// Create a new request
// exports.createRequest = async (req, res) => {
//   try {
//     const data = req.body;
//     const request = new Request(data);
//     await request.save();
//     res.status(201).json({ message: 'Request created', request });
//   } catch (error) {
//     console.error('Create request error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

// Get all requests (optionally filter by companyId or status)
exports.getRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.companyId) filter.companyId = req.query.companyId;
    if (req.query.status) filter.status = req.query.status;

    const requests = await Request.find(filter).sort({ updatedAt: -1 });
    res.json({ requests });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single request by ID
exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json({ request });
  } catch (error) {
    console.error('Get request by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a request by ID
// exports.updateRequest = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const data = req.body;

//     const request = await Request.findByIdAndUpdate(id, data, { new: true });
//     if (!request) {
//       return res.status(404).json({ message: 'Request not found' });
//     }
//     res.json({ message: 'Request updated', request });
//   } catch (error) {
//     console.error('Update request error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// Delete a request by ID
exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findByIdAndDelete(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json({ message: 'Request deleted' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createRequestWithFiles = async (req, res) => {
  try {
    const data = req.body;

    // Extract uploaded file URLs
    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        data.image = req.files.image[0].path;
      }
      if (req.files.audio && req.files.audio[0]) {
        data.audio = req.files.audio[0].path;
      }
      if (req.files.file && req.files.file[0]) {
        data.file = req.files.file[0].path;
      }
    }

    const request = new Request(data);
    await request.save();
    res.status(201).json({ message: 'Request created', request });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateRequestWithFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Extract uploaded file URLs and overwrite fields if present
    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        data.image = req.files.image[0].path;
      }
      if (req.files.audio && req.files.audio[0]) {
        data.audio = req.files.audio[0].path;
      }
      if (req.files.file && req.files.file[0]) {
        data.file = req.files.file[0].path;
      }
    }

    const request = await Request.findByIdAndUpdate(id, data, { new: true });
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json({ message: 'Request updated', request });
  } catch (error) {
    console.error('Update request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

