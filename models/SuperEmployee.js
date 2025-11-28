const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superEmployeeSchema = new mongoose.Schema({
    superadmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Superadmin',
        default: null
    },
    franchise: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Franchise',
        default: null
    },
    teamMemberName: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    mobileNumber: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['super_employee'],
        default: 'super_employee'
    },
    password: {
        type: String,
        required: true
    },
    accessPermissions: {
        type: [String],
        default: [],
        enum: [
            'companies',
            'franchises',
            'subscription',
            'super_employee'
        ],
    },
}, { timestamps: true });

// Hash password before saving
superEmployeeSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Method to compare password for login
superEmployeeSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('SuperEmployee', superEmployeeSchema);
