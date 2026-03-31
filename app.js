const path = require('path');
const express = require('express');
const pool = require('./db'); // ดึงตัวเชื่อมต่อฐานข้อมูลที่เราเขียนไว้มาใช้
const app = express();

// ตั้งค่าให้อ่านข้อมูล JSON ที่ Frontend ส่งมาได้
app.use(express.json());

//API สำหรับทดสอบว่าเซิร์ฟเวอร์ทำงานไหม
app.get('/api/status', (req, res) => {
    res.json({ message: "Sever is running" });
});

const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

const adminRoutes = require('./routes/admin.routes');
app.use('/api/admin', adminRoutes);

const votingRoutes = require('./routes/voting.routes');
app.use('/api/voting', votingRoutes);

// สำหรับเปิด .htnl ที่อยู่ใน folder AdminNew
app.use('/AdminNew', express.static(path.join(__dirname, 'AdminNew')));

//API สำหรับทดสอบดึงข้อมูลจาก Database
app.get('/api/test-db', async (req, res) => {
    try {
        // ลองดึงข้อมูลผู้สมัครทั้งหมดออกมาดู
        const [rows] = await pool.query("SELECT * FROM Candidates");
        res.json({ 
            status: "success", 
            message: "เชื่อมต่อ Database สำเร็จ!", 
            data: rows 
        });
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ status: "error", message: "ต่อ Database ไม่ติด เช็ค XAMPP ด่วน!" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Sever running is http://localhost:${PORT}`);
});