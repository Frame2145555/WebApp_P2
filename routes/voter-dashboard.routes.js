const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get voting terms
router.get('/terms', async (req, res) => {
    try {
        const [terms] = await pool.query(
            "SELECT term_id, name, description, is_active FROM terms ORDER BY term_id DESC"
        );
        res.json({ status: "success", data: terms });
    } catch (error) {
        console.error("Get Terms Error:", error);
        res.status(500).json({ status: "error", message: "Failed to load terms" });
    }
});

// Get candidates for a specific term
router.get('/candidates', async (req, res) => {
    try {
        let { term_id, user_id } = req.query;

        // If no term_id provided, get the active term
        if (!term_id) {
            const [active] = await pool.query("SELECT term_id FROM terms WHERE is_active = 1 LIMIT 1");
            term_id = active?.[0]?.term_id;
        }

        if (!term_id) {
            return res.status(404).json({ status: "error", message: "No active term found" });
        }

        // Get term details
        const [termRows] = await pool.query(
            "SELECT term_id, name, description, is_active FROM terms WHERE term_id = ? LIMIT 1",
            [term_id]
        );

        if (termRows.length === 0) {
            return res.status(404).json({ status: "error", message: "Term not found" });
        }

        // Get candidates for this term
        const [candidates] = await pool.query(
            `SELECT
                c.candidate_id,
                c.score,
                c.policies,
                c.profile_picture,
                COALESCE(NULLIF(c.name, ''), u.username, CONCAT('Candidate #', c.candidate_id)) AS name,
                u.username AS display_id
             FROM candidates c
             LEFT JOIN users u ON c.user_id = u.user_id
             WHERE c.term_id = ?
             ORDER BY c.candidate_id ASC`,
            [term_id]
        );

        // Count total voters for this term
        const [voterCount] = await pool.query("SELECT COUNT(*) AS total FROM voters WHERE term_id = ?", [term_id]);
        const total_voters = voterCount[0]?.total || 0;

        let user_has_voted = false;
        if (user_id) {
            const [voterRows] = await pool.query(
                "SELECT is_voted FROM voters WHERE user_id = ? AND term_id = ? LIMIT 1",
                [user_id, term_id]
            );
            user_has_voted = voterRows[0]?.is_voted === 1;
        }

        res.json({
            status: "success",
            data: candidates,
            term: termRows[0],
            total_voters: total_voters,
            user_has_voted: user_has_voted
        });
    } catch (error) {
        console.error("Get Candidates Error:", error);
        res.status(500).json({ status: "error", message: "Failed to load candidates" });
    }
});

// Submit a vote
router.post('/submit', async (req, res) => {
    const { user_id, candidate_id } = req.body;

    if (!user_id || !candidate_id) {
        return res.status(400).json({ status: "error", message: "Missing required data" });
    }

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // Find active term
        const [active] = await conn.query("SELECT term_id FROM terms WHERE is_active = 1 LIMIT 1");
        if (active.length === 0) {
            await conn.rollback();
            return res.status(404).json({ status: "error", message: "No active voting term" });
        }
        const activeTermId = active[0].term_id;

        // Check voter eligibility
        const [voters] = await conn.query(
            `SELECT v.voter_id, v.is_voted, u.is_enable
             FROM voters v
             JOIN users u ON v.user_id = u.user_id
             WHERE v.user_id = ? AND v.term_id = ?`,
            [user_id, activeTermId]
        );

        if (voters.length === 0) {
            await conn.rollback();
            return res.status(404).json({ status: "error", message: "You are not eligible to vote in this term" });
        }
        if (voters[0].is_enable === 0) {
            await conn.rollback();
            return res.status(403).json({ status: "error", message: "Your account is suspended" });
        }
        if (voters[0].is_voted === 1) {
            await conn.rollback();
            return res.status(403).json({ status: "error", message: "You have already voted!" });
        }

        // Check candidate validity
        const [cand] = await conn.query(
            `SELECT c.candidate_id, u.is_enable, c.is_registered
             FROM candidates c
             LEFT JOIN users u ON c.user_id = u.user_id
             WHERE c.candidate_id = ? AND c.term_id = ?`,
            [candidate_id, activeTermId]
        );

        if (cand.length === 0) {
            await conn.rollback();
            return res.status(404).json({ status: "error", message: "Candidate not found" });
        }

        if (cand[0].is_enable === 0) {
            await conn.rollback();
            return res.status(403).json({ status: "error", message: "This candidate is suspended" });
        }

        const voter_id = voters[0].voter_id;

        // Record the vote
        await conn.query("UPDATE voters SET is_voted = 1 WHERE voter_id = ?", [voter_id]);
        await conn.query("UPDATE candidates SET score = score + 1 WHERE candidate_id = ?", [candidate_id]);
        await conn.query("INSERT INTO votes (voter_id, candidate_id) VALUES (?, ?)", [voter_id, candidate_id]);

        await conn.commit();
        res.json({ status: "success", message: "Vote submitted successfully!" });

    } catch (error) {
        await conn.rollback();
        console.error("Voting Error:", error);
        res.status(500).json({ status: "error", message: "Server error occurred" });
    } finally {
        conn.release();
    }
});

// Get voting history for a user
router.get('/history/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        let resolvedUserId = user_id;

        // Allow using username if user_id does not map to a numeric user record
        const [userRows] = await pool.query(
            `SELECT user_id FROM users WHERE user_id = ? OR username = ? LIMIT 1`,
            [user_id, user_id]
        );

        if (userRows.length > 0) {
            resolvedUserId = userRows[0].user_id;
        }

        const [history] = await pool.query(
            `SELECT
                v.voted_at,
                c.name AS candidate_name,
                c.policies,
                t.name AS term_name,
                t.description AS term_description
             FROM votes v
             JOIN candidates c ON v.candidate_id = c.candidate_id
             JOIN voters vr ON v.voter_id = vr.voter_id
             JOIN terms t ON c.term_id = t.term_id
             WHERE vr.user_id = ?
             ORDER BY v.voted_at DESC`,
            [resolvedUserId]
        );

        res.json({
            status: "success",
            data: history.map(item => ({
                candidate: item.candidate_name || `Candidate #${item.candidate_id}`,
                party: item.term_description || `Term ${item.term_name}`,
                time: new Date(item.voted_at).toLocaleString('th-TH'),
                policies: item.policies || 'No policies available'
            }))
        });
    } catch (error) {
        console.error("Get History Error:", error);
        res.status(500).json({ status: "error", message: "Failed to load voting history" });
    }
});

// Get user profile information
router.get('/profile/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;

        const [userRows] = await pool.query(
            `SELECT
                u.username,
                u.role,
                v.is_voted,
                t.name AS current_term,
                t.description AS term_description
             FROM users u
             LEFT JOIN voters v ON u.user_id = v.user_id
             LEFT JOIN terms t ON v.term_id = t.term_id AND t.is_active = 1
             WHERE u.user_id = ? AND u.is_enable = 1
             LIMIT 1`,
            [user_id]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        const user = userRows[0];
        res.json({
            status: "success",
            data: {
                name: user.username,
                id: user_id,
                role: user.role,
                hasVoted: user.is_voted === 1,
                currentTerm: user.term_description || 'No active term',
                faculty: 'Computer Science' // You can add faculty field to users table if needed
            }
        });
    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ status: "error", message: "Failed to load profile" });
    }
});

module.exports = router;