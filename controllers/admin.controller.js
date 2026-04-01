const pool = require('../db');

// Add Candidate

const createCandidate = async (req, res) => {
    // 1. รับค่าที่ Admin ส่งมา (หน้าเว็บต้องส่ง term_id มาด้วยนะ!)
    const { candidate_id, name, term_id } = req.body;

    // 2. ดักไว้ก่อน เผื่อส่งมาไม่ครบ
    if (!candidate_id || !name || !term_id) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ (ID, ชื่อ และ Term ID) เดี่ยวโดนไม้กวาดฟาด!" });
    }

    try {
        // สังเกตว่าเราไม่ต้องไป SELECT หา is_active แล้ว! 
        // จับยัดลง Database ตาม term_id ที่ส่งมาเลย 
        // (เตือนก่อนนะจ่ะ: user_id จะเป็น NULL ไปก่อน รอให้ผู้สมัครมา Register ทีหลัง)
        await pool.query(
            "INSERT INTO candidates (candidate_id, name, is_registered, term_id) VALUES (?, ?, 0, ?)",
            [candidate_id, name, term_id]
        );

        res.status(200).json({
            status: "success",
            message: `สร้างรหัสผู้สมัคร ${candidate_id} สำหรับ ${name} ลงในเทอม ${term_id} ได้แวว`
        });

    } catch (error) {
        console.error("Admin Create Candidate Error:", error);

        // เช็คกรณี Admin เผลอสร้าง ID ซ้ำ
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: "Candidate ID นี้มีในระบบแล้วนาจา" });
        }
        res.status(500).json({ message: "Server กาก ไปแก้แปป" });
    }
};

// API: ดึงรายชื่อผู้สมัคร, นโยบาย, สถานะ และผลโหวต และ Search
const getCandidates = async (req, res) => {
    const { term_id } = req.query;

    const connection = await pool.getConnection();
    try {
        let query = "SELECT * FROM candidates";
        let params = [];

        // ถ้ามีการส่ง term_id มา ให้กรองข้อมูลด้วย
        if (term_id) {
            query += " WHERE term_id = ?";
            params.push(term_id);
        }

        const [candidates] = await connection.query(query, params);
        res.status(200).json({ status: "success", data: candidates });
    } catch (error) {
        console.error("Get Candidates Error:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้สมัคร" });
    } finally {
        connection.release();
    }
};

// API: เปิด/ปิด สถานะของ candiate (Enable/Disable)
const toggleCandidateStatus = async (req, res) => {
    // รับรหัสผู้สมัคร และสถานะใหม่ (1 = เปิด, 0 = ปิด)
    const { candidate_id, status } = req.body;

    if (!candidate_id || status === undefined) {
        return res.status(400).json({ message: "ส่งข้อมูลมาให้ครบดิ" });
    }

    const connection = await pool.getConnection();
    try {
        // 1. หา user_id ของผู้สมัครคนนี้ก่อน
        const [candidate] = await connection.query("SELECT user_id FROM candidates WHERE candidate_id = ?", [candidate_id]);

        if (candidate.length === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลผู้สมัครในระบบ" });
        }

        const userId = candidate[0].user_id;

        // ถ้า user_id เป็น null แปลว่าแอดมินเพิ่งสร้างรหัสให้ แต่เค้ายังไม่เคยเข้าระบบมาลงทะเบียนเลย
        if (!userId) {
            return res.status(400).json({ message: "ผู้สมัครคนนี้ยังไม่ได้ลงทะเบียนเข้าระบบ ไม่สามารถเปลี่ยนสถานะได้" });
        }

        // อัปเดตสถานะในตาราง users
        await connection.query("UPDATE users SET is_enable = ? WHERE user_id = ?", [status, userId]);

        res.status(200).json({ 
            status: "success", 
            message: `อัปเดตสถานะของ ${candidate_id} เป็น ${status === 1 ? 'Enabled' : 'Disabled'} ได้แวว` 
        });

    } catch (error) {
        console.error("Toggle Status Error:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    } finally {
        connection.release();
    }
};

// API: ลบผู้ candidate (Delete Candidate)
const deleteCandidate = async (req, res) => {
    const { id } = req.params; // รับรหัสผู้สมัครจาก URL (เช่น /api/admin/candidate/8)

    if (!id) {
        return res.status(400).json({ message: "กรุณาระบุรหัสผู้สมัครที่ต้องการลบ" });
    }

    const connection = await pool.getConnection();
    try {
        // สั่งลบข้อมูลจากตาราง candidates
        const [result] = await connection.query("DELETE FROM candidates WHERE candidate_id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลผู้สมัครนี้ในระบบ" });
        }

        res.status(200).json({ 
            status: "success", 
            message: `ลบผู้สมัครรหัส ${id} ออกจากระบบเรียบร้อยแล้ว` 
        });

    } catch (error) {
        console.error("Delete Candidate Error:", error);
        
        // ดัก Error กรณีที่ผู้สมัครคนนี้มี "คะแนนโหวต" ไปแล้ว (ฐานข้อมูลจะไม่ยอมให้ลบ เพื่อป้องกันข้อมูลพัง)
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ message: "ไม่สามารถลบได้ เนื่องจากผู้สมัครคนนี้มีคะแนนโหวตในระบบแล้ว (แนะนำให้ใช้การ Disable แทน)" });
        }

        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    } finally {
        connection.release();
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

    // 2. อุดช่องโหว่: ดักความยาวและรูปแบบของ Citizen ID (เลข 13 หลัก)
    const citizenRegex = /^\d{13}$/;
    if (!citizenRegex.test(citizen_id)) {
        return res.status(400).json({ message: "รหัสบัตรประชาชนต้องเป็นตัวเลข 13 หลักเท่านั้น!" });
    }

    // 3. อุดช่องโหว่: ดักรูปแบบของ Laser ID (อักษร 2 ตัว + เลข 10 ตัว)
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

// API: ดึงข้อมูลรอบการเลือกตั้งทั้งหมด (Get All Terms)
const getTerms = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        // ดึงข้อมูลทั้งหมดจากตาราง terms เรียงจาก term_id ล่าสุดขึ้นก่อน
        const [terms] = await connection.query("SELECT * FROM terms ORDER BY term_id DESC");
        
        res.status(200).json({ 
            status: "success", 
            data: terms 
        });
    } catch (error) {
        console.error("Get Terms Error:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลรอบการเลือกตั้ง" });
    } finally {
        connection.release();
    }
};

// API: สร้างรอบการเลือกตั้งใหม่ (Create Term)
const createTerm = async (req, res) => {
    // รับค่าจากหน้าต่าง Modal (ชื่อเทอม และ คำอธิบาย)
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ message: "ตั้งชื่อก่อนดิ เดี่ยวโดนฟาด" });
    }

    const connection = await pool.getConnection();
    try {
        // แอดมินสร้างเทอมใหม่ ให้ตั้งค่าเริ่มต้น is_active = 0 (ยังไม่เปิดโหวต) ไปก่อน
        await connection.query(
            "INSERT INTO terms (name, description, is_active) VALUES (?, ?, 0)",
            [name, description || ""]
        );

        res.status(200).json({ 
            status: "success", 
            message: `สร้างรอบการเลือกตั้ง ${name} สำเร็จ!` 
        });
    } catch (error) {
        console.error("Create Term Error:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการสร้างรอบการเลือกตั้ง" });
    } finally {
        connection.release();
    }
};

// API: ดึงข้อมูลสถิติหน้า Dashboard (กรองตาม Term)
const getDashboardStats = async (req, res) => {
    // รับค่า term_id จาก Query String (เช่น /api/admin/dashboard?term_id=1)
    const { term_id } = req.query; 

    if (!term_id) {
        return res.status(400).json({ message: "กรุณาระบุ term_id ที่ต้องการดูข้อมูล" });
    }

    const connection = await pool.getConnection();
    try {
        // 1. ดึงข้อมูลผู้สมัครและคะแนนโหวต เฉพาะของเทอมนี้ (เรียงจากคะแนนมากไปน้อย)
        const [candidates] = await connection.query(
            `SELECT candidate_id, name, score 
             FROM candidates 
             WHERE term_id = ? 
             ORDER BY score DESC`, 
            [term_id]
        );

        // 2. (ถ้ามี) ดึงสถิติคนโหวตว่าใช้สิทธิ์ไปกี่คนแล้วในเทอมนี้
        // const [voterStats] = await connection.query("SELECT COUNT(*) as total_voted FROM votes WHERE term_id = ?", [term_id]);

        res.status(200).json({
            status: "success",
            data: {
                candidates: candidates,
                // total_voted: voterStats[0].total_voted
            }
        });

    } catch (error) {
        console.error("Get Dashboard Stats Error:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ" });
    } finally {
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

        // สเตป 1: สั่ง "ปิด (0)" ทุกเทอมที่มีอยู่ในระบบก่อนเลย (ล้างไพ่)
        await connection.query("UPDATE terms SET is_active = 0");

        // สเตป 2: สั่ง "เปิด (1)" เฉพาะเทอมที่แอดมินเลือกมาเท่านั้น!
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

// // API: เปิด/ปิด ระบบโหวต (Toggle Term Status)
// const toggleTermStatus = async (req, res) => {
//     const { id } = req.params; // รับค่า term_id จาก URL
//     const { status } = req.body; // รับค่า 1 (เปิด) หรือ 0 (ปิด) จากหน้าบ้าน

//     const connection = await pool.getConnection();
//     try {
//         // เริ่ม Transaction (ถ้ามีอะไรพัง ให้ยกเลิกคำสั่ง SQL ทั้งหมดที่ทำค้างไว้)
//         await connection.beginTransaction();

//         // กฎเหล็ก: ถ้าแอดมินสั่ง "เปิดโหวต" (status = 1) 
//         // เราต้องไปสั่ง "ปิด" เทอมอื่นๆ ทั้งหมดก่อน เพื่อไม่ให้มีการโหวตซ้อนกันหลายปี!
//         if (status === 1) {
//             await connection.query("UPDATE terms SET is_active = 0"); 
//         }

//         // จากนั้นค่อยมา "เปิด" หรือ "ปิด" เฉพาะเทอมที่เราเลือกจริงๆ
//         await connection.query("UPDATE terms SET is_active = ? WHERE term_id = ?", [status, id]);

//         // ยืนยันการบันทึกข้อมูลลง Database
//         await connection.commit();

//         res.status(200).json({ 
//             status: "success", 
//             message: status === 1 ? "เปิดระบบโหวตเรียบร้อยแล้ว!" : "ปิดระบบโหวตเรียบร้อยแล้ว!" 
//         });

//     } catch (error) {
//         // ถ้าพังกลางคัน ให้ย้อนกลับ (Rollback) ข้อมูลจะได้ไม่เน่า
//         await connection.rollback(); 
//         console.error("Toggle Term Status Error:", error);
//         res.status(500).json({ message: "Server Error: ไม่สามารถเปลี่ยนสถานะได้" });
//     } finally {
//         connection.release();
//     }
// };

// const getTermById = async (req, res) => {
//     const { id } = req.params; // ดูดเลข ID มาจาก URL (เช่น /api/admin/term/3)

//     try {
//         // ยิง SQL ไปถาม Database ว่าขอข้อมูลของ ID นี้หน่อย
//         const [terms] = await pool.query("SELECT * FROM terms WHERE term_id = ?", [id]);
        
//         // ถ้าหาไม่เจอ (พิมพ์ ID มั่วมา)
//         if (terms.length === 0) {
//             return res.status(404).json({ message: "ไม่พบข้อมูลปีการศึกษานี้" });
//         }

//         // ถ้าเจอ: ส่งก้อนข้อมูลกลับไปให้หน้าเว็บ (Frontend)
//         res.status(200).json({ status: "success", data: terms[0] });

//     } catch (error) {
//         console.error("Get Term Error:", error);
//         res.status(500).json({ message: "Server พังจ้า ดึงข้อมูลไม่ได้" });
//     }
// };

module.exports = {
    createCandidate,
    createVoter,
    setActiveTerm,
    getCandidates,
    toggleCandidateStatus,
    deleteCandidate,
    getTerms,
    createTerm,
    getDashboardStats,
    // toggleTermStatus,
    // getTermById
};