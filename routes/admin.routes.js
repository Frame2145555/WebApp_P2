const express = require('express');
const router = express.Router();

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
    getTermById
} = require('../controllers/admin.controller');

// Dashboard (หน้าสถิติและผลคะแนน)
router.get('/dashboard', getDashboardStats);
router.get('/results', getResults);

// Terms Management (หน้าจัดการรอบการเลือกตั้ง/ปีการศึกษา)
router.get('/terms', getTerms);
router.post('/create-term', createTerm); 
router.get('/term/:id', getTermById);
router.put('/term/:id/status', toggleTermStatus);
router.post('/toggle-voting', toggleVoting); 

// Candidates Management (หน้าจัดการผู้สมัคร)
router.post('/create-candidate', createCandidate);
router.get('/candidates', getCandidates);
router.post('/toggle-candidate', toggleCandidateStatus);
router.delete('/candidate/:id', deleteCandidate);

// Voters & Users Management (หน้าจัดการผู้มีสิทธิ์โหวต)
router.post('/create-voter', createVoter);
router.get('/voters', listVoters);
router.post('/toggle-user', toggleUser);

module.exports = router;