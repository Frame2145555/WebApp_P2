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

// หมวดหมู่: Dashboard (หน้าสถิติและผลคะแนน)
router.get('/dashboard', getDashboardStats);
router.get('/results', getResults);

// หมวดหมู่: Terms Management (หน้าจัดการรอบการเลือกตั้ง/ปีการศึกษา)
router.get('/terms', getTerms);
router.post('/create-term', createTerm); 
router.get('/term/:id', getTermById);
router.put('/term/:id/status', toggleTermStatus); // เปิด-ปิดสถานะเทอม (Toggle Term)
router.post('/toggle-voting', toggleVoting);      // เปิด-ปิดระบบโหวต

// 👤 หมวดหมู่: Candidates Management (หน้าจัดการผู้สมัคร)
router.post('/create-candidate', createCandidate);
router.get('/candidates', getCandidates);
router.post('/toggle-candidate', toggleCandidateStatus); // ระงับ/เปิดใช้งานผู้สมัคร
router.delete('/candidate/:id', deleteCandidate);

// หมวดหมู่: Voters & Users Management (หน้าจัดการผู้มีสิทธิ์โหวต)
router.post('/create-voter', createVoter);
router.get('/voters', listVoters);
router.post('/toggle-user', toggleUser); // ระงับ/เปิดใช้งานบัญชีผู้ใช้งานทั่วไป

module.exports = router;