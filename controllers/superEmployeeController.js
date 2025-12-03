const SuperEmployee = require('../models/SuperEmployee');
const bcrypt = require('bcryptjs');

// Create SuperEmployee
exports.createSuperEmployee = async (req, res) => {
    try {
        const {
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

        // IMPORTANT: Set superadmin/franchise based on logged-in user
        let superadminId = null;
        let franchiseId = null;

        if (req.user.role === 'superadmin') {
            superadminId = req.user.id;
        } else if (req.user.role === 'super_employee') {
            // Super employees can only create super employees under their superadmin
            superadminId = req.user.superadmin;
            if (!superadminId) {
                return res.status(400).json({ 
                    message: 'Super employee has no associated superadmin' 
                });
            }
        } else if (req.user.role === 'franchise') {
            franchiseId = req.user.id;
        }

        // Create new super employee
        const superEmployee = new SuperEmployee({
            superadmin: superadminId,
            franchise: franchiseId,
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
        const { isActive, search } = req.query;

        // Build query
        let query = {};

        // SUPER IMPORTANT: Filter by user role
        // If user is super_employee, only show super employees under their superadmin
        if (req.user.role === 'super_employee') {
            console.log('Super_employee accessing super employees list');
            console.log('Super_employee superadmin ID:', req.user.superadmin);
            
            if (!req.user.superadmin) {
                return res.status(400).json({ 
                    message: 'Super employee has no associated superadmin' 
                });
            }
            
            query.superadmin = req.user.superadmin;
            console.log('Query for super_employee:', query);
        }
        // If user is superadmin, only show super employees they created
        else if (req.user.role === 'superadmin') {
            query.superadmin = req.user.id;
            console.log('Query for superadmin:', query);
        }
        // If user is franchise, only show super employees under their franchise
        else if (req.user.role === 'franchise') {
            query.franchise = req.user.id;
            console.log('Query for franchise:', query);
        }
        // Other roles shouldn't access this endpoint
        else {
            console.log('Unauthorized role trying to access super employees:', req.user.role);
            return res.status(403).json({ 
                message: 'Unauthorized to view super employees' 
            });
        }

        // Additional filters
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

        console.log('Final query for super employees:', query);

        const superEmployees = await SuperEmployee.find(query)
            .select('-password')
            .populate('superadmin', 'name email')
            .populate('franchise', 'businessName email')
            .sort({ createdAt: -1 });

        console.log('Found super employees:', superEmployees.length);

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

// Get SuperEmployee by ID - Updated with authorization
exports.getSuperEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;

        // Build query with authorization
        let query = { _id: id };

        if (req.user.role === 'super_employee') {
            if (!req.user.superadmin) {
                return res.status(400).json({ 
                    message: 'Super employee has no associated superadmin' 
                });
            }
            query.superadmin = req.user.superadmin;
        } else if (req.user.role === 'superadmin') {
            query.superadmin = req.user.id;
        } else if (req.user.role === 'franchise') {
            query.franchise = req.user.id;
        } else {
            return res.status(403).json({ 
                message: 'Unauthorized to view super employee' 
            });
        }

        const superEmployee = await SuperEmployee.findOne(query)
            .select('-password')
            .populate('superadmin', 'name email')
            .populate('franchise', 'businessName email');

        if (!superEmployee) {
            return res.status(404).json({ message: 'Super Employee not found or access denied' });
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
