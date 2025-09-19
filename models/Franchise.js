const mongoose = require('mongoose');
const franchiseSchema = new mongoose.Schema({
  superadmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Superadmin ',
    required: true,
  },
  franchiseName: { type: String, required: true },  
  franchisePhone: { type: String, required: true, unique: true },
  franchiseEmail: { type: String, required: true},
  password: { type: String, required: true},
  createdDate: { type: String },
  address: { type: String },
  userlimit: { type: String },
  planPrice: { type: String },
  duration: { type: String },
  franchiseLogo: { type: String },  
}, { timestamps: true });

module.exports = mongoose.model('Franchise', franchiseSchema); 