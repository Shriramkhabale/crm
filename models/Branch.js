const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const branchSchema = new mongoose.Schema({
  company: {type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    franchise: { type: mongoose.Schema.Types.ObjectId, ref: 'Franchise' },
  
  name: { type: String, required: true, trim: true},
  password: { type: String, required: true },
  address: {type: String },
  phone: {type: String},
  email: {type: String, required: true, unique: true, lowercase: true},
}, { timestamps: true });


// Hash password before saving
branchSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});


module.exports = mongoose.model('Branch', branchSchema);