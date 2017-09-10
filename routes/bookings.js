const express = require('express');
const _ = require('lodash');
const { ObjectID } = require('mongodb');
const { auth } = require('./../middlewares/auth');

const { Booking } = require('./../db/models/booking');
const { User } = require('./../db/models/user');

const { createPDFBooking } = require('./../utilities/pdf_booking');

const { ROLES } = require('./../config/roles');

let bookingsRoutes = express.Router();

bookingsRoutes.post('/', auth, async (req, res) => {
    // Access level check (hardcoded)
    if ([ROLES.ADMIN, ROLES.BOOKER].indexOf(req.user.role) === -1) {
        return res.status(403).send();
    } 

    try {
        let body = _.pick(req.body, ['name', 'email', 'tel', 'numberOfTickets']);
        let bookingCodes = await Booking.getAllBookingCodes();
        let bookingCode;
        do {
            bookingCode = Booking.generateBookingCode();
        } while (bookingCodes.includes(bookingCode));

        body.bookingCode = bookingCode;
        body._creator = req.user._id;

        let booking = await new Booking(body).save();
        booking = booking.toJSON();
        booking.creatorInfo = await User.findById(booking._creator, '-_id username name');
        res.send(booking);

    } catch (error) {
        console.log(error);
        res.status(400).send(error);
    }
});

bookingsRoutes.get('/', auth, async (req, res) => {
    // Access level check (hardcoded)
    if ([ROLES.ADMIN, ROLES.BOOKER, ROLES.BOOKING_CHECKER].indexOf(req.user.role) === -1) {
        return res.status(403).send();
    } 

    try {
        let bookings = await Booking.find({}).lean();

        for (var i = 0; i < bookings.length; i++) {
            bookings[i].creatorInfo = await User.findById(bookings[i]._creator, '-_id username name');            
        }

        res.send(bookings);
    } catch (error) {
        console.log(error);
        res.status(400).send(error);
    }
});

bookingsRoutes.get('/:id', auth, async (req, res) => {
    // Access level check (hardcoded)
    if ([ROLES.ADMIN, ROLES.BOOKER, ROLES.BOOKING_CHECKER].indexOf(req.user.role) === -1) {
        return res.status(403).send();
    }

    let bookingId = req.params.id;

    if (!ObjectID.isValid(bookingId)) {
        return res.status(404).send();
    }

    try {
        let booking = await Booking.findById(bookingId).lean();
        if (!booking) {
            return res.status(404).send();
        }

        booking.creatorInfo = await User.findById(booking._creator, '-_id username name');
        res.send(booking);
    } catch (error) {
        console.log(error);
        res.status(400).send(error);
    }
});

bookingsRoutes.get('/:id/pdf', async (req, res) => {
    let bookingId = req.params.id;

    if (!ObjectID.isValid(bookingId)) {
        return res.status(404).send();
    }

    try {
        let booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).send();
        }
        createPDFBooking(res, booking.name, booking.email || null, booking.tel || null, booking.numberOfTickets, booking.bookingCode);
    } catch (error) {
        console.log(error)
        res.status(400).send(error);
    }
});

bookingsRoutes.patch('/:id', auth, async (req, res) => {    
    if ([ROLES.ADMIN, ROLES.BOOKER].indexOf(req.user.role) === -1) {
        return res.status(403).send();
    }

    let bookingId = req.params.id;
    
    if (!ObjectID.isValid(bookingId)) {
        return res.status(404).send();
    }

    try {
        let body = _.pick(req.body, ['name', 'email', 'tel', 'numberOfTickets']);

        let updatedBooking = await Booking.findByIdAndUpdate(bookingId, {
            $set: body
        }, { new: true })

        if (!updatedBooking) {
            return res.status(404).send();
        }
        
        res.send(updatedBooking);
    } catch (error) {
        console.log(error)
        res.status(400).send(error);
    }
});

bookingsRoutes.delete('/:id', auth, async (req, res) => {    
    if ([ROLES.ADMIN, ROLES.BOOKER].indexOf(req.user.role) === -1) {
        return res.status(403).send();
    } 

    let bookingId = req.params.id;
    
    if (!ObjectID.isValid(bookingId)) {
        return res.status(404).send();
    }

    try {
        let booking = await Booking.findByIdAndRemove(bookingId);

        if (!booking) {
            return res.status(404).send();
        }
        
        res.send(booking);
    } catch (error) {
        console.log(error)
        res.status(400).send(error);
    }
});

module.exports = bookingsRoutes;