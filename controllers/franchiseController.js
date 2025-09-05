const Franchise = require('../models/Franchise');

// Create Franchise
exports.createFranchise = async (req, res) => {
  try {
    const { franchiseName, franchiseEmail, franchisePhone, password, createdDate, address, franchiseLogo } = req.body;

    const existing = await Franchise.findOne({ franchiseEmail });
    if (existing) return res.status(400).json({ message: 'Franchise email already exists' });

    const franchise = new Franchise({
      superadmin: req.user.userId,
      franchiseName,
      franchisePhone,
      franchiseEmail,
      password,
      createdDate,
      address,
      franchiseLogo
    });

    await franchise.save();
    res.status(201).json({ message: 'Franchise created', franchise });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
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
    const franchises = await Franchise.find({ superadmin: req.user.userId });
    res.json(franchises);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Update Franchise
exports.updateFranchise = async (req, res) => {
  try {
    const { id } = req.params;
    const franchise = await Franchise.findOne({ _id: id, superadmin: req.user.userId });
    if (!franchise) return res.status(404).json({ message: 'Franchise not found' });

    Object.assign(franchise, req.body);
    await franchise.save();

    res.json({ message: 'Franchise updated', franchise });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Delete Franchise
exports.deleteFranchise = async (req, res) => {
  try {
    const { id } = req.params;
    const franchise = await Franchise.findOneAndDelete({ _id: id, superadmin: req.user.userId });
    if (!franchise) return res.status(404).json({ message: 'Franchise not found' });

    res.json({ message: 'Franchise deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
