const fs = require('fs/promises');
const path = require('path');
const pool = require('../db');

async function getActiveTermId() {
    const [rows] = await pool.query(
        `SELECT term_id
         FROM terms
         WHERE is_active = 1
         ORDER BY term_id DESC
         LIMIT 1`
    );

    return rows[0]?.term_id ?? null;
}

async function getCandidateProfileByUserId(userId, termId) {
    if (!termId) {
        return null;
    }

    const [rows] = await pool.query(
        `SELECT
            c.candidate_id,
            c.user_id,
            c.term_id,
            c.is_registered,
            COALESCE(NULLIF(c.name, ''), u.username) AS display_name,
            c.policies AS bio,
            c.personal_info,
            c.profile_picture,
            c.score AS vote_count,
            u.username
         FROM candidates c
         INNER JOIN users u ON u.user_id = c.user_id
         WHERE c.user_id = ? AND c.term_id = ?
         ORDER BY c.is_registered DESC, c.candidate_id DESC
         LIMIT 1`,
        [userId, termId]
    );

    return rows[0] ?? null;
}

async function ensureCandidateProfile(userId, termId) {
    let candidateProfile = await getCandidateProfileByUserId(userId, termId);

    if (candidateProfile) {
        return candidateProfile;
    }

    await pool.query(
        `INSERT INTO candidates (user_id, is_registered, term_id)
         VALUES (?, 1, ?)`,
        [userId, termId]
    );

    candidateProfile = await getCandidateProfileByUserId(userId, termId);
    return candidateProfile;
}

function parseImageDataUrl(imageDataUrl) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(imageDataUrl || '');

    if (!match) {
        throw new Error('Invalid image format');
    }

    const mimeType = match[1].toLowerCase();
    const base64Data = match[2];
    const extensionMap = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp'
    };

    return {
        extension: extensionMap[mimeType],
        buffer: Buffer.from(base64Data, 'base64')
    };
}

async function saveProfilePicture(candidateId, existingPath, imageDataUrl) {
    const parsedImage = parseImageDataUrl(imageDataUrl);
    const maxSize = 5 * 1024 * 1024;

    if (parsedImage.buffer.length > maxSize) {
        throw new Error('Image must be 5 MB or smaller');
    }

    const uploadsDirectory = path.join(__dirname, '..', 'uploads', 'profile-pictures');
    await fs.mkdir(uploadsDirectory, { recursive: true });

    const fileName = `candidate-${candidateId}-${Date.now()}.${parsedImage.extension}`;
    const relativePath = path.posix.join('uploads', 'profile-pictures', fileName);
    const absolutePath = path.join(__dirname, '..', relativePath);

    await fs.writeFile(absolutePath, parsedImage.buffer);

    if (existingPath?.startsWith('uploads/profile-pictures/')) {
        const oldFilePath = path.join(__dirname, '..', existingPath);
        await fs.unlink(oldFilePath).catch(() => {});
    }

    return relativePath;
}

async function getCandidateProfile(req, res) {
    const activeTermId = await getActiveTermId();

    if (!activeTermId) {
        return res.status(404).json({ message: 'No active election term found' });
    }

    const candidateProfile = await getCandidateProfileByUserId(req.params.userId, activeTermId);

    if (!candidateProfile) {
        return res.status(404).json({ message: 'Candidate profile not found' });
    }

    res.json({
        success: true,
        user: {
            user_id: candidateProfile.user_id,
            candidate_id: candidateProfile.candidate_id,
            bio: candidateProfile.bio,
            profile_picture: candidateProfile.profile_picture,
            display_name: candidateProfile.display_name,
            active_term_id: candidateProfile.term_id
        }
    });
}

async function getCandidateResults(req, res) {
    const activeTermId = await getActiveTermId();

    if (!activeTermId) {
        return res.json([]);
    }

    const [rows] = await pool.query(
        `SELECT
            c.candidate_id,
            u.user_id,
            u.username,
            COALESCE(NULLIF(c.name, ''), u.username) AS display_name,
            c.policies AS bio,
            c.profile_picture,
            c.score AS vote_count
         FROM candidates c
         INNER JOIN users u ON u.user_id = c.user_id
         WHERE c.term_id = ? AND c.is_registered = 1 AND u.role = 'candidate' AND u.is_enable = 1
         ORDER BY c.score DESC, display_name ASC`,
        [activeTermId]
    );

    res.json(rows);
}

async function updateCandidateManifesto(req, res) {
    const { user_id, bio } = req.body;

    if (!user_id || bio === undefined) {
        return res.status(400).json({ message: 'user_id and bio are required' });
    }

    const activeTermId = await getActiveTermId();

    if (!activeTermId) {
        return res.status(409).json({ message: 'No active election term found' });
    }

    const candidateProfile = await ensureCandidateProfile(user_id, activeTermId);

    if (!candidateProfile) {
        return res.status(404).json({ message: 'Candidate profile could not be created' });
    }

    await pool.query(
        `UPDATE candidates
         SET policies = ?
         WHERE candidate_id = ?`,
        [bio, candidateProfile.candidate_id]
    );

    const updatedProfile = await getCandidateProfileByUserId(user_id, activeTermId);

    res.json({
        success: true,
        message: 'Manifesto updated successfully',
        user: {
            user_id: user_id,
            candidate_id: updatedProfile?.candidate_id ?? null,
            bio: updatedProfile?.bio ?? bio,
            profile_picture: updatedProfile?.profile_picture ?? null,
            display_name: updatedProfile?.display_name ?? null,
            active_term_id: activeTermId
        }
    });
}

async function updateCandidateProfilePicture(req, res) {
    const { user_id, imageDataUrl } = req.body;

    if (!user_id || !imageDataUrl) {
        return res.status(400).json({ message: 'user_id and imageDataUrl are required' });
    }

    const activeTermId = await getActiveTermId();

    if (!activeTermId) {
        return res.status(409).json({ message: 'No active election term found' });
    }

    let candidateProfile = await ensureCandidateProfile(user_id, activeTermId);

    if (!candidateProfile) {
        return res.status(404).json({ message: 'Candidate profile could not be created' });
    }

    let profilePicturePath;

    try {
        profilePicturePath = await saveProfilePicture(
            candidateProfile.candidate_id,
            candidateProfile.profile_picture,
            imageDataUrl
        );
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }

    await pool.query(
        `UPDATE candidates
         SET profile_picture = ?
         WHERE candidate_id = ?`,
        [profilePicturePath, candidateProfile.candidate_id]
    );

    candidateProfile = await getCandidateProfileByUserId(user_id, activeTermId);

    res.json({
        success: true,
        message: 'Profile picture updated successfully',
        user: {
            user_id: user_id,
            candidate_id: candidateProfile?.candidate_id ?? null,
            bio: candidateProfile?.bio ?? null,
            profile_picture: candidateProfile?.profile_picture ?? null,
            display_name: candidateProfile?.display_name ?? null,
            active_term_id: activeTermId
        }
    });
}

module.exports = {
    getActiveTermId,
    getCandidateProfileByUserId,
    getCandidateProfile,
    getCandidateResults,
    updateCandidateManifesto,
    updateCandidateProfilePicture
};
