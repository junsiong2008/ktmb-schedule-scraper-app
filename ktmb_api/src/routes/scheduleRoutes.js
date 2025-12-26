const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

router.get('/stations', scheduleController.getStations);
router.get('/routes', scheduleController.getRoutes);
router.get('/schedule/next', scheduleController.getNextTrain);
router.get('/schedule/search', scheduleController.searchTrips);
router.get('/schedule/list', scheduleController.getScheduleList);

module.exports = router;
