//controllers/leadController.js
const Lead = require('../models/Lead');

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


exports.createLead = async (req, res) => {
  try {
    const {
      workflow,
      stage,
      title,
      description,
      product,
      customer,
      department,
      teamMember,
      amount,
      endDate,
      location,
      source,
      images,
      audioRecording,
      documentUpload,
      sendWhatsappNotification,
    } = req.body;

    if (!title ) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const lead = new Lead({
      workflow,
      stage,
      title,
      description,
      product,
      customer,
      department,
      teamMember,
      amount,
      endDate,
      location,
      source,
      images,
      audioRecording,
      documentUpload,
      sendWhatsappNotification,
    });

    await lead.save();

    // Optionally, trigger WhatsApp notification here if sendWhatsappNotification is true

    res.status(201).json({ message: 'Lead created successfully', lead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const leads = await Lead.find()
      .populate('workflow')
      .populate('product')
      .populate('customer')
      .populate('department')
      .populate('teamMember');

    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('workflow')
      .populate('product')
      .populate('customer')
      .populate('department')
      .populate('teamMember');

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Update Lead
exports.updateLead = async (req, res) => {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedLead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.status(200).json({ message: 'Lead updated successfully', lead: updatedLead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Lead
exports.deleteLead = async (req, res) => {
  try {
    const deletedLead = await Lead.findByIdAndDelete(req.params.id);

    if (!deletedLead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.status(200).json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};