const path = require('path');
const express = require('express');
const pool = require('./db'); 
const app = express();

// ==========================================
// 1. ตั้งค่าพื้นฐาน & Static Files
// ==========================================
app.use(express.json());

app.use('/public', express.static(path.join(__dirname, 'index-Login-register(tua)/public')));
app.use('/css', express.static(path.join(__dirname, 'index-Login-register(tua)/css')));
app.use('/img', express.static(path.join(__dirname, 'index-Login-register(tua)/img')));
app.use('/AdminNew', express.static(path.join(__dirname, 'AdminNew')));
app.use('/dashbordVoter/WebAppProject', express.static(path.join(__dirname, 'WebAppProject')));

// ==========================================
// 2. Routes สำหรับเปิดหน้า HTML (ของเพื่อน)
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
// 3. API สำหรับทดสอบระบบ (Test APIs)
// ==========================================
app.get('/api/status', (req, res) => {
    res.json({ message: "Server is running" });
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

// ==========================================
// 4. นำเข้า API Routes (ประกาศแค่รอบเดียว!)
// ==========================================
const authRoutes = require('./routes/auth.routes');
app.use('/api', authRoutes);

const adminRoutes = require('./routes/admin.routes');
app.use('/api/admin', adminRoutes);

const votingRoutes = require('./routes/voting.routes');
app.use('/api/voting', votingRoutes);

// ==========================================
// 5. Error Handler & Start Server
// ==========================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ status: 'error', message: err?.message || 'Server Error' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});