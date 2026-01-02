const express = require('express');
const router = express.Router();
const gtfsController = require('../controllers/gtfsController');

router.get('/vehicle-positions', gtfsController.getVehiclePositions);

module.exports = router;
