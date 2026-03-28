//Login
const pool = require('../db'); // ดึงไฟล์เชื่อมฐานข้อมูลมาใช้ (ถอยกลับไป 1 โฟลเดอร์ด้วย ../)

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "กรุณากรอก Username และ Password ให้ครบ" });
    }

    try {
        //แก้ SQL ให้ใช้ LEFT JOIN ไปที่ตาราง Candidates
        // เราเอา user_id มาเป็นตัวเชื่อม (Link) เพื่อไปเอา score มา
        const [users] = await pool.query(
            `SELECT u.*, c.score 
             FROM Users u 
             LEFT JOIN Candidates c ON u.user_id = c.user_id 
             WHERE u.username = ? AND u.password = ?`, 
            [username, password]
        );

        if (users.length > 0) {
            const user = users[0];
            
            if (user.is_enable === 0) {
                return res.status(403).json({ message: "บัญชีนี้ถูกปิดใช้งานชั่วคราว" });
            }

            // เตรียมข้อมูลที่จะส่งกลับ
            // สร้าง Object พื้นฐานที่ทุกคนต้องได้ก่อน
            const responseData = { 
                status: "success", 
                message: "Login OK", 
                role: user.role,
                user_id: user.user_id
            };

            // เช็ค Role (แนวทางที่ 2 ที่คุณชอบ)
            // ถ้าเป็น candidate ค่อยเติม score ลงไปในข้อมูลที่จะส่งกลับ
            if (user.role === 'candidate') {
                responseData.score = user.score || 0; 
            }

            res.json(responseData);

        } else {
            res.status(401).json({ status: "error", message: "Username หรือ Password ผิด" });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ status: "error", message: "Sever Error" });
    }
};

// Register
const registerCandidate = async (req, res) => {
    // รับค่าจากฟอร์มสมัคร
    const { candidate_id, username, password, policies } = req.body;

    if (!candidate_id || !username || !password) {
        return res.status(400).json({ message: "กรอกข้อมูลไม่ครบ" });
    }

    try {
        // เช็คก่อนว่า candidate_id นี้มีจริงไหม และยังไม่เคยถูกสมัครใช่ไหม?
        const [checkCandidate] = await pool.query(
            "SELECT * FROM Candidates WHERE candidate_id = ? AND is_registered = 0",
            [candidate_id]
        );

        if (checkCandidate.length === 0) {
            return res.status(401).json({ message: "add failed" });
        }

        // ถ้า ID ถูกต้อง -> สร้าง User ใหม่ให้เขาก่อน
        const [userResult] = await pool.query(
            "INSERT INTO Users (username, password, role, is_enable) VALUES (?, ?, 'candidate', 1)",
            [username, password] // หมายเหตุ: อนาคตเราจะเอา bcrypt มาครอบรหัสผ่านตรงนี้นะครับ
        );

        const newUserId = userResult.insertId; // ดึง ID ของ User ที่เพิ่งสร้างเสร็จ

        //อัปเดตข้อมูลกลับไปที่ตาราง Candidates ว่า "คนนี้สมัครแล้วนะ" พร้อมใส่ user_id เชื่อมกัน
        await pool.query(
            "UPDATE Candidates SET policies = ?, is_registered = 1, user_id = ? WHERE candidate_id = ?",
            [policies, newUserId, candidate_id]
        );

        res.json({ status: "success", message: "ลงทะเบียนผู้สมัครสำเร็จ! ไปเข้าสู่ระบบได้เลย" });

    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: "Backend Error" });
    }
};

// ส่งออกฟังก์ชันไปให้ไฟล์อื่นใช้
module.exports = {
    login,
    registerCandidate
};