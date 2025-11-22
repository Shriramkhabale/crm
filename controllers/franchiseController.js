const Franchise = require('../models/Franchise');

// Create Franchise
// exports.createFranchise = async (req, res) => {
//   try {
//     const { franchiseName, franchiseEmail, franchisePhone, password, createdDate, address, userlimit, planPrice, duration, franchiseLogo } = req.body;

//     const existing = await Franchise.findOne({ franchiseEmail });
//     if (existing) return res.status(400).json({ message: 'Franchise email already exists' });

//     const franchise = new Franchise({
//       superadmin: req.user.id,
//       franchiseName,
//       franchisePhone,
//       franchiseEmail,
//       password,
//       createdDate,
//       address,
//       userlimit,
//       planPrice,
//       duration,
//       franchiseLogo
//     });

//     await franchise.save();
//     res.status(201).json({ message: 'Franchise created', franchise });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error });
//   }
// };


exports.createFranchiseWithLogo = async (req, res) => {
  try {
    const {
      franchiseName,
      franchiseEmail,
      franchisePhone,
      password,
      createdDate,
      address,
      userlimit,
      planPrice,
      duration,
      startDate,
      endDate
    } = req.body;

    const existing = await Franchise.findOne({ franchiseEmail });
    if (existing) return res.status(400).json({ message: 'Franchise email already exists' });

    const franchiseLogo = req.file ? req.file.path : undefined;

    const franchise = new Franchise({
      superadmin: req.user.id,
      franchiseName,
      franchisePhone,
      franchiseEmail,
      password,
      createdDate,
      address,
      userlimit,
      planPrice,
      duration,
      startDate,
      endDate,
      franchiseLogo
    });

    await franchise.save();
    res.status(201).json({ message: 'Franchise created', franchise });
  } catch (error) {
    console.error('Create franchise error:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};


exports.getFranchiseById = async (req, res) => {
  try {
    const franchise = await Franchise.findById(req.params.id);
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    res.json(franchise);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};


// Get all franchises for superadmin
exports.getFranchises = async (req, res) => {
  try {
    const franchises = await Franchise.find({ superadmin: req.user.id });
    res.json(franchises);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Update Franchise
// exports.updateFranchise = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const franchise = await Franchise.findOne({ _id: id, superadmin: req.user.id });
//     if (!franchise) return res.status(404).json({ message: 'Franchise not found' });

//     Object.assign(franchise, req.body);
//     await franchise.save();

//     res.json({ message: 'Franchise updated', franchise });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error });
//   }
// };


exports.updateFranchiseWithLogo = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (req.file) {
      updateData.franchiseLogo = req.file.path;
    }

    const franchise = await Franchise.findOne({ _id: id, superadmin: req.user.id });
    if (!franchise) return res.status(404).json({ message: 'Franchise not found' });

    Object.assign(franchise, updateData);
    await franchise.save();

    res.json({ message: 'Franchise updated', franchise });
  } catch (error) {
    console.error('Update franchise error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete Franchise
exports.deleteFranchise = async (req, res) => {
  try {
    const { id } = req.params;
    const franchise = await Franchise.findOneAndDelete({ _id: id, superadmin: req.user.id });
    if (!franchise) return res.status(404).json({ message: 'Franchise not found' });

    res.json({ message: 'Franchise deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
