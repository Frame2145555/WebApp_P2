const path = require('path');
const express = require('express');
const pool = require('./db'); 
const app = express();
const multer = require('multer');
const fs = require('fs');

// 1. ตั้งค่าพื้นฐาน & Static Files
app.use(express.json());

if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

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

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. API สำหรับทดสอบระบบ (Test APIs)
app.get('/api/status', (req, res) => {
    res.json({ message: "Server is running" });
});

app.get('/TestLogin', (req, res) => {
    res.sendFile(path.join(__dirname, 'FrameFile', 'TestLogin.html'));
});

// 2. Route เปิดหน้า Voter Dashboard ตัวจริง
app.get('/Voter-Dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'VoterDashboard', 'views', 'VoterDash.html'));
});

app.use('/VoterDashboard/public', express.static(path.join(__dirname, 'VoterDashboard', 'public')));

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

// 2. อ่านข้อมูลส่วนตัว Candidate
app.get('/api/candidate/personal-info/:user_id', async (req, res) => {
    const { user_id } = req.params;

    if (!user_id) {
        return res.status(400).json({ message: 'user_id is required' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT user_id, personal_info
             FROM candidates
             WHERE user_id = ?
             LIMIT 1`,
            [user_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        const raw = rows[0].personal_info;
        let personalInfo = {};

        // รองรับข้อมูลเก่าที่อาจเป็น text ธรรมดา ไม่ใช่ JSON
        if (raw) {
            try {
                personalInfo = JSON.parse(raw);
            } catch (error) {
                personalInfo = { about: String(raw) };
            }
        }

        return res.json({ status: 'success', data: personalInfo });
    } catch (error) {
        console.error('Get Personal Info Error:', error);
        return res.status(500).json({ message: 'Failed to load personal information' });
    }
});

// 3. บันทึกข้อมูลส่วนตัว Candidate
app.post('/api/candidate/personal-info', async (req, res) => {
    const {
        user_id,
        full_name,
        student_id,
        faculty,
        major,
        phone,
        email,
        about
    } = req.body || {};

    if (!user_id) {
        return res.status(400).json({ message: 'user_id is required' });
    }

    const payload = {
        full_name: String(full_name || '').trim(),
        student_id: String(student_id || '').trim(),
        faculty: String(faculty || '').trim(),
        major: String(major || '').trim(),
        phone: String(phone || '').trim(),
        email: String(email || '').trim(),
        about: String(about || '').trim(),
        updated_at: new Date().toISOString()
    };

    try {
        const [result] = await pool.query(
            'UPDATE candidates SET personal_info = ? WHERE user_id = ?',
            [JSON.stringify(payload), user_id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        return res.json({ status: 'success', data: payload, message: 'Personal information saved successfully' });
    } catch (error) {
        console.error('Save Personal Info Error:', error);
        return res.status(500).json({ message: 'Failed to save personal information' });
    }
});


// ตั้งค่าระบบรับไฟล์ (Multer)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads'); // เก็บไฟล์ไว้ในโฟลเดอร์ uploads
    },
    filename: function (req, file, cb) {
        // ตั้งชื่อไฟล์ใหม่ให้ไม่ซ้ำกัน: เช่น candidate-5-171234567.jpg
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'candidate-' + req.body.user_id + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// API สำหรับรับและบันทึกไฟล์รูปภาพ
app.post('/api/update-profile-picture', upload.single('profile_image'), async (req, res) => {
    try {
        const { user_id } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ message: 'กรุณาเลือกไฟล์รูปภาพ' });
        }

        const newImageUrl = '/uploads/' + req.file.filename;

        // ดึงชื่อไฟล์รูปเก่ามาจาก Database ก่อน
        const [oldData] = await pool.query("SELECT profile_picture FROM candidates WHERE user_id = ?", [user_id]);
        const oldImageUrl = oldData[0]?.profile_picture;

        // อัปเดต Path ของรูปใหม่ลง Database
        await pool.query("UPDATE candidates SET profile_picture = ? WHERE user_id = ?", [newImageUrl, user_id]);
        
        // ตามไปลบไฟล์รูปเก่าทิ้งจากโฟลเดอร์ uploads
        if (oldImageUrl && oldImageUrl.startsWith('/uploads/')) {
            // แปลง URL ให้เป็นที่อยู่ไฟล์จริงๆ ในเครื่อง (เช่น C:\project\uploads\old-image.jpg)
            const oldFilePath = path.join(__dirname, oldImageUrl);
            
            // เช็คก่อนว่ามีไฟล์นี้อยู่จริงไหม ถ้ามีให้สั่งลบ (unlink)
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
            }
        }

        res.json({ status: 'success', user: { profile_picture: newImageUrl } });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ message: 'อัปโหลดรูปภาพไม่สำเร็จ' });
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

const voterDashboardRoutes = require('./routes/voter-dashboard.routes');
app.use('/api/voter-dashboard', voterDashboardRoutes);

// 5. Error Handler & Start Server
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ status: 'error', message: err?.message || 'Server Error' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});