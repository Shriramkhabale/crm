const SABusinessProfile = require('../models/SABusinessProfile');
const cloudinary = require('../config/cloudinaryConfig');

// Create or Update Business Profile
exports.createOrUpdateBusinessProfile = async (req, res) => {
  try {
   const logoUrl = req.file ? req.file.path : null; 

    // if (req.file) {
    //   const streamUpload = (req) => {
    //     return new Promise((resolve, reject) => {
    //       const stream = cloudinary.uploader.upload_stream(
    //         { folder: 'business_logos' },
    //         (error, result) => {
    //           if (result) resolve(result);
    //           else reject(error);
    //         }
    //       );
    //       stream.end(req.file.buffer);
    //     });
    //   };   

    //   const result = await streamUpload(req);
    //   logoUrl = result.secure_url;
    // }

    const existingProfile = await SABusinessProfile.findOne({ superadmin: req.user.userId });

    if (existingProfile) {
      // Update existing
      existingProfile.businessLogo = logoUrl || existingProfile.businessLogo;
      existingProfile.businessName = req.body.businessName || existingProfile.businessName;
      existingProfile.businessType = req.body.businessType || existingProfile.businessType;
      existingProfile.registrationType = req.body.registrationType || existingProfile.registrationType;
      existingProfile.businessMobileNumber = req.body.businessMobileNumber || existingProfile.businessMobileNumber;
      existingProfile.businessEmail = req.body.businessEmail || existingProfile.businessEmail;
      existingProfile.gstNumber = req.body.gstNumber || existingProfile.gstNumber;
      existingProfile.panNumber = req.body.panNumber || existingProfile.panNumber;
      existingProfile.pinCode = req.body.pinCode || existingProfile.pinCode;
      existingProfile.state = req.body.state || existingProfile.state;
      existingProfile.stateCode = req.body.stateCode || existingProfile.stateCode;
      existingProfile.city = req.body.city || existingProfile.city;
      existingProfile.businessAddress = req.body.businessAddress || existingProfile.businessAddress;

      await existingProfile.save();
      return res.json({ message: 'Business profile updated', businessProfile: existingProfile });
    }

    // Create new
    const businessProfile = new SABusinessProfile({
      superadmin: req.user.userId,
      businessLogo: logoUrl,
      businessName: req.body.businessName,
      businessType: req.body.businessType,
      registrationType: req.body.registrationType,
      businessMobileNumber: req.body.businessMobileNumber,
      businessEmail: req.body.businessEmail, 
      gstNumber: req.body.gstNumber,
      panNumber: req.body.panNumber,
      pinCode: req.body.pinCode,
      state: req.body.state,
      stateCode: req.body.stateCode,
      city: req.body.city,
      businessAddress: req.body.businessAddress,
    });

    await businessProfile.save();
    res.status(201).json({ message: 'Business profile created', businessProfile });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Delete Business Profile
exports.deleteBusinessProfile = async (req, res) => {
  try {
    const profile = await SABusinessProfile.findOneAndDelete({ superadmin: req.user.userId });
    if (!profile) return res.status(404).json({ message: 'Business profile not found' });

    res.json({ message: 'Business profile deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
