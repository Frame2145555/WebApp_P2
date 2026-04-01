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
    getDashboardStats,
    getResults,
    toggleVoting,
    toggleUser,
    listVoters,
    toggleTermStatus,
    getTermById
 } = require('../controllers/admin.controller');

// URL จะเป็น /api/admin/create-candidate
router.post('/create-candidate', createCandidate);
router.post('/create-voter', createVoter);
router.get('/candidates', getCandidates);
router.post('/toggle-candidate', toggleCandidateStatus);
router.delete('/candidate/:id', deleteCandidate);
router.get('/terms', getTerms);
router.post('/create-term', createTerm); 
router.get('/dashboard', getDashboardStats);
router.get('/results', getResults);
router.post('/toggle-voting', toggleVoting);
router.post('/toggle-user', toggleUser);
router.get('/voters', listVoters);
router.put('/term/:id/status', toggleTermStatus);
router.get('/term/:id', getTermById);

module.exports = router;