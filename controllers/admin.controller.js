const pool = require('../db');

// Add Candidate

const createCandidate = async (req, res) => {
    // รับค่าที่ Admin ส่งมา (หน้าเว็บ)
    const { candidate_id, name } = req.body;

    if (!candidate_id || !name) {
        return res.status(400).json({ message: "กรุณากรอก Candidate ID และ ชื่อ ให้ครบถ้วน" });
    }

    try {
        // ✨ ดึง term_id ของวาระที่กำลังเปิดโหวตอยู่ (is_active = 1) อัตโนมัติ
        const [activeTerms] = await pool.query("SELECT term_id FROM terms WHERE is_active = 1 LIMIT 1");
        
        if (activeTerms.length === 0) {
            return res.status(400).json({ message: "ไม่พบวาระการเลือกตั้งที่เปิดอยู่ กรุณาเปิดระบบก่อน" });
        }
        const currentTermId = activeTerms[0].term_id;

        // บันทึก ID นี้ลงฐานข้อมูล (ใส่ term_id ลงไปด้วย)
        // หมายเหตุ: user_id จะเป็น NULL ไปก่อน รอให้ผู้สมัครมา Register ทีหลัง
        await pool.query(
            "INSERT INTO candidates (candidate_id, name, is_registered, term_id) VALUES (?, ?, 0, ?)",
            [candidate_id, name, currentTermId]
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


// Add Voter
const bcrypt = require('bcrypt'); // อย่าลืมติดตั้ง npm install bcrypt นะครับ (ใช้เข้ารหัสรหัสผ่าน)

const createVoter = async (req, res) => {
    // รับค่าที่ Admin ส่งมาจากหน้าเว็บ (ตาม API Spec)
    const { citizen_id, laser_id, term_id } = req.body;

    if (!citizen_id || !laser_id || !term_id) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ (citizen_id, laser_id, term_id)" });
    }

    // ดึง connection ออกมาเพื่อทำ Transaction (ป้องกันข้อมูลพังกลางคัน)
    const connection = await pool.getConnection(); 
    
    try {
        await connection.beginTransaction();

        // 1. เข้ารหัส Laser ID ก่อนบันทึกลง Database (เพื่อความปลอดภัย)
        const hashedPassword = await bcrypt.hash(laser_id, 10);

        // 2. บันทึกลงตาราง Users (citizen_id เป็น username, laser_id เป็น password, ให้ role = 'voter')
        const [userResult] = await connection.query(
            "INSERT INTO users (username, password, role, is_enable) VALUES (?, ?, 'voter', 1)",
            [citizen_id, hashedPassword]
        );
        
        // ดึง user_id ของคนที่เพิ่งถูกสร้างขึ้นมา
        const newUserId = userResult.insertId; 

        // 3. บันทึกลงตาราง Voters (เชื่อม user_id เข้ากับ term_id และเซ็ต is_voted = 0)
        await connection.query(
            "INSERT INTO voters (user_id, term_id, is_voted) VALUES (?, ?, 0)",
            [newUserId, term_id]
        );

        // ถ้าผ่านทั้ง 2 ตาราง ให้ยืนยันการบันทึก (Commit)
        await connection.commit();

        res.json({ 
            status: "success", 
            message: `เพิ่มรายชื่อ Voter (Citizen ID: ${citizen_id}) สำเร็จ!` 
        });

    } catch (error) {
        // ถ้าเกิด Error บรรทัดไหนก็ตาม ให้ยกเลิกการบันทึกข้อมูลทั้งหมด (Rollback)
        await connection.rollback(); 
        console.error("Admin Create Voter Error:", error);
        
        // เช็คกรณี Admin เผลอแอด Citizen ID ซ้ำ
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: "Citizen ID นี้มีอยู่ในระบบแล้ว!" });
        }
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
        
    } finally {
        // คืน connection กลับสู่ระบบ
        connection.release(); 
    }
};

//export ทั้ง 2 ฟังก์ชันออกไปให้ route
module.exports = { createCandidate, createVoter };