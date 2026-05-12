const WhatsappMessage = require('../models/WhatsappMessage');

// Create a new WhatsApp message template
exports.createTemplate = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { title, message, location, sequence } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    let sequenceValue = sequence;
    if (sequenceValue === undefined || sequenceValue === null) {
      const lastTemplate = await WhatsappMessage.findOne({ company: companyId, title: { $exists: true } })
        .sort({ sequence: -1, createdAt: -1 })
        .select('sequence');
      sequenceValue = lastTemplate ? lastTemplate.sequence + 1 : 1;
    }

    const template = new WhatsappMessage({
      company: companyId,
      title,
      message,
      location,
      sequence: sequenceValue,
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
    
    const templates = await WhatsappMessage.find({ company: companyId, title: { $exists: true } })
      .sort({ sequence: 1, createdAt: -1 });
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
    const { title, message, location, sequence } = req.body;

    const template = await WhatsappMessage.findById(id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (title) template.title = title;
    if (message) template.message = message;
    if (location !== undefined) template.location = location;
    if (sequence !== undefined && sequence !== null) template.sequence = sequence;

    await template.save();
    res.status(200).json({ message: 'Template updated successfully', template });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Bulk reorder templates by supplying an ordered list of template IDs or objects
exports.reorderTemplates = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { order } = req.body;

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ message: 'Order must be a non-empty array' });
    }

    const operations = order.map((item, index) => {
      const templateId = typeof item === 'object' && item._id ? item._id : item;
      return {
        updateOne: {
          filter: { _id: templateId, company: companyId },
          update: { $set: { sequence: index + 1 } }
        }
      };
    });

    await WhatsappMessage.bulkWrite(operations);

    const templates = await WhatsappMessage.find({ company: companyId, title: { $exists: true } })
      .sort({ sequence: 1, createdAt: -1 });

    res.status(200).json({ message: 'Template order updated successfully', templates });
  } catch (error) {
    console.error('Error reordering templates:', error);
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
