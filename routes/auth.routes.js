const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// 🚨 หมายเหตุ: เราจะไม่ใส่คำว่า /api ไว้ในนี้ เพราะเดี๋ยวเราไปประกอบร่างใน app.js ทีเดียวครับ
router.post('/login', authController.login);
router.get('/register/verify/:candidate_id', authController.verifyCandidate);
router.post('/register', authController.register);
router.post('/update-bio', authController.updateBio);

module.exports = router;