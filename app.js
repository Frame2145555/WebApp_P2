const path = require('path');
const express = require('express');
const pool = require('./db'); 
const app = express();

// 1. ตั้งค่าพื้นฐาน & Static Files
app.use(express.json());

// ไฟล์ JS กลางของระบบ (ไม่ทับกับ /public เดิมของหน้า login)
app.use('/public/js', express.static(path.join(__dirname, 'public/js')));
app.use('/public', express.static(path.join(__dirname, 'index-Login-register(tua)/public')));
app.use('/css', express.static(path.join(__dirname, 'index-Login-register(tua)/css')));
app.use('/img', express.static(path.join(__dirname, 'index-Login-register(tua)/img')));
app.use('/AdminNew', express.static(path.join(__dirname, 'AdminNew')));
app.use('/candidate_system', express.static(path.join(__dirname, 'candidate_system')));
app.use('/dashbordVoter/WebAppProject', express.static(path.join(__dirname, 'dashbordVoter/WebAppProject')));

// 2. Routes สำหรับเปิดหน้า HTML (tua)
app.get('/index', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, 'index-Login-register(tua)/public/index.html'));
});

app.get('/Login', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, 'index-Login-register(tua)/public/Login.html'));
});

app.get('/Candidate-Register', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, 'index-Login-register(tua)/public/Candidate-register.html'));
});

// 3. API สำหรับทดสอบระบบ (Test APIs)
app.get('/api/status', (req, res) => {
    res.json({ message: "Server is running" });
});

// API สำหรับหน้า Candidate Dashboard (ผลคะแนนตามเทอมที่ active)
app.get('/api/results', async (req, res) => {
    try {
        const [activeTermRows] = await pool.query(
            'SELECT term_id FROM terms WHERE is_active = 1 ORDER BY term_id DESC LIMIT 1'
        );

        const activeTermId = activeTermRows[0]?.term_id;

        if (!activeTermId) {
            return res.json([]);
        }

        const [rows] = await pool.query(
            `SELECT
                c.candidate_id,
                c.user_id,
                u.username,
                COALESCE(NULLIF(c.name, ''), u.username, CONCAT('Candidate #', c.candidate_id)) AS display_name,
                c.policies AS bio,
                c.score AS vote_count
             FROM candidates c
             LEFT JOIN users u ON u.user_id = c.user_id
             WHERE c.term_id = ?
             ORDER BY c.score DESC, c.candidate_id ASC`,
            [activeTermId]
        );

        return res.json(rows);
    } catch (error) {
        console.error('Results API Error:', error);
        return res.status(500).json({ message: 'โหลดผลคะแนนไม่สำเร็จ' });
    }
});

// 🚨 API เพิ่มเติมสำหรับ Candidate Dashboard

// 1. อัปเดต Manifesto (Bio)
app.post('/api/update-bio', async (req, res) => {
    const { user_id, bio } = req.body;
    try {
        // ใน Database คุณใช้คอลัมน์ 'policies' เก็บข้อมูล Bio
        await pool.query("UPDATE candidates SET policies = ? WHERE user_id = ?", [bio, user_id]);
        res.json({ user: { bio: bio } }); // ตอบกลับรูปแบบที่ Frontend ต้องการ
    } catch (error) {
        console.error('Update Bio Error:', error);
        res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
    }
});

// 2. อัปเดตรูปโปรไฟล์ (Profile Picture)
app.post('/api/update-profile-picture', async (req, res) => {
    const { user_id, imageDataUrl } = req.body;
    try {
        await pool.query("UPDATE candidates SET profile_picture = ? WHERE user_id = ?", [imageDataUrl, user_id]);
        res.json({ user: { profile_picture: imageDataUrl } });
    } catch (error) {
        console.error('Update Profile Pic Error:', error);
        res.status(500).json({ message: 'ไม่สามารถอัปเดตรูปภาพได้' });
    }
});

app.get('/api/test-db', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM Candidates");
        res.json({ status: "success", message: "เชื่อมต่อ Database สำเร็จ!", data: rows });
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ status: "error", message: "ต่อ Database ไม่ติด!" });
    }
});

// 4. นำเข้า API Routes (ประกาศแค่รอบเดียว!)
const authRoutes = require('./routes/auth.routes');
app.use('/api', authRoutes);

const adminRoutes = require('./routes/admin.routes');
app.use('/api/admin', adminRoutes);

const votingRoutes = require('./routes/voting.routes');
app.use('/api/voting', votingRoutes);

// 5. Error Handler & Start Server
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ status: 'error', message: err?.message || 'Server Error' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});