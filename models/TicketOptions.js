const mongoose = require('mongoose');

const TicketOptionsSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,  // Ref to Company
      required: true,
      unique: true  // One doc per company
    },
    services: [{  // Array of service names
      type: String,
      trim: true
    }],
    materials: [{  // Array of material names
      type: String,
      trim: true
    }],
    locations: [{  // Array of location names (e.g., 'Branch Office A')
      type: String,
      trim: true
    }],
    cities: [{  // Array of city names
      type: String,
      trim: true
    }],
    subjects: [{  // Array of subject templates
      type: String,
      trim: true
    }],
    descriptions: [{  // Array of description templates
      type: String,
      trim: true
    }]
  },
  { timestamps: true }
);

// Index for fast queries
TicketOptionsSchema.index({ companyId: 1 });

module.exports = mongoose.model('TicketOptions', TicketOptionsSchema);