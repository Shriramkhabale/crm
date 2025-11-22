const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    holidayName: {
      type: String,
      required: true,
      trim: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("HolidayCreation", holidaySchema);
