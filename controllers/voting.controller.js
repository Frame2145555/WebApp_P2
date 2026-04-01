const pool = require('../db');

// API ดึงรายชื่อผู้สมัครไปโชว์หน้าเว็บ (กรองตาม term หากส่งมา ไม่งั้นใช้ term ที่ active)
const getCandidates = async (req, res) => {
    try {
        let { term_id } = req.query;
        if (!term_id) {
            const [active] = await pool.query("SELECT term_id FROM terms WHERE is_active = 1 LIMIT 1");
            term_id = active?.[0]?.term_id;
        }

        if (!term_id) {
            return res.status(404).json({ message: "ไม่พบรอบเลือกตั้งที่เปิด" });
        }

        const [candidates] = await pool.query(
            `SELECT c.candidate_id, c.score, c.policies, u.username, c.name
             FROM candidates c
             LEFT JOIN users u ON c.user_id = u.user_id
             WHERE c.term_id = ?
             ORDER BY c.score DESC, c.candidate_id ASC`,
            [term_id]
        );
        res.json({ status: "success", data: candidates, term_id });
    } catch (error) {
        console.error("Get Candidates Error:", error);
        res.status(500).json({ message: "ดึงข้อมูลผู้สมัครล้มเหลว" });
    }
};

//API ส่งคะแนนโหวต
const submitVote = async (req, res) => {
    const { user_id, candidate_id } = req.body; 

    if (!user_id || !candidate_id) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    const conn = await pool.getConnection(); 

    try {
        await conn.beginTransaction();

        // หา voter เทอมที่เปิดอยู่ และเช็คสิทธิ์
        const [active] = await conn.query("SELECT term_id FROM terms WHERE is_active = 1 LIMIT 1");
        if (active.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "ยังไม่มีรอบที่เปิดโหวต" });
        }
        const activeTermId = active[0].term_id;

        const [voters] = await conn.query(
            `SELECT v.voter_id, v.is_voted, u.is_enable
             FROM voters v
             JOIN users u ON v.user_id = u.user_id
             WHERE v.user_id = ? AND v.term_id = ?`,
            [user_id, activeTermId]
        );

        if (voters.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "มึงไม่มีสิทธิ์โหวต (ไม่ใช่ voter รอบนี้)" });
        }

        const voter = voters[0];
        if (voter.is_enable === 0) {
            await conn.rollback();
            return res.status(403).json({ message: "บัญชีถูกระงับสิทธิ์" });
        }

        if (voter.is_voted === 1) {
            await conn.rollback();
            return res.status(403).json({ message: "มึงได้ใช้สิทธิ์โหวตไปแล้ว!" });
        }

        // ตรวจว่าผู้สมัครอยู่ในเทอมเดียวกัน
        const [cand] = await conn.query(
            "SELECT candidate_id FROM candidates WHERE candidate_id = ? AND term_id = ?",
            [candidate_id, activeTermId]
        );
        if (cand.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "ผู้สมัครไม่อยู่ในรอบนี้" });
        }

        const voter_id = voter.voter_id;

        await conn.query("UPDATE voters SET is_voted = 1 WHERE voter_id = ?", [voter_id]);
        await conn.query("UPDATE candidates SET score = score + 1 WHERE candidate_id = ?", [candidate_id]);
        await conn.query("INSERT INTO votes (voter_id, candidate_id) VALUES (?, ?)", [voter_id, candidate_id]);

        await conn.commit();
        res.json({ status: "success", message: "ลงคะแนนโหวตสำเร็จ!" });

    } catch (error) {
        await conn.rollback();
        console.error("Voting Error:", error);
        res.status(500).json({ message: "Backend Error" });
    } finally {
        conn.release();
    }
};

module.exports = { getCandidates, submitVote };