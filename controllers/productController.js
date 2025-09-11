// controller/productController.js
const Product = require('../models/Product');
const ProductField = require('../models/ProductField');

exports.getProductFieldsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const fields = await ProductField.find({ company: companyId }).sort({ createdAt: 1 });

    res.json({ fields });
  } catch (error) {
    console.error('Get product fields error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { name, workflow, customFieldValues } = req.body;  // <-- use customFieldValues

    if (!name || !workflow) {
      return res.status(400).json({ message: 'Name and Workflow are required' });
    }

    const product = new Product({ name, workflow, customFieldValues });  // <-- pass customFieldValues

    await product.save();

    res.status(201).json({ message: 'Product created', product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const filter = {};

    // Optional filters, e.g. by workflow
    if (req.query.workflow) filter.workflow = req.query.workflow;

    const products = await Product.find(filter)
      .populate('workflow', 'name') // assuming workflow has a name field
      .sort({ name: 1 });

    res.json({ products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).populate('workflow', 'name');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, workflow, customFieldValues } = req.body;

    const updates = { name, workflow };
    if (customFieldValues) updates.customFieldValues = customFieldValues;

    const product = await Product.findByIdAndUpdate(id, updates, { new: true });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product updated', product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};