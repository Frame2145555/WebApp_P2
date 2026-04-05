const path = require('path');
const express = require('express');
const argon2 = require('@node-rs/argon2'); // ของเพื่อนใช้ตัวนี้ในการเข้ารหัส
const pool = require('./db'); // ของคุณใช้ตัวนี้เชื่อมต่อ Database (ใช้ตัวนี้เป็นหลัก)
const app = express();

// 1. ตั้งค่าให้อ่านข้อมูล JSON ที่ Frontend ส่งมาได้
app.use(express.json());

// ==========================================
// 2. ตั้งค่า Static Files (โฟลเดอร์หน้าเว็บ)
// ==========================================
// ฝั่งเพื่อน: โฟลเดอร์หน้า Login และ Register
app.use('/public', express.static(path.join(__dirname, 'index-Login-register(tua)/public')));
app.use('/css', express.static(path.join(__dirname, 'index-Login-register(tua)/css')));
app.use('/img', express.static(path.join(__dirname, 'index-Login-register(tua)/img')));

// ฝั่งคุณ: โฟลเดอร์หน้า Admin และ Voter
app.use('/AdminNew', express.static(path.join(__dirname, 'AdminNew')));
app.use('/dashbordVoter/WebAppProject', express.static(path.join(__dirname, 'WebAppProject')));


// ==========================================
// 3. Routes สำหรับเปิดหน้า HTML (ของเพื่อน)
// ==========================================
app.get('/index', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, 'index-Login-register(tua)/public/index.html'));
});

app.get('/Login', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, 'index-Login-register(tua)/public/Login.html'));
});

app.get('/Candidate-Register', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, 'index-Login-register(tua)/public/Candidate-register.html'));
});


// ==========================================
// 4. API ฝั่ง Authentication (Login / Register ของเพื่อน)
// ==========================================
app.post('/api/login', async function (req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Please enter username and password');
    }

    const sql = "SELECT user_id, password, role FROM users WHERE username=?";

    try {
        const [results] = await pool.query(sql, [username]);

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

        // 🚨 แก้ไข Path Redirect ให้ชี้มาที่หน้าของคุณอย่างถูกต้อง!
        const redirectMap = {
            admin: '/AdminNew/views/Term.html', 
            candidate: '/Candidate-Dashboard', // ถ้ามีโฟลเดอร์อื่น อย่าลืมแก้ให้ตรงนะ
            voter: '/Voter-Dashboard',         // ถ้ามีโฟลเดอร์อื่น อย่าลืมแก้ให้ตรงนะ
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

// ── REGISTER STEP 1: ยืนยัน Candidate ID ──
app.get('/api/register/verify/:candidate_id', async (req, res) => {
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
        console.error(err);
        return res.status(500).send('Server or Database error');
    }
});

// ── REGISTER STEP 2: ตั้ง Password ──
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
        const [rows] = await pool.query(
            `SELECT user_id, password FROM users
             WHERE username = ? AND role = 'candidate'`,
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
        console.error(err);
        return res.status(500).send('Server or Database error');
    }
});


// ==========================================
// 5. API ฝั่งของคุณ (Admin / Voting / ฯลฯ)
// ==========================================
// API สำหรับทดสอบว่าเซิร์ฟเวอร์ทำงานไหม
app.get('/api/status', (req, res) => {
    res.json({ message: "Sever is running" });
});

// API สำหรับทดสอบดึงข้อมูลจาก Database
app.get('/api/test-db', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM Candidates");
        res.json({ status: "success", message: "เชื่อมต่อ Database สำเร็จ!", data: rows });
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ status: "error", message: "ต่อ Database ไม่ติด เช็ค XAMPP ด่วน!" });
    }
});

// นำเข้า Routes จากไฟล์แยกของคุณ
// (ปิด auth.routes ไว้ เพราะเราย้าย Login/Register มารวมในไฟล์นี้ให้ใช้งานง่ายแล้ว)
// const authRoutes = require('./routes/auth.routes');
// app.use('/api/auth', authRoutes);

const adminRoutes = require('./routes/admin.routes');
app.use('/api/admin', adminRoutes);

const votingRoutes = require('./routes/voting.routes');
app.use('/api/voting', votingRoutes);


// ==========================================
// 6. Error Handler & Start Server
// ==========================================
// error handler ช่วยจับ error ที่หลุดออกมาและตอบเป็น JSON
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ status: 'error', message: err?.message || 'Server Error' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});