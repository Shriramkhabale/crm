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
      accessPermissions,
      userLimits
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
      accessPermissions: {
        taskManagement: !!accessPermissions?.taskManagement,
        leadManagement: !!accessPermissions?.leadManagement,
        hrms: !!accessPermissions?.hrms,
        support: !!accessPermissions?.support,
        projectManagement: !!accessPermissions?.projectManagement,
      },
      userLimits: {
        taskManagement: userLimits?.taskManagement || 0,
        leadManagement: userLimits?.leadManagement || 0,
        hrms: userLimits?.hrms || 0,
        support: userLimits?.support || 0,
        projectManagement: userLimits?.projectManagement || 0,
      }
    });

    await plan.save();

    // Return the full plan object, including defaults
    const savedPlan = await SubscriptionPlan.findById(plan._id);

    res.status(201).json({ message: 'Subscription plan created', plan: savedPlan });
  } catch (error) {
    console.error('Create subscription plan error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all subscription plans
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({
      price: 1,
      createdAt: -1,
    });

    const formattedPlans = plans.map(plan => {
      const access = [];
      if (plan.accessPermissions) {
        if (plan.accessPermissions.taskManagement) access.push('Task');
        if (plan.accessPermissions.leadManagement) access.push('Lead');
        if (plan.accessPermissions.hrms) access.push('HRMS');
        if (plan.accessPermissions.support) access.push('Support');
        if (plan.accessPermissions.projectManagement) access.push('PM');
      }

      const limits = [];
      if (plan.userLimits) {
        if (plan.userLimits.taskManagement) limits.push(`Task (${plan.userLimits.taskManagement})`);
        if (plan.userLimits.leadManagement) limits.push(`Lead (${plan.userLimits.leadManagement})`);
        if (plan.userLimits.hrms) limits.push(`HRMS (${plan.userLimits.hrms})`);
        if (plan.userLimits.support) limits.push(`Support (${plan.userLimits.support})`);
        if (plan.userLimits.projectManagement) limits.push(`PM (${plan.userLimits.projectManagement})`);
      }

      return {
        ...plan.toObject(),
        access,
        limits,
      };
    });

    res.json({ plans: formattedPlans });
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

    // Always ensure nested objects are correctly handled, even if partially sent
    const existingPlan = await SubscriptionPlan.findById(id);
    if (!existingPlan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    // Merge accessPermissions
    if (updateData.accessPermissions) {
      updateData.accessPermissions = {
        ...existingPlan.accessPermissions,
        ...updateData.accessPermissions
      };
    }

    // Merge userLimits
    if (updateData.userLimits) {
      updateData.userLimits = {
        ...existingPlan.userLimits,
        ...updateData.userLimits
      };
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
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