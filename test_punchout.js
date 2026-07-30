require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
const attendanceController = require('./controllers/attendanceController');
const authMiddleware = require('./middleware/authMiddleware');

// 1. Setup Database Connection
let uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/megha-crm-test';
if (uri.includes('/crm?')) {
  uri = uri.replace('/crm?', '/crm_test?');
} else if (uri.endsWith('/crm')) {
  uri = uri.replace('/crm', '/crm_test');
}

async function runTests() {
  console.log(`Connecting to database: ${uri}`);
  await mongoose.connect(uri);

  // Clear existing test database collections to prevent interference
  await Company.deleteMany({});
  await Employee.deleteMany({});
  await Attendance.deleteMany({});

  // Setup test entities
  const company = new Company({
    businessName: 'Test Corporation',
    businessEmail: 'testcorp@example.com',
    password: 'password123',
    latitude: 16.846453,
    longitude: 74.598925,
    attendanceRadius: 100
  });
  await company.save();

  const employee = new Employee({
    company: company._id,
    teamMemberName: 'John Doe',
    email: 'john.doe@example.com',
    password: 'password123',
    role: 'employee',
    isActive: true,
    mobileNumber: '1234567890'
  });
  await employee.save();

  console.log('Setup completed. Running test cases...');

  // Helper to generate mock res object
  function mockRes(callback) {
    return { 
      statusCode: 200,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        callback(this.statusCode, data);
        return this;
      }
    };
  }

  // ----------------------------------------------------
  // TEST 1: Manual punch-out with selfie succeeds
  // ----------------------------------------------------
  {
    const attDate = new Date(new Date('2026-07-24T00:00:00.000Z').setHours(0, 0, 0, 0));
    const inTime = new Date('2026-07-24T09:00:00.000Z');
    const attendance = new Attendance({
      company: company._id,
      employee: employee._id,
      date: attDate,
      inTime: inTime,
      inLocation: 'Office Entrance',
      inPhoto: 'http://example.com/in.jpg',
      punches: [{
        inTime: inTime,
        inLocation: 'Office Entrance',
        inPhoto: 'http://example.com/in.jpg'
      }]
    });
    await attendance.save();

    const req = {
      user: { id: employee._id.toString(), role: 'employee', userId: employee._id.toString() },
      body: {
        employee: employee._id.toString(),
        date: '2026-07-24T00:00:00.000Z',
        outTime: '2026-07-24T18:00:00.000Z',
        outLocation: 'Office Exit'
      },
      files: {
        outPhoto: [{ path: 'http://example.com/out_selfie.jpg' }]
      }
    };

    await new Promise((resolve) => {
      attendanceController.punchOut(req, mockRes(async (status, data) => {
        if (status === 200 && data.success === true && data.alreadyPunchedOut === false) {
          console.log('✅ Test 1 Passed: Manual punch-out with selfie succeeds.');
        } else {
          console.error('❌ Test 1 Failed:', status, data);
        }
        resolve();
      }));
    });
  }

  // ----------------------------------------------------
  // TEST 2: Manual punch-out without selfie returns 400 OUT_PHOTO_REQUIRED
  // ----------------------------------------------------
  {
    const attDate = new Date(new Date('2026-07-25T00:00:00.000Z').setHours(0, 0, 0, 0));
    const inTime = new Date('2026-07-25T09:00:00.000Z');
    const attendance = new Attendance({
      company: company._id,
      employee: employee._id,
      date: attDate,
      inTime: inTime,
      inLocation: 'Office Entrance',
      punches: [{ inTime }]
    });
    await attendance.save();

    const req = {
      user: { id: employee._id.toString(), role: 'employee', userId: employee._id.toString() },
      body: {
        employee: employee._id.toString(),
        date: '2026-07-25T00:00:00.000Z',
        outTime: '2026-07-25T18:00:00.000Z',
        outLocation: 'Office Exit'
      },
      files: {}
    };

    await new Promise((resolve) => {
      attendanceController.punchOut(req, mockRes((status, data) => {
        if (status === 400 && data.code === 'OUT_PHOTO_REQUIRED') {
          console.log('✅ Test 2 Passed: Manual punch-out without selfie returns 400 OUT_PHOTO_REQUIRED.');
        } else {
          console.error('❌ Test 2 Failed:', status, data);
        }
        resolve();
      }));
    });
  }

  // ----------------------------------------------------
  // TEST 3 & 4: Automatic punch-out with isAutoPunchOut=true succeeds and saves audit fields
  // ----------------------------------------------------
  {
    const attDate = new Date(new Date('2026-07-26T00:00:00.000Z').setHours(0, 0, 0, 0));
    const inTime = new Date('2026-07-26T09:00:00.000Z');
    const attendance = new Attendance({
      company: company._id,
      employee: employee._id,
      date: attDate,
      inTime: inTime,
      inLocation: 'Office Entrance',
      punches: [{ inTime }]
    });
    await attendance.save();

    const req = {
      user: { id: employee._id.toString(), role: 'employee', userId: employee._id.toString() },
      body: {
        employee: employee._id.toString(),
        date: '2026-07-26T00:00:00.000Z',
        outTime: '2026-07-26T18:00:00.000Z',
        outLocation: 'Office Exit',
        isAutoPunchOut: 'true',
        punchOutSource: 'AUTO_MIDNIGHT',
        locationFile: 'https://cloudinary.com/location_log.json'
      },
      files: {}
    };

    await new Promise((resolve) => {
      attendanceController.punchOut(req, mockRes(async (status, data) => {
        const saved = await Attendance.findById(attendance._id);
        const t3Passed = status === 200 && data.success === true && !data.alreadyPunchedOut;
        const t4Passed = saved.isAutoPunchOut === true &&
                          saved.autoPunchOut === true &&
                          saved.punchOutSource === 'AUTO_MIDNIGHT' &&
                          saved.punchOutType === 'automatic' &&
                          saved.outPhotoMissingReason === 'AUTO_PUNCH_OUT' &&
                          saved.locationFile === 'https://cloudinary.com/location_log.json';

        if (t3Passed) {
          console.log('✅ Test 3 Passed: Automatic punch-out succeeds without selfie.');
        } else {
          console.error('❌ Test 3 Failed:', status, data);
        }

        if (t4Passed) {
          console.log('✅ Test 4 Passed: Automatic punch-out correctly populated audit and source fields.');
        } else {
          console.error('❌ Test 4 Failed. Database state:', saved);
        }
        resolve();
      }));
    });
  }

  // ----------------------------------------------------
  // TEST 5: Retrying the same automatic punch-out returns HTTP 200 and is idempotent
  // ----------------------------------------------------
  {
    const req = {
      user: { id: employee._id.toString(), role: 'employee', userId: employee._id.toString() },
      body: {
        employee: employee._id.toString(),
        date: '2026-07-26T00:00:00.000Z',
        outTime: '2026-07-26T18:00:00.000Z',
        outLocation: 'Office Exit',
        isAutoPunchOut: 'true'
      },
      files: {}
    };

    await new Promise((resolve) => {
      attendanceController.punchOut(req, mockRes((status, data) => {
        if (status === 200 && data.success === true && data.alreadyPunchedOut === true) {
          console.log('✅ Test 5 Passed: Retrying the same auto punch-out is idempotent and returns 200.');
        } else {
          console.error('❌ Test 5 Failed:', status, data);
        }
        resolve();
      }));
    });
  }

  // ----------------------------------------------------
  // TEST 6: Automatic punch-out does not overwrite a completed manual punch-out
  // ----------------------------------------------------
  {
    const attDate = new Date(new Date('2026-07-27T00:00:00.000Z').setHours(0, 0, 0, 0));
    const inTime = new Date('2026-07-27T09:00:00.000Z');
    const outTime = new Date('2026-07-27T18:00:00.000Z');
    const attendance = new Attendance({
      company: company._id,
      employee: employee._id,
      date: attDate,
      inTime: inTime,
      inLocation: 'Office Entrance',
      outTime: outTime,
      outLocation: 'Office Exit',
      outPhoto: 'http://example.com/manual_selfie.jpg',
      isAutoPunchOut: false,
      punches: [{
        inTime,
        outTime,
        outPhoto: 'http://example.com/manual_selfie.jpg'
      }]
    });
    await attendance.save();

    const req = {
      user: { id: employee._id.toString(), role: 'employee', userId: employee._id.toString() },
      body: {
        employee: employee._id.toString(),
        date: '2026-07-27T00:00:00.000Z',
        outTime: '2026-07-27T19:00:00.000Z',
        outLocation: 'Office Exit',
        isAutoPunchOut: 'true'
      },
      files: {}
    };

    await new Promise((resolve) => {
      attendanceController.punchOut(req, mockRes(async (status, data) => {
        const saved = await Attendance.findById(attendance._id);
        const t6Passed = status === 200 &&
                          data.alreadyPunchedOut === true &&
                          saved.isAutoPunchOut === false &&
                          saved.outPhoto === 'http://example.com/manual_selfie.jpg';

        if (t6Passed) {
          console.log('✅ Test 6 Passed: Automatic punch-out did not overwrite manual punch-out.');
        } else {
          console.error('❌ Test 6 Failed:', status, data);
        }
        resolve();
      }));
    });
  }

  // ----------------------------------------------------
  // TEST 7: Expired/invalid JWT returns 401
  // ----------------------------------------------------
  {
    const req = {
      header: function(name) {
        return name === 'Authorization' ? 'Bearer invalid-expired-token' : null;
      }
    };
    const res = mockRes((status, data) => {
      if (status === 401 && data.message === 'Token is not valid') {
        console.log('✅ Test 7 Passed: Invalid JWT/Token validation returned 401.');
      } else {
        console.error('❌ Test 7 Failed:', status, data);
      }
    });

    authMiddleware(req, res, () => {});
  }

  // ----------------------------------------------------
  // TEST 8: Invalid attendance date/time returns a clear 400 error
  // ----------------------------------------------------
  {
    const attDate = new Date(new Date('2026-07-28T00:00:00.000Z').setHours(0, 0, 0, 0));
    const inTime = new Date('2026-07-28T09:00:00.000Z');
    const attendance = new Attendance({
      company: company._id,
      employee: employee._id,
      date: attDate,
      inTime: inTime,
      punches: [{ inTime }]
    });
    await attendance.save();

    const req = {
      user: { id: employee._id.toString(), role: 'employee', userId: employee._id.toString() },
      body: {
        employee: employee._id.toString(),
        date: '2026-07-28T00:00:00.000Z',
        outTime: '2026-07-28T08:00:00.000Z', // Out time before In time!
        isAutoPunchOut: 'true'
      },
      files: {}
    };

    await new Promise((resolve) => {
      attendanceController.punchOut(req, mockRes((status, data) => {
        if (status === 400 && data.code === 'INVALID_PUNCH_OUT_DATA' && data.message.includes('after inTime')) {
          console.log('✅ Test 8 Passed: OutTime before InTime returns clear 400 INVALID_PUNCH_OUT_DATA.');
        } else {
          console.error('❌ Test 8 Failed:', status, data);
        }
        resolve();
      }));
    });
  }

  // ----------------------------------------------------
  // TEST 9: No record for that date returns the defined ATTENDANCE_NOT_FOUND response
  // ----------------------------------------------------
  {
    const req = {
      user: { id: employee._id.toString(), role: 'employee', userId: employee._id.toString() },
      body: {
        employee: employee._id.toString(),
        date: '2026-07-29T00:00:00.000Z', // No attendance record exists for this date!
        outTime: '2026-07-29T18:00:00.000Z',
        isAutoPunchOut: 'true'
      },
      files: {}
    };

    await new Promise((resolve) => {
      attendanceController.punchOut(req, mockRes((status, data) => {
        if (status === 404 && data.code === 'ATTENDANCE_NOT_FOUND') {
          console.log('✅ Test 9 Passed: No attendance record found returns 404 ATTENDANCE_NOT_FOUND.');
        } else {
          console.error('❌ Test 9 Failed:', status, data);
        }
        resolve();
      }));
    });
  }

  // ----------------------------------------------------
  // TEST 10: Working time is calculated correctly across local midnight boundary
  // ----------------------------------------------------
  {
    const attDate = new Date(new Date('2026-07-30T00:00:00.000Z').setHours(0, 0, 0, 0));
    const inTime = new Date('2026-07-30T22:00:00.000Z'); // 10 PM
    const attendance = new Attendance({
      company: company._id,
      employee: employee._id,
      date: attDate,
      inTime: inTime,
      punches: [{ inTime }]
    });
    await attendance.save();

    const req = {
      user: { id: employee._id.toString(), role: 'employee', userId: employee._id.toString() },
      body: {
        employee: employee._id.toString(),
        date: '2026-07-30T00:00:00.000Z',
        outTime: '2026-07-31T02:30:00.000Z', // 2:30 AM next day (working time: 4.5 hours = 270 minutes)
        isAutoPunchOut: 'true'
      },
      files: {}
    };

    await new Promise((resolve) => {
      attendanceController.punchOut(req, mockRes(async (status, data) => {
        const saved = await Attendance.findById(attendance._id);
        if (status === 200 && saved.workingTime === 270) {
          console.log('✅ Test 10 Passed: Working time calculated correctly across midnight boundary (270 minutes).');
        } else {
          console.error('❌ Test 10 Failed. Working time:', saved ? saved.workingTime : 'No attendance record', data);
        }
        resolve();
      }));
    });
  }

  await mongoose.disconnect();
  console.log('All tests run completed.');
}

runTests().catch(console.error);
