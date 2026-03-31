const pool = require('../db');

// API ดึงรายชื่อผู้สมัครไปโชว์หน้าเว็บ
const getCandidates = async (req, res) => {
    try {
        // ดึงข้อมูล Candidate และ Join เอา Username มาโชว์
        const [candidates] = await pool.query(`
            SELECT c.candidate_id, c.score, c.policies, u.username 
            FROM Candidates c
            JOIN Users u ON c.user_id = u.user_id
        `);
        res.json({ status: "success", data: candidates });
    } catch (error) {
        console.error("Get Candidates Error:", error);
        res.status(500).json({ message: "ดึงข้อมูลผู้สมัครล้มเหลว" });
    }
};

//API ส่งคะแนนโหวต
const submitVote = async (req, res) => {
    // รับค่าจาก Frontend (สมมติว่าตอนนี้ Frontend ส่ง user_id ของคนที่ล็อกอินมาให้ก่อน)
    const { user_id, candidate_id } = req.body; 

    if (!user_id || !candidate_id) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    //ดึง Connection พิเศษออกมาเพื่อทำ Transaction
    const conn = await pool.getConnection(); 

    try {
        await conn.beginTransaction(); //เริ่มเปิดโหมดป้องกัน (Transaction)

        // หา voter_id ของคนนี้ และเช็คว่าโหวตไปหรือยัง?
        const [voters] = await conn.query("SELECT voter_id, is_voted FROM Voters WHERE user_id = ?", [user_id]);
        
        if (voters.length === 0) {
            await conn.rollback(); // ยกเลิก!
            return res.status(404).json({ message: "มึงไม่มีสิทธิ์โหวต (มึงไม่ใช่ Voter)" });
        }

        if (voters[0].is_voted === 1) {
            await conn.rollback(); // ยกเลิก!
            return res.status(403).json({ message: "มึงได้ใช้สิทธิ์โหวตไปแล้ว!" });
        }

        const voter_id = voters[0].voter_id;

        // อัปเดตสถานะว่า "โหวตแล้ว" ในตาราง Voters
        await conn.query("UPDATE Voters SET is_voted = 1 WHERE voter_id = ?", [voter_id]);

        // บวกคะแนน (+1) ให้ Candidate ที่เลือก
        await conn.query("UPDATE Candidates SET score = score + 1 WHERE candidate_id = ?", [candidate_id]);

        // บันทึกประวัติลงตาราง Votes
        await conn.query("INSERT INTO Votes (voter_id, candidate_id) VALUES (?, ?)", [voter_id, candidate_id]);

        await conn.commit(); // ทำครบ 4 ขั้นตอนอย่างปลอดภัย กดยืนยันการเซฟได้!
        res.json({ status: "success", message: "ลงคะแนนโหวตสำเร็จ!" });

    } catch (error) {
        await conn.rollback(); //ถ้ามี Error ระหว่างทาง ให้ย้อนข้อมูลกลับทั้งหมด (คะแนนจะไม่ถูกบวกมั่ว)
        console.error("Voting Error:", error);
        res.status(500).json({ message: "ระบบโหวตกาก เดี่ยวไปแก้" });
    } finally {
        conn.release(); // คืน Connection กลับสู่ Pool เสมอ
    }
};

module.exports = { getCandidates, submitVote };