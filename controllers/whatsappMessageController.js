const WhatsappMessage = require('../models/WhatsappMessage');

// Create a new WhatsApp message template
exports.createTemplate = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { title, message, location } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const template = new WhatsappMessage({
      company: companyId,
      title,
      message,
      location,
      messageType: 'template'
    });

    await template.save();
    res.status(201).json({ message: 'Template created successfully', template });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all templates for a specific company
exports.getTemplatesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const templates = await WhatsappMessage.find({ company: companyId, title: { $exists: true } }).sort({ createdAt: -1 });
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a template
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, location } = req.body;

    const template = await WhatsappMessage.findById(id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (title) template.title = title;
    if (message) template.message = message;
    if (location !== undefined) template.location = location;

    await template.save();
    res.status(200).json({ message: 'Template updated successfully', template });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a template
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await WhatsappMessage.findByIdAndDelete(id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
