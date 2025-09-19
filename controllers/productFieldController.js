const ProductField = require('../models/ProductField');

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

// Create a new product field
exports.createProductField = async (req, res) => {
  try {
    const { fieldName, dataType, isRequired, showTable  } = req.body;
     const company = await getCompanyIdFromUser (req.user);

    
    if (!fieldName || !dataType  ) {
      return res.status(400).json({ message: 'fieldName and dataType are required' });
    }

    const existing = await ProductField.findOne({ fieldName});
    if (existing) {
      return res.status(400).json({ message: 'Field name must be unique' });
    }

    const productField = new ProductField({
      fieldName,
      dataType,
      isRequired: isRequired || false,
      showTable: showTable || false,
      company,
    });

    await productField.save();

    res.status(201).json({ message: 'Product field created successfully', productField });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all product fields
exports.getAllProductFields = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const productFields = await ProductField.find({ company }).sort({ createdAt: -1 });
    res.json(productFields);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get product field by ID
exports.getProductFieldById = async (req, res) => {
  try {
    const { id } = req.params;
    const productField = await ProductField.findById(id);
    if (!productField) {
      return res.status(404).json({ message: 'Product field not found' });
    }
    res.json(productField);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update product field by ID
exports.updateProductField = async (req, res) => {
  try {
    const { id } = req.params;
    const { fieldName, dataType, isRequired, showTable } = req.body;

    const productField = await ProductField.findById(id);
    if (!productField) {
      return res.status(404).json({ message: 'Product field not found' });
    }

    if (fieldName) productField.fieldName = fieldName;
    if (dataType) productField.dataType = dataType;
    if (typeof isRequired === 'boolean') productField.isRequired = isRequired;
    if (typeof showTable === 'boolean') productField.showTable = showTable;

    await productField.save();

    res.json({ message: 'Product field updated successfully', productField });
  } catch (error) {
    // Handle duplicate key error for unique fieldName
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Field name must be unique' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Delete product field by ID
exports.deleteProductField = async (req, res) => {
  try {
    const { id } = req.params;
    const productField = await ProductField.findByIdAndDelete(id);
    if (!productField) {
      return res.status(404).json({ message: 'Product field not found' });
    }
    res.json({ message: 'Product field deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
