const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { isLoggedIn, isCandidate } = require('../middleware/auth');

// ======================== User ================================
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Not logged in' });
    res.json({ user: req.session.user });
});
router.get('/register/verify/:candidate_id', authController.verifyCandidate);
router.post('/register', authController.register);
router.post('/update-bio', isLoggedIn, isCandidate, authController.updateBio);

module.exports = router;