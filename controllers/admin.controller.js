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
const argon2 = require('argon2');

const createVoter = async (req, res) => {
    // รับค่าที่ Admin ส่งมาจากหน้าเว็บ (ตาม API Spec)
    const { citizen_id, laser_id, confirm_laser_id, term_id } = req.body;

    // 1. เช็คว่าส่งค่ามาครบไหม
    if (!citizen_id || !laser_id || !term_id) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ (citizen_id, laser_id, term_id)" });
    }

    // 🚨 2. อุดช่องโหว่: ดักความยาวและรูปแบบของ Citizen ID (เลข 13 หลัก)
    const citizenRegex = /^\d{13}$/;
    if (!citizenRegex.test(citizen_id)) {
        return res.status(400).json({ message: "รหัสบัตรประชาชนต้องเป็นตัวเลข 13 หลักเท่านั้น!" });
    }

    // 🚨 3. อุดช่องโหว่: ดักรูปแบบของ Laser ID (อักษร 2 ตัว + เลข 10 ตัว)
    const laserRegex = /^[A-Za-z]{2}\d{10}$/;
    if (!laserRegex.test(laser_id)) {
        return res.status(400).json({ message: "รหัสหลังบัตร (Laser ID) ไม่ถูกต้อง (ต้องเป็นภาษาอังกฤษ 2 ตัว ตามด้วยตัวเลข 10 ตัว)" });
    }

    if (laser_id !== confirm_laser_id) {
        return res.status(400).json({ message: "รหัส Laser ID ทั้ง 2 ช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง" });
    }

    // ดึง connection ออกมาเพื่อทำ Transaction ... (โค้ดด้านล่างใช้ของเดิมได้เลยครับ)
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. เข้ารหัส Laser ID ก่อนบันทึกลง Database (เพื่อความปลอดภัย)
        const hashedPassword = await argon2.hash(laser_id);

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

// API: เปิดวาระการเลือกตั้ง (เปิดได้แค่ทีละ 1 เทอม)
const setActiveTerm = async (req, res) => {
    const { term_id } = req.body;

    if (!term_id) {
        return res.status(400).json({ message: "กรุณาส่ง term_id ที่ต้องการเปิดใช้งาน" });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 🚨 สเตป 1: สั่ง "ปิด (0)" ทุกเทอมที่มีอยู่ในระบบก่อนเลย (ล้างไพ่)
        await connection.query("UPDATE terms SET is_active = 0");

        // 🟢 สเตป 2: สั่ง "เปิด (1)" เฉพาะเทอมที่แอดมินเลือกมาเท่านั้น!
        const [result] = await connection.query(
            "UPDATE terms SET is_active = 1 WHERE term_id = ?", 
            [term_id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "ไม่พบข้อมูลเทอมนี้ในระบบ" });
        }

        await connection.commit();
        res.status(200).json({ 
            status: "success", 
            message: `เปิดระบบการเลือกตั้งสำหรับวาระที่ ${term_id} เรียบร้อยแล้ว (เทอมอื่นๆ ถูกปิดอัตโนมัติ)` 
        });

    } catch (error) {
        await connection.rollback();
        console.error("Set Active Term Error:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    } finally {
        connection.release();
    }
};

//export ทั้ง 2 ฟังก์ชันออกไปให้ route
module.exports = { 
    createCandidate, 
    createVoter, 
    setActiveTerm 
};