const Company = require('../models/Company');
const Franchise = require('../models/Franchise');
const Employee = require('../models/Employee');
const mongoose = require('mongoose');

// GET: All registered companies (paginated, populated)
exports.getAllCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter (optional search by businessName)
    const filter = {};
    if (search) {
      filter.businessName = { $regex: search, $options: 'i' };
    }

    const companies = await Company.find(filter)
      .populate('franchise', 'franchiseName franchiseEmail')  // Populate franchise details
      .populate('superadmin', 'name email')  // If Superadmin model exists
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Company.countDocuments(filter);

    res.json({
      success: true,
      companies,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get companies error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET: All franchises (paginated)
exports.getAllFranchises = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (search) {
      filter.franchiseName = { $regex: search, $options: 'i' };
    }

    const franchises = await Franchise.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Franchise.countDocuments(filter);

    res.json({
      success: true,
      franchises,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get franchises error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET: All employees (paginated, aggregated by company if needed)
exports.getAllEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 20, companyId = '', search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {};
    if (companyId) {
      filter.company = companyId;  // Assuming company is _id string
    }
    if (search) {
      filter.$or = [
        { teamMemberName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const employees = await Employee.find(filter)
      .select('-password')  // Exclude sensitive fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Employee.countDocuments(filter);

    // Optional: Aggregate summary by company
    const companySummary = await Employee.aggregate([
      { $match: filter },
      { $group: { _id: '$company', count: { $sum: 1 } } },
      { $lookup: { from: 'companies', localField: '_id', foreignField: '_id', as: 'companyDetails' } },
      { $project: { companyName: { $arrayElemAt: ['$companyDetails.businessName', 0] }, count: 1 } }
    ]);

    res.json({
      success: true,
      employees,
      companySummary,  // e.g., [{ companyName: 'ABC Corp', count: 15 }]
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET: Monthly company registrations for current year (for graph) - FIXED
exports.getMonthlyCompanyRegistrations = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 12, 0);  // End of Dec (fixed: was new Date(currentYear + 1, 0, 1))

    const monthlyData = await Company.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear, $lte: endOfYear }  // Use $lte for end of year
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.month': 1 }  // Sort by month ascending
      },
      {
        $project: {
          month: {
            $arrayElemAt: [
              [
                'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
              ],
              { $subtract: [ '$_id.month', 1 ] }  // FIXED: Direct $_id.month reference
            ]
          },
          count: 1,
          _id: 0
        }
      }
    ]);

    // Fill missing months with 0 (unchanged)
    const fullYearData = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthNames.forEach((month) => {
      const data = monthlyData.find(d => d.month === month) || { month, count: 0 };
      fullYearData.push(data);
    });

    res.json({
      success: true,
      year: currentYear,
      monthlyRegistrations: fullYearData  // e.g., [{ month: 'Jan', count: 5 }, ...]
    });
  } catch (err) {
    console.error('Get monthly registrations error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// GET: Company subscriptions (summary + list)
exports.getCompanySubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 20, plan = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Filter by plan if specified
    const filter = plan ? { businessSubscriptionPlan: plan } : {};

    // Summary: Count per plan
    const subscriptionSummary = await Company.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$businessSubscriptionPlan',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // List: Paginated companies with plan
    const companies = await Company.find(filter)
      .select('businessName businessSubscriptionPlan businessCreatedDate createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Company.countDocuments(filter);

    res.json({
      success: true,
      subscriptionSummary,  // e.g., [{ _id: 'Basic', count: 10 }, { _id: 'Premium', count: 5 }]
      companies,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get subscriptions error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
