const SubscriptionPlan = require('../models/SubscriptionPlan');

// Create a new subscription plan
exports.createPlan = async (req, res) => {
  try {
    const {
      title,
      userLimit,
      managerLimit,
      duration,
      price,
      access
    } = req.body;

    if (!title || !duration || price === undefined) {
      return res.status(400).json({ message: 'Title, duration, and price are required' });
    }

    // Validate duration with new options
    const validDurations = ['7-day', '15-day', 'monthly', 'quarterly', 'yearly', '2-year'];
    if (!validDurations.includes(duration)) {
      return res.status(400).json({ 
        message: `Duration must be one of: ${validDurations.join(', ')}` 
      });
    }

    const plan = new SubscriptionPlan({
      title,
      userLimit: userLimit || 0,
      managerLimit: managerLimit || 0,
      duration,
      price,
      access: {
        task: !!access?.task,
        lead: !!access?.lead,
        hrms: !!access?.hrms,
        support: !!access?.support,
        projectManagement: !!access?.projectManagement,
      }
    });

    await plan.save();

    res.status(201).json({ message: 'Subscription plan created', plan });
  } catch (error) {
    console.error('Create subscription plan error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all subscription plans
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ 
      // Custom sorting: trial plans first, then by duration
      price: 1,
      createdAt: -1 
    });
    res.json({ plans });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get subscription plan by ID
exports.getPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }
    res.json({ plan });
  } catch (error) {
    console.error('Get subscription plan by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update subscription plan by ID
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.duration) {
      const validDurations = ['7-day', '15-day', 'monthly', 'quarterly', 'yearly', '2-year'];
      if (!validDurations.includes(updateData.duration)) {
        return res.status(400).json({ 
          message: `Duration must be one of: ${validDurations.join(', ')}` 
        });
      }
    }

    if (updateData.access) {
      // Ensure boolean values
      updateData.access = {
        task: !!updateData.access.task,
        lead: !!updateData.access.lead,
        hrms: !!updateData.access.hrms,
        support: !!updateData.access.support,
        projectManagement: !!updateData.access.projectManagement,
      };
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    res.json({ message: 'Subscription plan updated', plan });
  } catch (error) {
    console.error('Update subscription plan error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete subscription plan by ID
exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findByIdAndDelete(id);
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }
    res.json({ message: 'Subscription plan deleted' });
  } catch (error) {
    console.error('Delete subscription plan error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function to calculate plan duration in days (optional)
exports.calculateDurationInDays = (duration) => {
  const durationMap = {
    '7-day': 7,
    '15-day': 15,
    'monthly': 30,
    'quarterly': 90,
    'yearly': 365,
    '2-year': 730
  };
  return durationMap[duration] || 0;
};