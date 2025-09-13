const TicketReview = require('../models/TicketReview');
const SupportTicket = require('../models/SupportTicket');

exports.addOrUpdateReview = async (req, res) => {
  try {
    const { ticketId, rating, comment, customerId } = req.body;

    if (!ticketId || !rating) {
      return res.status(400).json({ message: 'ticketId and rating are required' });
    }

    // Check if ticket exists and is resolved or closed (optional)
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'SupportTicket not found' });
    }

    // Optional: Only allow review if ticket status is resolved or closed
    if (!['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ message: 'Cannot review ticket unless it is resolved or closed' });
    }

    // Upsert review (one review per ticket)
    const review = await TicketReview.findOneAndUpdate(
      { ticketId },
      { rating, comment, reviewedAt: new Date(), customerId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Update SupportEngineer aggregate rating and ticketsResolved
    if (ticket.assignedTo) {
      const engineerId = ticket.assignedTo;

      // Calculate new average rating and ticketsResolved count
      const reviews = await TicketReview.aggregate([
        {
          $lookup: {
            from: 'supporttickets',
            localField: 'ticketId',
            foreignField: '_id',
            as: 'ticket',
          },
        },
        { $unwind: '$ticket' },
        { $match: { 'ticket.assignedTo': engineerId } },
        {
          $group: {
            _id: '$ticket.assignedTo',
            avgRating: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ]);

   
    }

    res.status(201).json({ message: 'Review saved', review });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getReviewByTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const review = await TicketReview.findOne({ ticketId });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.getReviewsByCompanyId = async (req, res) => {
  try {
    const { companyId } = req.params;
    // Find all tickets for the company
    const tickets = await SupportTicket.find({ companyId });
    if (tickets.length === 0) {
      return res.json({ success: true, companyId, reviews: [] });
    }
    const ticketIds = tickets.map(t => t._id);
    // Find all reviews for those tickets
    const reviews = await TicketReview.find({ ticketId: { $in: ticketIds } });
    res.json({ success: true, companyId, reviews });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
