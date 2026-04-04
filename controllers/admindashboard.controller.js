const pool = require('../db');

// ดึงสรุปข้อมูลหน้า Dashboard: ยอด voter, voted, candidate และคะแนนผู้สมัคร
const getDashboardSummary = async (_req, res) => {
	const connection = await pool.getConnection();

	try {
		// หาเทอมที่เปิดใช้งานอยู่
		const [activeTerms] = await connection.query(
			'SELECT term_id, name, description, is_active FROM terms WHERE is_active = 1 LIMIT 1'
		);

		if (activeTerms.length === 0) {
			return res.status(400).json({ message: 'ยังไม่มีเทอมที่เปิดใช้งาน' });
		}

		const term = activeTerms[0];

		// ดึงสรุปยอด
		const [[voterTotalRow]] = await connection.query(
			'SELECT COUNT(*) AS total_voters FROM voters WHERE term_id = ?',
			[term.term_id]
		);

		const [[votedRow]] = await connection.query(
			'SELECT COUNT(*) AS voted FROM voters WHERE term_id = ? AND is_voted = 1',
			[term.term_id]
		);

		const [[candidateRow]] = await connection.query(
			'SELECT COUNT(*) AS total_candidates FROM candidates WHERE term_id = ?',
			[term.term_id]
		);

		const totalVoters = Number(voterTotalRow.total_voters) || 0;
		const voted = Number(votedRow.voted) || 0;
		const candidates = Number(candidateRow.total_candidates) || 0;
		const percentage = totalVoters > 0 ? Number(((voted / totalVoters) * 100).toFixed(1)) : 0;

		// ดึงคะแนนผู้สมัครสำหรับกราฟ
		const [candidateScores] = await connection.query(
			'SELECT candidate_id, name, COALESCE(score, 0) AS score FROM candidates WHERE term_id = ? ORDER BY score DESC, candidate_id ASC',
			[term.term_id]
		);

		// ดึงสถานะระบบโหวตจาก setting_system (ถ้ามี)
		const [[votingSetting]] = await connection.query(
			"SELECT setting_value FROM setting_system WHERE setting_name = 'is_voting_enabled' LIMIT 1"
		);

		res.json({
			status: 'success',
			data: {
				term,
				summary: {
					totalVoters,
					voted,
					percentage,
					candidates
				},
				chart: {
					labels: candidateScores.map((c) => c.name || c.candidate_id),
					scores: candidateScores.map((c) => Number(c.score) || 0)
				},
				settings: {
					isVotingEnabled: votingSetting ? votingSetting.setting_value === 1 || votingSetting.setting_value === '1' : false
				}
			}
		});
	} catch (error) {
		console.error('Dashboard Summary Error:', error);
		res.status(500).json({ message: 'ดึงข้อมูล Dashboard ไม่สำเร็จ' });
	} finally {
		connection.release();
	}
};

module.exports = { getDashboardSummary };
