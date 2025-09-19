const Customer = require('../models/Customer');
const CustomerGroupType = require('../models/CustomerGrpType')

exports.createCustomer = async (req, res) => {
  try {
    const {
      fullName,
      whatsappNumber,
      alternativeMobileNumber,
      email,
      city,
      groupType,
      address,
      customFields
    } = req.body;

    if (!fullName || !whatsappNumber) {
      return res.status(400).json({ message: 'Full Name and WhatsApp Number are required' });
    }

    const customer = new Customer({
      fullName,
      whatsappNumber,
      alternativeMobileNumber,
      email,
      city,
      groupType,
      address,
      customFields
    });

    await customer.save();

    res.status(201).json({ message: 'Customer created', customer });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const filter = {};

    // Optional filters, e.g. by city or groupType
    if (req.query.city) filter.city = req.query.city;
    if (req.query.groupType) filter.groupType = req.query.groupType;

    const customers = await Customer.find(filter)
      .populate('groupType', 'name')
      .sort({ fullName: 1 });

    res.json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id).populate('groupType', 'name');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ customer });
  } catch (error) {
    console.error('Get customer by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const customer = await Customer.findByIdAndUpdate(id, updates, { new: true });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer updated', customer });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findByIdAndDelete(id);

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
