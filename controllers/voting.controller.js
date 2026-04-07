const pool = require('../db');

// ==========================================
// 1. API ดึงรายชื่อผู้สมัครไปโชว์หน้าเว็บ
// ==========================================
const getCandidates = async (req, res) => {
    try {
        let { term_id } = req.query;
        // ถ้าไม่ส่ง term_id มา ให้หา term ที่กำลัง active อยู่
        if (!term_id) {
            const [active] = await pool.query("SELECT term_id FROM terms WHERE is_active = 1 LIMIT 1");
            term_id = active?.[0]?.term_id;
        }

        if (!term_id) {
            return res.status(404).json({ status: "error", message: "ไม่พบรอบเลือกตั้งที่เปิดในขณะนี้" });
        }

        // 🚨 อัปเกรด: เพิ่ม c.profile_picture และเปลี่ยน u.username เป็น display_id
        const [candidates] = await pool.query(
            `SELECT c.candidate_id, c.score, c.policies, c.profile_picture, u.username AS display_id, c.name
             FROM candidates c
             JOIN users u ON c.user_id = u.user_id
             WHERE c.term_id = ? AND u.is_enable = 1 AND c.is_registered = 1
             ORDER BY c.candidate_id ASC`,
            [term_id]
        );
        res.json({ status: "success", data: candidates, term_id });
    } catch (error) {
        console.error("Get Candidates Error:", error);
        res.status(500).json({ status: "error", message: "ดึงข้อมูลผู้สมัครล้มเหลว" });
    }
};

// ==========================================
// 2. API ส่งคะแนนโหวต (ระบบ Transaction กันเหนียว)
// ==========================================
const submitVote = async (req, res) => {
    const { user_id, candidate_id } = req.body; 

    if (!user_id || !candidate_id) {
        return res.status(400).json({ status: "error", message: "ข้อมูลไม่ครบถ้วน" });
    }

    const conn = await pool.getConnection(); 

    try {
        await conn.beginTransaction();

        // 1. หา voter เทอมที่เปิดอยู่ และเช็คสิทธิ์
        const [active] = await conn.query("SELECT term_id FROM terms WHERE is_active = 1 LIMIT 1");
        if (active.length === 0) {
            await conn.rollback();
            return res.status(404).json({ status: "error", message: "ยังไม่มีรอบที่เปิดโหวต" });
        }
        const activeTermId = active[0].term_id;

        // 2. ตรวจสอบสิทธิ์ผู้โหวต
        const [voters] = await conn.query(
            `SELECT v.voter_id, v.is_voted, u.is_enable
             FROM voters v
             JOIN users u ON v.user_id = u.user_id
             WHERE v.user_id = ? AND v.term_id = ?`,
            [user_id, activeTermId]
        );

        if (voters.length === 0) {
            await conn.rollback();
            return res.status(404).json({ status: "error", message: "คุณไม่มีสิทธิ์โหวตในรอบนี้" }); // ขออนุญาตปรับคำให้ซอฟต์ลงนิดนึงนะครับ 😅
        }

        const voter = voters[0];
        if (voter.is_enable === 0) {
            await conn.rollback();
            return res.status(403).json({ status: "error", message: "บัญชีของคุณถูกระงับสิทธิ์" });
        }

        if (voter.is_voted === 1) {
            await conn.rollback();
            return res.status(403).json({ status: "error", message: "คุณได้ใช้สิทธิ์โหวตไปแล้ว!" });
        }

        // 3. ตรวจว่าผู้สมัครอยู่ในเทอมเดียวกัน
        const [cand] = await conn.query(
            "SELECT candidate_id FROM candidates WHERE candidate_id = ? AND term_id = ?",
            [candidate_id, activeTermId]
        );
        if (cand.length === 0) {
            await conn.rollback();
            return res.status(404).json({ status: "error", message: "ไม่พบผู้สมัครรายนี้ในรอบการโหวตปัจจุบัน" });
        }

        const voter_id = voter.voter_id;

        // 4. บันทึกข้อมูลแบบ 3 เด้ง!
        await conn.query("UPDATE voters SET is_voted = 1 WHERE voter_id = ?", [voter_id]);
        await conn.query("UPDATE candidates SET score = score + 1 WHERE candidate_id = ?", [candidate_id]);
        await conn.query("INSERT INTO votes (voter_id, candidate_id) VALUES (?, ?)", [voter_id, candidate_id]);

        await conn.commit();
        res.json({ status: "success", message: "ลงคะแนนโหวตสำเร็จ! ขอบคุณที่ใช้สิทธิ์" });

    } catch (error) {
        await conn.rollback();
        console.error("Voting Error:", error);
        res.status(500).json({ status: "error", message: "เกิดข้อผิดพลาดที่ระบบเซิร์ฟเวอร์" });
    } finally {
        conn.release();
    }
};

module.exports = { getCandidates, submitVote };