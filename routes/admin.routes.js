const express = require('express');
const router = express.Router();

const { createCandidate,
    createVoter,
    setActiveTerm,
    getCandidates,
    toggleCandidateStatus,
    deleteCandidate,
    getTerms,
    createTerm,
 } = require('../controllers/admin.controller');

// URL จะเป็น /api/admin/create-candidate
router.post('/create-candidate', createCandidate);
router.post('/create-voter', createVoter);
router.get('/candidates', getCandidates);
router.post('/toggle-candidate', toggleCandidateStatus);
router.delete('/candidate/:id', deleteCandidate);
router.get('/terms', getTerms);
router.post('/create-term', createTerm); 
// router.put('/term/:id/status', adminController.toggleTermStatus);
// router.get('/term/:id', adminController.getTermById);

module.exports = router;