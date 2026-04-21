const argon2 = require('@node-rs/argon2');
const crypto = require('crypto');
const pool = require('../db');

const sha256 = (value) => crypto.createHash('sha256').update(value.toUpperCase()).digest('hex');

// ฟังก์ชัน Login
const login = async (req, res) => {
    const { username, password } = req.body;

    // if (!username || !password) {
    //     return res.status(400).send('Please enter username and password');
    // }

    try {
        // ดึงข้อมูลจากตาราง users และ candidates พ่วงมาด้วยเลย
        const sql = `
            SELECT u.user_id, u.username, u.password, u.role, u.is_enable,
                   c.candidate_id, c.name AS display_name, c.policies AS bio, c.profile_picture
            FROM users u
            LEFT JOIN candidates c ON u.user_id = c.user_id
            WHERE u.username = ?
        `;
        const [results] = await pool.query(sql, [username]);

        if (results.length !== 1) {
            return res.status(401).send('Wrong username');
        }

        if (results[0].is_enable === 0) {
            return res.status(403).send('บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
        }

        const role = results[0].role;

        if (results[0].password === 'NOT_REGISTERED') {
            return res.status(403).send('Candidate has not registered yet');
        }

        let same = false;
        let needsRehash = false;

        try {
            // 1. ลอง argon2 ก่อน (admin / candidate ที่ลงทะเบียนแล้ว)
            same = await argon2.verify(results[0].password, password);
        } catch (hashError) {
            // 2. ลอง SHA-256 (voter ที่ถูกสร้างโดย admin)
            if (results[0].password === sha256(password)) {
                same = true;
                needsRehash = true;
            // 3. plaintext — ตรวจแล้ว rehash ทันที
            } else if (results[0].password === password) {
                same = true;
                needsRehash = true;
            }
        }

        if (!same) {
            return res.status(401).send('Wrong password');
        }

        if (needsRehash) {
            const hashed = await argon2.hash(password);
            await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [hashed, results[0].user_id]);
        }

        const { user_id } = results[0];

        // Redirect ตาม Role
        const redirectMap = {
            admin: '/AdminNew/views/Term.html',
            candidate: '/candidate_system/views/candidate_dashboard.html',
            voter: '/Voter-Dashboard',
        };

        const redirect = redirectMap[role];
        if (!redirect) {
            return res.status(403).send('Unknown role');
        }

        const userData = {
            user_id: results[0].user_id,
            username: results[0].username,
            role: role,
            candidate_id: results[0].candidate_id,
            display_name: results[0].display_name,
            bio: results[0].bio,
            profile_picture: results[0].profile_picture
        };

        req.session.user = userData;

        return res.status(200).json({ redirect: redirect, user: userData });
    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).send('Server or Database error');
    }
};

// 2. ฟังก์ชันตรวจสอบสิทธิ์ก่อนตั้งรหัส (Verify Candidate)
const verifyCandidate = async (req, res) => {
    const { candidate_id } = req.params;

    try {
        // เพิ่ม u.is_enable เข้าไปในคำสั่ง SELECT
        const [rows] = await pool.query(
            `SELECT u.user_id, c.name, u.password, u.is_enable
             FROM users u
             JOIN candidates c ON u.user_id = c.user_id
             WHERE u.username = ? AND u.role = 'candidate'`,
            [candidate_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invalid Candidate ID' });
        }

        // ด่านตรวจ: โดนแบนอยู่ ห้ามลงทะเบียน!
        if (rows[0].is_enable === 0) {
            return res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน ไม่สามารถลงทะเบียนได้' });
        }

        return res.json({ valid: true, name: rows[0].name });

    } catch (err) {
        console.error("Verify Error:", err);
        return res.status(500).send('Server or Database error');
    }
};

// ฟังก์ชันตั้งรหัสผ่านใหม่ (Register)
const register = async (req, res) => {
    const { candidate_id, password, confirm_password } = req.body;

    if (!candidate_id || !password || !confirm_password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (password !== confirm_password) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
        // เพิ่ม is_enable เข้าไปในคำสั่ง SELECT
        const [rows] = await pool.query(
            `SELECT user_id, password, is_enable FROM users WHERE username = ? AND role = 'candidate'`,
            [candidate_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invalid Candidate ID' });
        }

        // ด่านตรวจสุดท้าย: ถ้าโดนแบน ให้เตะกลับไป
        if (rows[0].is_enable === 0) {
            return res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน' });
        }

        if (rows[0].password !== 'NOT_REGISTERED') {
            return res.status(409).json({ error: 'Already registered' });
        }

        const hashed = await argon2.hash(password);
        await pool.query(
            `UPDATE users SET password = ? WHERE username = ? AND role = 'candidate'`,
            [hashed, candidate_id]
        );
        await pool.query(
            `UPDATE candidates SET is_registered = 1 WHERE user_id = ?`,
            [rows[0].user_id]
        );

        return res.status(200).json({ message: 'Registration successful. You can now log in.' });
    } catch (err) {
        console.error("Register Error:", err);
        return res.status(500).send('Server or Database error');
    }
};

// ฟังก์ชันอัปเดต Bio (Manifesto) ของผู้สมัคร
const updateBio = async (req, res) => {
    const { user_id, bio } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, message: 'user_id is required' });
    }

    try {
        // เช็คว่า user มีอยู่ใน candidates table หรือไม่
        const [existingCandidate] = await pool.query(
            `SELECT candidate_id FROM candidates WHERE user_id = ?`,
            [user_id]
        );

        if (existingCandidate.length > 0) {
            // ถ้ามี ให้ update policies
            await pool.query(
                `UPDATE candidates SET policies = ? WHERE user_id = ?`,
                [bio || '', user_id]
            );
        } else {
            // ถ้าไม่มี ให้ insert candidate record ใหม่
            await pool.query(
                `INSERT INTO candidates (user_id, policies, is_registered) VALUES (?, ?, 1)`,
                [user_id, bio || '']
            );
        }

        // ดึงข้อมูลที่อัปเดตแล้วมาส่งกลับไป
        const [updatedCandidate] = await pool.query(
            `SELECT candidate_id, policies AS bio, name, profile_picture FROM candidates WHERE user_id = ?`,
            [user_id]
        );

        const candidateData = updatedCandidate[0] || {};

        return res.status(200).json({
            success: true,
            message: 'Manifesto updated successfully',
            user: {
                candidate_id: candidateData.candidate_id || null,
                bio: candidateData.bio || bio || '',
                profile_picture: candidateData.profile_picture || null,
                display_name: candidateData.name || null
            }
        });
    } catch (err) {
        console.error("Update Bio Error:", err);
        return res.status(500).json({ success: false, message: 'Server or Database error' });
    }
};

const logout = (req, res) => {
    req.session.destroy(() => {
        res.status(200).json({ message: 'Logged out' });
    });
};

module.exports = {
    login,
    logout,
    verifyCandidate,
    register,
    updateBio
};