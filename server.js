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
const tasksRoutes = require('./routes/taskRoutes')
const authMiddleware = require('./middleware/authMiddleware');

const cors = require('cors');

require('dotenv').config();

const app = express();
// Connect to MongoDB
connectDB();
app.use(cors({
  origin: 'http://localhost:3000', // frontend URL
  credentials: true, 
}));

// Middleware to parse JSON bodies
app.use(express.json());

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

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});