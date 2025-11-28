const SuperEmployee = require('../models/SuperEmployee');
const bcrypt = require('bcryptjs');

// Create SuperEmployee
exports.createSuperEmployee = async (req, res) => {
    try {
        const {
            superadmin,
            franchise,
            teamMemberName,
            mobileNumber,
            email,
            password,
            isActive = true,
            accessPermissions = []
        } = req.body;

        // Validation
        if (!teamMemberName || !mobileNumber || !email || !password) {
            return res.status(400).json({
                message: 'All required fields must be provided (teamMemberName, mobileNumber, email, password)'
            });
        }

        // Check if email already exists
        const existingSuperEmployee = await SuperEmployee.findOne({ email });
        if (existingSuperEmployee) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Validate access permissions
        const validPermissions = ['companies', 'franchises', 'subscription', 'super_employee'];
        const parsedPermissions = Array.isArray(accessPermissions) ? accessPermissions : [];
        const invalidPermissions = parsedPermissions.filter(p => !validPermissions.includes(p));

        if (invalidPermissions.length > 0) {
            return res.status(400).json({
                message: `Invalid permissions: ${invalidPermissions.join(', ')}. Valid options are: ${validPermissions.join(', ')}`
            });
        }

        // Create new super employee
        const superEmployee = new SuperEmployee({
            superadmin: superadmin || null,
            franchise: franchise || null,
            teamMemberName,
            mobileNumber,
            email,
            password,
            isActive,
            accessPermissions: parsedPermissions
        });

        await superEmployee.save();

        // Remove password from response
        const superEmployeeResponse = superEmployee.toObject();
        delete superEmployeeResponse.password;

        res.status(201).json({
            message: 'Super Employee created successfully',
            superEmployee: superEmployeeResponse
        });
    } catch (error) {
        console.error('Create SuperEmployee error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all SuperEmployees
exports.getAllSuperEmployees = async (req, res) => {
    try {
        const { isActive, search, superadmin, franchise } = req.query;

        // Build query
        let query = {};

        // Filter by superadmin or franchise
        if (superadmin) {
            query.superadmin = superadmin;
        }
        if (franchise) {
            query.franchise = franchise;
        }

        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        if (search) {
            query.$or = [
                { teamMemberName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { mobileNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const superEmployees = await SuperEmployee.find(query)
            .select('-password')
            .populate('superadmin', 'name email')
            .populate('franchise', 'businessName email')
            .sort({ createdAt: -1 });

        res.json({
            message: 'Super Employees retrieved successfully',
            count: superEmployees.length,
            superEmployees
        });
    } catch (error) {
        console.error('Get all SuperEmployees error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get SuperEmployee by ID
exports.getSuperEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;

        const superEmployee = await SuperEmployee.findById(id)
            .select('-password')
            .populate('superadmin', 'name email')
            .populate('franchise', 'businessName email');

        if (!superEmployee) {
            return res.status(404).json({ message: 'Super Employee not found' });
        }

        res.json({
            message: 'Super Employee retrieved successfully',
            superEmployee
        });
    } catch (error) {
        console.error('Get SuperEmployee by ID error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update SuperEmployee
exports.updateSuperEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            superadmin,
            franchise,
            teamMemberName,
            mobileNumber,
            email,
            password,
            isActive,
            accessPermissions
        } = req.body;

        const superEmployee = await SuperEmployee.findById(id);

        if (!superEmployee) {
            return res.status(404).json({ message: 'Super Employee not found' });
        }

        // Check email uniqueness if email is being changed
        if (email && email !== superEmployee.email) {
            const existingEmail = await SuperEmployee.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ message: 'Email already exists' });
            }
            superEmployee.email = email;
        }

        // Update fields if provided
        if (superadmin !== undefined) superEmployee.superadmin = superadmin || null;
        if (franchise !== undefined) superEmployee.franchise = franchise || null;
        if (teamMemberName !== undefined) superEmployee.teamMemberName = teamMemberName;
        if (mobileNumber !== undefined) superEmployee.mobileNumber = mobileNumber;
        if (isActive !== undefined) superEmployee.isActive = isActive;

        // Update access permissions if provided
        if (accessPermissions !== undefined) {
            const validPermissions = ['companies', 'franchises', 'subscription', 'super_employee'];
            const parsedPermissions = Array.isArray(accessPermissions) ? accessPermissions : [];
            const invalidPermissions = parsedPermissions.filter(p => !validPermissions.includes(p));

            if (invalidPermissions.length > 0) {
                return res.status(400).json({
                    message: `Invalid permissions: ${invalidPermissions.join(', ')}`
                });
            }

            superEmployee.accessPermissions = parsedPermissions;
        }

        // Update password if provided (will be hashed by pre-save hook)
        if (password) {
            superEmployee.password = password;
        }

        await superEmployee.save();

        // Remove password from response
        const superEmployeeResponse = superEmployee.toObject();
        delete superEmployeeResponse.password;

        res.json({
            message: 'Super Employee updated successfully',
            superEmployee: superEmployeeResponse
        });
    } catch (error) {
        console.error('Update SuperEmployee error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete SuperEmployee
exports.deleteSuperEmployee = async (req, res) => {
    try {
        const { id } = req.params;

        const superEmployee = await SuperEmployee.findById(id);

        if (!superEmployee) {
            return res.status(404).json({ message: 'Super Employee not found' });
        }

        await SuperEmployee.findByIdAndDelete(id);

        res.json({ message: 'Super Employee deleted successfully' });
    } catch (error) {
        console.error('Delete SuperEmployee error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Toggle SuperEmployee Active Status
exports.toggleSuperEmployeeStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const superEmployee = await SuperEmployee.findById(id);

        if (!superEmployee) {
            return res.status(404).json({ message: 'Super Employee not found' });
        }

        superEmployee.isActive = !superEmployee.isActive;
        await superEmployee.save();

        // Remove password from response
        const superEmployeeResponse = superEmployee.toObject();
        delete superEmployeeResponse.password;

        res.json({
            message: `Super Employee ${superEmployee.isActive ? 'activated' : 'deactivated'} successfully`,
            superEmployee: superEmployeeResponse
        });
    } catch (error) {
        console.error('Toggle SuperEmployee status error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
