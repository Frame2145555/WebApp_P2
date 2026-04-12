const pool = require('../db');

// 1. API ดึงรายชื่อผู้สมัครไปโชว์หน้าเว็บ
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

        // อัปเกรด: เพิ่ม c.profile_picture และเปลี่ยน u.username เป็น display_id
        const [candidates] = await pool.query(
            `SELECT c.candidate_id, c.score, c.policies, c.profile_picture, u.username AS display_id, c.name
             FROM candidates c
             JOIN users u ON c.user_id = u.user_id
             WHERE c.term_id = ? AND u.is_enable = 1 AND c.is_registered = 1
             ORDER BY c.candidate_id ASC`,
            [term_id]
        );

        // สิ่งที่เพิ่มเข้ามา: สั่งนับจำนวน Voter ทั้งหมดในเทอมนี้
        const [voterCount] = await pool.query("SELECT COUNT(*) AS total FROM voters WHERE term_id = ?", [term_id]);
        const total_voters = voterCount[0].total;

        // ส่ง total_voters กลับไปให้หน้าเว็บด้วย
        res.json({ status: "success", data: candidates, term_id: term_id, total_voters: total_voters });
    } catch (error) {
        console.error("Get Candidates Error:", error);
        res.status(500).json({ status: "error", message: "ดึงข้อมูลผู้สมัครล้มเหลว" });
    }
};

// 2. API ส่งคะแนนโหวต
const submitVote = async (req, res) => {
    const { user_id, candidate_id } = req.body;

    if (!user_id || !candidate_id) {
        return res.status(400).json({ status: "error", message: "ข้อมูลไม่ครบถ้วน" });
    }

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1. หารอบการโหวตที่เปิดอยู่ (Active Term)
        const [active] = await conn.query("SELECT term_id FROM terms WHERE is_active = 1 LIMIT 1");
        if (active.length === 0) {
            await conn.rollback();
            return res.status(404).json({ status: "error", message: "ยังไม่มีรอบที่เปิดโหวต" });
        }
        const activeTermId = active[0].term_id;

        // 2. ตรวจสอบสิทธิ์คนโหวต (Voter)
        const [voters] = await conn.query(
            `SELECT v.voter_id, v.is_voted, u.is_enable
             FROM voters v
             JOIN users u ON v.user_id = u.user_id
             WHERE v.user_id = ? AND v.term_id = ?`,
            [user_id, activeTermId]
        );

        if (voters.length === 0) {
            await conn.rollback();
            return res.status(404).json({ status: "error", message: "คุณไม่มีสิทธิ์โหวตในรอบนี้" });
        }
        if (voters[0].is_enable === 0) {
            await conn.rollback();
            return res.status(403).json({ status: "error", message: "บัญชีของคุณถูกระงับสิทธิ์" });
        }
        if (voters[0].is_voted === 1) {
            await conn.rollback();
            return res.status(403).json({ status: "error", message: "คุณได้ใช้สิทธิ์โหวตไปแล้ว!" });
        }

        // ตรวจสอบสถานะผู้สมัคร (Candidate) - เพิ่มการ JOIN users เพื่อเช็ค is_enable
        const [cand] = await conn.query(
            `SELECT c.candidate_id, u.is_enable, c.is_registered 
             FROM candidates c
             JOIN users u ON c.user_id = u.user_id
             WHERE c.candidate_id = ? AND c.term_id = ?`,
            [candidate_id, activeTermId]
        );

        if (cand.length === 0) {
            await conn.rollback();
            return res.status(404).json({ status: "error", message: "ไม่พบผู้สมัครรายนี้ในระบบ" });
        }

        // ด่านตรวจ: ผู้สมัครโดน Disable
        if (cand[0].is_enable === 0) {
            await conn.rollback();
            return res.status(403).json({ status: "error", message: "ผู้สมัครรายนี้ถูกระงับการใช้งานชั่วคราว ไม่สามารถรับคะแนนโหวตได้" });
        }

        // ด่านตรวจใหม่: ผู้สมัครยังไม่ได้ตั้งรหัสผ่าน (ยังไม่ Register) ห้ามรับโหวต!
        if (cand[0].is_registered === 0) {
            await conn.rollback();
            return res.status(403).json({ status: "error", message: "ผู้สมัครรายนี้ยังไม่ได้ลงทะเบียนเข้าสู่ระบบ ไม่สามารถรับคะแนนโหวตได้" });
        }

        const voter_id = voters[0].voter_id;

        // 4. บันทึกคะแนน
        await conn.query("UPDATE voters SET is_voted = 1 WHERE voter_id = ?", [voter_id]);
        await conn.query("UPDATE candidates SET score = score + 1 WHERE candidate_id = ?", [candidate_id]);
        await conn.query("INSERT INTO votes (voter_id, candidate_id) VALUES (?, ?)", [voter_id, candidate_id]);

        await conn.commit();
        res.json({ status: "success", message: "ลงคะแนนโหวตสำเร็จ!" });

    } catch (error) {
        await conn.rollback();
        console.error("Voting Error:", error);
        res.status(500).json({ status: "error", message: "เกิดข้อผิดพลาดที่ระบบเซิร์ฟเวอร์" });
    } finally {
        conn.release();
    }
};

module.exports = { getCandidates, submitVote };