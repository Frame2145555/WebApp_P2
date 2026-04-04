const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// กำหนดว่าถ้ายิง POST มาที่ /login ให้ไปทำงานที่ฟังก์ชัน login
router.post('/login', authController.login);

router.post('/reg', authController.registerCandidate);

module.exports = router;