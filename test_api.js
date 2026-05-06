const mongoose = require('mongoose');
const Attendance = require('./models/Attendance');
const Employee = require('./models/Employee');
const attendanceController = require('./controllers/attendanceController');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/megha-crm-test');

  // mock company and employee
  const companyId = new mongoose.Types.ObjectId();
  const employeeId = new mongoose.Types.ObjectId();

  await Employee.create({ _id: employeeId, company: companyId, firstName: 'Test', phone: '1234567890' });

  const req = {
    user: { role: 'company', userId: companyId.toString() },
    body: {
      employee: employeeId.toString(),
      date: '2026-05-06',
      inTime: new Date().toISOString(),
      inLocation: 'Office'
    },
    files: {}
  };

  const res = {
    status: function(s) {
      console.log('Status:', s);
      return this;
    },
    json: function(data) {
      console.log('JSON:', data);
      return this;
    }
  };

  console.log("--- PUNCH IN ---");
  await attendanceController.markAttendanceWithImages(req, res);

  console.log("--- PUNCH OUT ---");
  req.body.outTime = new Date(Date.now() + 3600000).toISOString();
  req.body.outLocation = 'Home';
  await attendanceController.markAttendanceWithImages(req, res);
  
  console.log("--- PUNCH IN 2 ---");
  delete req.body.outTime;
  delete req.body.outLocation;
  req.body.inTime = new Date(Date.now() + 7200000).toISOString();
  await attendanceController.markAttendanceWithImages(req, res);

  console.log("--- PUNCH OUT 2 ---");
  req.body.outTime = new Date(Date.now() + 10800000).toISOString();
  await attendanceController.markAttendanceWithImages(req, res);

  await mongoose.disconnect();
}

run().catch(console.error);
