const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

// URL จะเป็น /api/admin/create-candidate
router.post('/create-candidate', adminController.createCandidate);
router.post('/create-voter', createVoter);
router.post('/create-voter', adminController.createVoter);

// URL จะเป็น /api/admin/voters
router.get('/voters', adminController.listVoters);
module.exports = router;