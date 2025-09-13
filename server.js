//server.js
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const franchiseRoutes = require('./routes/franchiseRoutes');
const companyRoutes = require('./routes/companyRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const todosRoutes = require('./routes/todosRoutes');
const tasksRoutes = require('./routes/taskRoutes');
const leadRoutes = require('./routes/leadRoutes');
const productFieldRoutes = require('./routes/productFieldRoutes');
const projectMgntRoutes = require('./routes/projectMgntRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const designationRoutes = require('./routes/designationRoutes');
const workflowRoutes = require('./routes/workFlowRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const milestoneRoutes = require('./routes/milestoneRoutes');
const customerGrpTypeRoutes = require('./routes/customerGrpTypeRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const taskStatusUpdateRoutes = require('./routes/taskStatusUpdateRoutes');
const supportRoutes = require('./routes/supportRoutes');
const shifts = require('./routes/shiftRoutes');
const TicketProgress = require('./routes/ticketProgressRoutes');
const TicketReview = require('./routes/ticketReviewRoutes');
const supportEngineerHistoryRoutes = require("./routes/supportEngineerHistoryRoutes");

const authMiddleware = require('./middleware/authMiddleware');

const cors = require('cors');

require('dotenv').config();

const app = express();
// Connect to MongoDB
connectDB();
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true, 
}));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route to check API status
app.get('/', (req, res) => res.send('API is running...'));

// Route middlewares
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/franchises', franchiseRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/todos', authMiddleware, todosRoutes);
app.use('/api/task', authMiddleware, tasksRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/lead', leadRoutes);
app.use('/api/product-fields', productFieldRoutes);
app.use('/api/projectsmgnt', projectMgntRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/designations', designationRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/custgrouptypes', customerGrpTypeRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/taskstatusupdate', taskStatusUpdateRoutes);
app.use('/api/shifts', shifts);

app.use('/api/support-ticket', supportRoutes);
app.use('/api/ticket-progress', TicketProgress);
app.use('/api/ticket-review',TicketReview)
app.use("/api/support-engineer-history", supportEngineerHistoryRoutes);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});