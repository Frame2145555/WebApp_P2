const argon2 = require('argon2');
const pool = require('../db'); // ดึงไฟล์เชื่อมฐานข้อมูลมาใช้ (ถอยกลับไป 1 โฟลเดอร์ด้วย ../)
const {
    getActiveTermId,
    getCandidateProfileByUserId
} = require('./candidate.controller');

async function verifyPassword(storedPassword, candidatePassword) {
    if (!storedPassword) {
        return false;
    }

    if (storedPassword.startsWith('$argon2')) {
        try {
            return await argon2.verify(storedPassword, candidatePassword);
        } catch (error) {
            return false;
        }
    }

    return storedPassword === candidatePassword;
}

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "กรุณากรอก Username และ Password ให้ครบ" });
    }

    try {
        const [users] = await pool.query(
            `SELECT u.*
             FROM users u
             WHERE u.username = ?
             LIMIT 1`,
            [username]
        );

        if (!users.length) {
            res.status(401).json({ status: "error", message: "Username หรือ Password ผิด" });
            return;
        }

        const user = users[0];

        if (user.is_enable === 0) {
            return res.status(403).json({ message: "บัญชีนี้ถูกปิดใช้งานชั่วคราว" });
        }

        const isValidPassword = await verifyPassword(user.password, password);

        if (!isValidPassword) {
            return res.status(401).json({ status: "error", message: "Username หรือ Password ผิด" });
        }

        const activeTermId = await getActiveTermId();
        const candidateProfile = user.role === 'candidate'
            ? await getCandidateProfileByUserId(user.user_id, activeTermId)
            : null;

        const responseData = {
            status: "success",
            message: "Login OK",
            role: user.role,
            user_id: user.user_id,
            score: candidateProfile?.vote_count || 0,
            redirect: user.role === 'candidate' ? 'candidate_dashboard.html' : null,
            user: {
                user_id: user.user_id,
                username: user.username,
                role: user.role,
                candidate_id: candidateProfile?.candidate_id ?? null,
                bio: candidateProfile?.bio ?? null,
                profile_picture: candidateProfile?.profile_picture ?? null,
                display_name: candidateProfile?.display_name ?? user.username,
                active_term_id: activeTermId
            }
        };

        res.json(responseData);
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ status: "error", message: "Sever Error" });
    }
};

const registerCandidate = async (req, res) => {
    // รับค่าจากหน้าเว็บตอนผู้สมัครกดลงทะเบียน
    const { candidate_id, username, password, policies } = req.body;

    if (!candidate_id || !username || !password || !policies) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. เช็คก่อนว่า Candidate ID นี้มีอยู่จริงไหม? และโดนคนอื่นแย่งลงทะเบียนไปหรือยัง?
        const [candidateCheck] = await connection.query(
            "SELECT is_registered FROM candidates WHERE candidate_id = ?",
            [candidate_id]
        );

        if (candidateCheck.length === 0) {
            return res.status(404).json({ message: "ไม่พบ Candidate ID นี้ในระบบ (ติดต่อ Admin)" });
        }
        if (candidateCheck[0].is_registered === 1) {
            return res.status(400).json({ message: "รหัสผู้สมัครนี้ ถูกลงทะเบียนไปเรียบร้อยแล้ว!" });
        }

        // 2. เข้ารหัสผ่านด้วย Argon2 สุดโหด
        const hashedPassword = await argon2.hash(password);

        // 3. นำ Username และ Password ไปบันทึกลงตาราง Users
        const [userResult] = await connection.query(
            "INSERT INTO users (username, password, role, is_enable) VALUES (?, ?, 'candidate', 1)",
            [username, hashedPassword]
        );
        const newUserId = userResult.insertId;

        // 4. นำ user_id ที่เพิ่งได้ มาอัปเดตใส่ตาราง Candidates พร้อมกับนโยบาย และเปลี่ยนสถานะเป็น 1
        await connection.query(
            "UPDATE candidates SET user_id = ?, policies = ?, is_registered = 1 WHERE candidate_id = ?",
            [newUserId, policies, candidate_id]
        );

        await connection.commit();

        res.status(200).json({ 
            status: "success", 
            message: "ลงทะเบียนผู้สมัครสำเร็จ! คุณสามารถเข้าสู่ระบบได้เลย" 
        });

    } catch (error) {
        await connection.rollback();
        console.error("Candidate Register Error:", error);

        // ดักกรณีผู้สมัครตั้ง Username ซ้ำกับคนอื่น
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: "Username นี้มีคนใช้แล้ว กรุณาตั้งใหม่" });
        }
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
        
    } finally {
        connection.release();
    }
};

// ส่งออกฟังก์ชันไปให้ไฟล์อื่นใช้
module.exports = {
    login,
    registerCandidate
};
