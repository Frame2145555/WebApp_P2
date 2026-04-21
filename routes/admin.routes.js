const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

const {
    createCandidate,
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
    getTermById,
    deleteVoter
} = require('../controllers/admin.controller');

// ============================== admin ========================================
// Dashboard
router.get('/dashboard', getDashboardStats);
router.get('/results', getResults);

// Terms Management
router.get('/terms', getTerms);
router.post('/create-term', createTerm); 
router.get('/term/:id', getTermById);
router.put('/term/:id/status', toggleTermStatus);
router.post('/toggle-voting', toggleVoting); 

// Candidates Management
router.post('/create-candidate', createCandidate);
router.get('/candidates', getCandidates);
router.post('/toggle-candidate', toggleCandidateStatus);
router.delete('/candidate/:id', deleteCandidate);

// Voters & Users Management
router.post('/create-voter', createVoter);
router.get('/voters', listVoters);
router.post('/toggle-user', toggleUser);
router.delete('/voter/:id', deleteVoter);

// ================================ User ===========================================


// ================================ Page ===========================================

module.exports = router;