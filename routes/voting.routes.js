const express = require('express');
const router = express.Router();
const votingController = require('../controllers/voting.controller');

// GET: /api/voting/candidates (ดึงรายชื่อ)
router.get('/candidates', votingController.getCandidates);

// POST: /api/voting/vote (ส่งคะแนน)
router.post('/vote', votingController.submitVote);

module.exports = router;