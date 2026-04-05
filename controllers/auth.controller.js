const argon2 = require('@node-rs/argon2');
const pool = require('../db');

// ==========================================
// 1. ฟังก์ชัน Login
// ==========================================
const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Please enter username and password');
    }

    try {
        const [results] = await pool.query("SELECT user_id, password, role FROM users WHERE username=?", [username]);

        if (results.length !== 1) {
            return res.status(401).send('Wrong username');
        }

        const role = results[0].role;

        if (results[0].password === 'NOT_REGISTERED') {
            return res.status(403).send('Candidate has not registered yet');
        }

        let same = false;
        try {
            // 1. พยายามตรวจแบบ Hash ก้อนยาวๆ (ตามมาตรฐานความปลอดภัย)
            same = await argon2.verify(results[0].password, password);
        } catch (hashError) {
            // 2. ถ้า Error แปลว่ารหัสใน DB เป็นข้อความธรรมดา (เช่น password123)
            // ให้เอามาเทียบตรงๆ แบบเป๊ะๆ แทน (ใช้สำหรับช่วงพัฒนาระบบเท่านั้น!)
            if (results[0].password === password) {
                same = true;
                console.warn(`⚠️ คำเตือน: รหัสผ่านของ '${username}' ใน Database ยังไม่ได้ถูกเข้ารหัส (Hash)!`);
            }
        }

        if (!same) {
            return res.status(401).send('Wrong password');
        }

        const { user_id } = results[0];

        // Redirect ตาม Role
        const redirectMap = {
            admin: '/AdminNew/views/Term.html',
            candidate: '/Candidate-Dashboard',
            voter: '/Voter-Dashboard',
        };

        const redirect = redirectMap[role];
        if (!redirect) {
            return res.status(403).send('Unknown role');
        }

        return res.status(200).json({ redirect, user_id, role });
    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).send('Server or Database error');
    }
};

// ==========================================
// 2. ฟังก์ชันตรวจสอบสิทธิ์ก่อนตั้งรหัส (Verify Candidate)
// ==========================================
const verifyCandidate = async (req, res) => {
    const { candidate_id } = req.params;

    try {
        const [rows] = await pool.query(
            `SELECT u.user_id, c.name, u.password
             FROM users u
             JOIN candidates c ON u.user_id = c.user_id
             WHERE u.username = ? AND u.role = 'candidate'`,
            [candidate_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invalid Candidate ID' });
        }

        if (rows[0].password !== 'NOT_REGISTERED') {
            return res.status(409).json({ error: 'This Candidate ID has already been registered' });
        }

        return res.json({ valid: true, name: rows[0].name });

    } catch (err) {
        console.error("Verify Error:", err);
        return res.status(500).send('Server or Database error');
    }
};

// ==========================================
// 3. ฟังก์ชันตั้งรหัสผ่านใหม่ (Register)
// ==========================================
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
        const [rows] = await pool.query(
            `SELECT user_id, password FROM users WHERE username = ? AND role = 'candidate'`,
            [candidate_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invalid Candidate ID' });
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

// ส่งออกไปให้ Router ใช้
module.exports = { 
    login, 
    verifyCandidate, 
    register 
};