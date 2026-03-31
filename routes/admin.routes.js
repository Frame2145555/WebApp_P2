const express = require('express');
const router = express.Router();

const { createCandidate,
    createVoter,
    setActiveTerm,
    getCandidates,
    toggleCandidateStatus,
    deleteCandidate
 } = require('../controllers/admin.controller');

// URL จะเป็น /api/admin/create-candidate
router.post('/create-candidate', createCandidate);
router.post('/create-voter', createVoter);
router.get('/candidates', getCandidates);
router.post('/toggle-candidate', toggleCandidateStatus);
router.delete('/candidate/:id', deleteCandidate);

module.exports = router;