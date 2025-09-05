const mongoose = require('mongoose');
const companySchema = new mongoose.Schema({
  superadmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Superadmin ',
    required: true,
  },
  franchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: false, 
  },
  businessName: { type: String, required: true },
  businessEmail: { type: String, required: true},
  businessPhone: { type: String },
  EmergencyMobNo:{ type: String },
  password:{type:String},
  businessCreatedDate: {type:Date},
  businessSubscriptionPlan: {type: String},
  weeklyHoliday:{type:Array},
  address: { type: String },
  businessLogo: { type: String },
}, { timestamps: true });
module.exports = mongoose.model('Company', companySchema);