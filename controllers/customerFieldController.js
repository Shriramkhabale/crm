const CustomerField = require('../models/CustomerField');

const Employee = require('../models/Employee');

async function getCompanyIdFromUser (user) {
  if (user.role === 'company') {
    return user.userId; // userId is companyId
  } else{
    // Find employee by userId and get companyId
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  } 
}

// Create a new customer field
exports.createCustomerField = async (req, res) => {
  try {
    const { fieldName, dataType, isRequired, showTable  } = req.body;
     const company = await getCompanyIdFromUser (req.user);

    
    if (!fieldName || !dataType  ) {
      return res.status(400).json({ message: 'fieldName and dataType are required' });
    }

    const existing = await CustomerField.findOne({ fieldName});
    if (existing) {
      return res.status(400).json({ message: 'Field name must be unique' });
    }

    const customerField = new CustomerField({
      fieldName,
      dataType,
      isRequired: isRequired || false,
      showTable: showTable || false,
      company,
    });

    await customerField.save();

    res.status(201).json({ message: 'Customer field created successfully', customerField });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all customer fields
exports.getAllCustomerFields = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const customerFields = await CustomerField.find({ company }).sort({ createdAt: -1 });
    res.json(customerFields);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get customer field by ID
exports.getCustomerFieldById = async (req, res) => {
  try {
    const { id } = req.params;
    const customerField = await CustomerField.findById(id);
    if (!customerField) {
      return res.status(404).json({ message: 'Customer field not found' });
    }
    res.json(customerField);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update customer field by ID
exports.updateCustomerField = async (req, res) => {
  try {
    const { id } = req.params;
    const { fieldName, dataType, isRequired, showTable } = req.body;

    const customerField = await CustomerField.findById(id);
    if (!customerField) {
      return res.status(404).json({ message: 'Customer field not found' });
    }

    if (fieldName) customerField.fieldName = fieldName;
    if (dataType) customerField.dataType = dataType;
    if (typeof isRequired === 'boolean') customerField.isRequired = isRequired;
    if (typeof showTable === 'boolean') customerField.showTable = showTable;

    await customerField.save();

    res.json({ message: 'Customer field updated successfully', customerField });
  } catch (error) {
    // Handle duplicate key error for unique fieldName
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Field name must be unique' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Delete customer field by ID
exports.deleteCustomerField = async (req, res) => {
  try {
    const { id } = req.params;
    const customerField = await CustomerField.findByIdAndDelete(id);
    if (!customerField) {
      return res.status(404).json({ message: 'Customer field not found' });
    }
    res.json({ message: 'Customer field deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
