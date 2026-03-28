const pool = require('../db');

const createCandidate = async (req, res) => {
    // รับค่าที่ Admin ส่งมา
    const { candidate_id, name } = req.body;

    if (!candidate_id || !name) {
        return res.status(400).json({ message: "กรุณากรอก Candidate ID และ ชื่อ ให้ครบถ้วน" });
    }

    try {
        // บันทึก ID นี้ลงฐานข้อมูล และตั้งค่า is_registered = 0 (ยังไม่สมัคร)
        await pool.query(
            "INSERT INTO Candidates (candidate_id, name, is_registered) VALUES (?, ?, 0)",
            [candidate_id, name]
        );

        res.json({ 
            status: "success", 
            message: `สร้างรหัสผู้สมัคร ${candidate_id} สำหรับ ${name} สำเร็จ!` 
        });

    } catch (error) {
        console.error("Admin Create Candidate Error:", error);
        // เช็คกรณี Admin เผลอสร้าง ID ซ้ำ
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: "Candidate ID นี้มีในระบบแล้ว!" });
        }
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
};

module.exports = { createCandidate };