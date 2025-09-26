const TicketOptions = require('../models/TicketOptions');

// POST: Add option(s) to a category (single API for all)
exports.addTicketOption = async (req, res) => {
  try {
    const { category, value } = req.body;  // Single: { category: 'services', value: 'New Service' }
    // Or multiple: { category: 'services', values: ['Service1', 'Service2'] }
    const companyId = req.user.companyId || req.user.id;  // From auth middleware

    if (!companyId) {
      return res.status(401).json({ success: false, message: 'Company ID required' });
    }

    if (!category || !['services', 'materials', 'locations', 'cities', 'subjects', 'descriptions'].includes(category)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid category. Valid: services, materials, locations, cities, subjects, descriptions' 
      });
    }

    const valuesToAdd = Array.isArray(value) ? value : [value];  // Handle single or array
    if (!valuesToAdd.length || valuesToAdd.some(v => !v || typeof v !== 'string')) {
      return res.status(400).json({ success: false, message: 'Valid non-empty string value(s) required' });
    }

    // Find or create options doc for company
    let options = await TicketOptions.findOne({ companyId });
    if (!options) {
      options = new TicketOptions({ companyId });
    }

    // Add unique values to the category array
    const categoryField = category;  // e.g., 'services'
    const currentValues = options[categoryField] || [];
    const newValues = valuesToAdd
      .map(v => v.trim().toLowerCase())  // Normalize for uniqueness
      .filter(v => v && !currentValues.some(existing => existing.toLowerCase() === v));  // Avoid duplicates (case-insensitive)

    if (newValues.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No new values added (duplicates or empty)', 
        options: options[categoryField] 
      });
    }

    // Add normalized values (but store original casing if needed; here we store trimmed original)
    const originalNewValues = valuesToAdd.map(v => v.trim()).filter((v, idx) => newValues.includes(v.toLowerCase()));
    options[categoryField] = [...currentValues, ...originalNewValues];

    await options.save();

    res.status(201).json({ 
      success: true, 
      message: `${newValues.length} new value(s) added to ${category}`,
      category,
      added: originalNewValues,
      total: options[categoryField].length
    });
  } catch (err) {
    console.error('Add option error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET: Fetch all options for dropdowns
exports.getTicketOptions = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user.id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: 'Company ID required' });
    }

    const options = await TicketOptions.findOne({ companyId });

    if (!options) {
      // Return empty structure if no options yet
      return res.json({ 
        success: true, 
        options: {
          services: [],
          materials: [],
          locations: [],
          cities: [],
          subjects: [],
          descriptions: []
        }
      });
    }

    // Ensure all fields exist (init if missing)
    const fullOptions = {
      services: options.services || [],
      materials: options.materials || [],
      locations: options.locations || [],
      cities: options.cities || [],
      subjects: options.subjects || [],
      descriptions: options.descriptions || []
    };

    res.json({ success: true, options: fullOptions });
  } catch (err) {
    console.error('Get options error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
