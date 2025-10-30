//server.js
require('dotenv').config();
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
const requestRoutes = require('./routes/requestRoutes');
const chatRoutes = require('./routes/chatRoutes');
const branchRoutes = require('./routes/branchRoutes');
const subscriptionPlanRoutes = require('./routes/subscriptionPlanRoutes');
const leaveTypeRoutes = require('./routes/leaveTypeRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const companyDashboardRoutes = require('./routes/companyDashboardRoutes')
const locationRoutes = require('./routes/locationTrackingRoutes');
const ticketOptionsRoutes = require('./routes/ticketOptionsRoutes');
const superadminDashboardRoutes = require('./routes/superadminDashboardRoutes');
const advanceRoutes = require('./routes/advanceRoutes');
const projectCustomStatusRoutes = require('./routes/projectCustomStatusRoutes');

const authMiddleware = require('./middleware/authMiddleware');

const cors = require('cors');


const app = express();

// Connect to MongoDB
connectDB();

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'https://digitalschool.cloud',
  'https://udaanjobs.com',
  'https://softwarecompanyinsangli.online',
  'https://softwarecompanyinsangli.com'
];

app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS Origin received:', origin);  // Add this log
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      console.log('CORS allowed for origin:', origin);  // Add this log
      return callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);  // Add this log
      return callback(new Error('Not allowed by CORS'));
    }
  },
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
app.use('/api/requests', requestRoutes);

app.use('/api/chat', chatRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/subscription-plans', subscriptionPlanRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/comapanydashboard', companyDashboardRoutes);

app.use('/api/location', locationRoutes);
app.use('/api/ticket-options', ticketOptionsRoutes);
app.use('/api/sadashboard', superadminDashboardRoutes);
app.use('/api/advance', advanceRoutes); 
app.use('/api/prjCustomStatus', projectCustomStatusRoutes); 

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});