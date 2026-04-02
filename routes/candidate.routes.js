const express = require('express');
const router = express.Router();

const {
    getCandidateProfile,
    getCandidateResults,
    updateCandidateManifesto,
    updateCandidateProfilePicture
} = require('../controllers/candidate.controller');

router.get('/profile/:userId', getCandidateProfile);
router.get('/results', getCandidateResults);
router.post('/manifesto', updateCandidateManifesto);
router.post('/profile-picture', updateCandidateProfilePicture);

module.exports = router;
