const express = require('express');
const path = require('path');
const argon2 = require('@node-rs/argon2');
const con = require('./db');
const app = express();

app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'css')))
app.use('/img', express.static(path.join(__dirname, 'img')))

// generate a hashed password
app.get('/password/:raw', function (req, res) {
    const raw = req.params.raw;
    const hash = argon2.hashSync(raw);
    res.status(200).send(hash);
});

// Login
app.post('/api/login', async function (req, res) {
    const { username, password } = req.body; // ← เอา role ออก

    if (!username || !password) {
        return res.status(400).send('Please enter username and password');
    }

    const sql = "SELECT user_id, password, role FROM users WHERE username=?";

    try {
        const [results] = await con.query(sql, [username]);

        if (results.length !== 1) {
            return res.status(401).send('Wrong username');
        }

        const role = results[0].role;

        if (results[0].password === 'NOT_REGISTERED') {
            return res.status(403).send('Candidate has not registered yet');
        }

        const same = await argon2.verify(results[0].password, password);
        if (!same) {
            return res.status(401).send('Wrong password');
        }

        const { user_id } = results[0];

        const redirectMap = {
            admin: '/admin/inventory',
            candidate: '/Candidate-Dashboard',
            voter: '/Voter-Dashboard',
        };

        const redirect = redirectMap[role];
        if (!redirect) {
            return res.status(403).send('Unknown role');
        }

        return res.status(200).json({ redirect, user_id, role });

    } catch (err) {
        console.error(err);
        return res.status(500).send('Server or Database error');
    }
});

// ADMIN: สร้าง Candidate
app.post('/api/admin/candidate', async (req, res) => {
    const { candidate_id, name, term_id } = req.body;

    if (!candidate_id || !name || !term_id) {
        return res.status(400).json({ error: 'candidate_id, name and term_id are required' });
    }

    try {
        const [existing] = await con.query(
            'SELECT user_id FROM users WHERE username = ?',
            [candidate_id]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Candidate ID already exists' });
        }

        // INSERT users ใช้ NOT_REGISTERED แทน NULL
        const [userResult] = await con.query(
            `INSERT INTO users (username, password, role, is_enable)
             VALUES (?, 'NOT_REGISTERED', 'candidate', 1)`,
            [candidate_id]
        );

        const newUserId = userResult.insertId;

        await con.query(
            `INSERT INTO candidates (user_id, name, is_registered, term_id)
             VALUES (?, ?, 0, ?)`,
            [newUserId, name, term_id]
        );

        const inviteLink = `http://localhost:3000/Candidate-Register?id=${candidate_id}`;

        return res.status(201).json({
            message: 'Candidate created successfully',
            candidate_id,
            inviteLink,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).send('Server or Database error');
    }
});

// ADMIN: ดูรายชื่อ candidates ทั้งหมด
app.get('/api/admin/candidate', async (req, res) => {
    try {
        const [rows] = await con.query(
            `SELECT u.user_id, u.username AS candidate_id, c.name, c.is_registered, c.term_id
             FROM users u
             JOIN candidates c ON u.user_id = c.user_id
             WHERE u.role = 'candidate'
             ORDER BY u.user_id DESC`
        );
        return res.json({ candidates: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).send('Server or Database error');
    }
});

// REGISTER STEP 1: ยืนยัน Candidate ID
app.get('/api/register/verify/:candidate_id', async (req, res) => {
    const { candidate_id } = req.params;

    try {
        const [rows] = await con.query(
            `SELECT u.user_id, c.name, u.password
             FROM users u
             JOIN candidates c ON u.user_id = c.user_id
             WHERE u.username = ? AND u.role = 'candidate'`,
            [candidate_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invalid Candidate ID' });
        }

        // เช็คด้วย NOT_REGISTERED แทน NULL
        if (rows[0].password !== 'NOT_REGISTERED') {
            return res.status(409).json({ error: 'This Candidate ID has already been registered' });
        }

        return res.json({
            valid: true,
            name: rows[0].name,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).send('Server or Database error');
    }
});

// REGISTER STEP 2: ตั้ง Password
app.post('/api/register', async (req, res) => {
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
        const [rows] = await con.query(
            `SELECT user_id, password FROM users
             WHERE username = ? AND role = 'candidate'`,
            [candidate_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invalid Candidate ID' });
        }

        // เช็คด้วย NOT_REGISTERED แทน NULL
        if (rows[0].password !== 'NOT_REGISTERED') {
            return res.status(409).json({ error: 'Already registered' });
        }

        const hashed = await argon2.hash(password);

        await con.query(
            `UPDATE users SET password = ? WHERE username = ? AND role = 'candidate'`,
            [hashed, candidate_id]
        );

        await con.query(
            `UPDATE candidates SET is_registered = 1 WHERE user_id = ?`,
            [rows[0].user_id]
        );

        return res.status(200).json({ message: 'Registration successful. You can now log in.' });

    } catch (err) {
        console.error(err);
        return res.status(500).send('Server or Database error');
    }
});

app.get('/index', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/Login', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, 'public/Login.html'));
});

app.get('/Candidate-Register', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, 'public/Candidate-register.html'));
});

app.listen(3000, function () {
    console.log('server is running at port 3000');
});