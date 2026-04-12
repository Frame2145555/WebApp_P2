const express = require('express');
const router = express.Router();
const votingController = require('../controllers/voting.controller');

// ===================== User =========================

// ดึงเทอม
router.get('/terms', votingController.getTerms);

// ดึงรายชื่อ
router.get('/candidates', votingController.getCandidates);

// ส่งคะแนน
router.post('/submit', votingController.submitVote);

module.exports = router;