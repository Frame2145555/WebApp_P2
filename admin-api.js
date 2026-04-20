/**
 * Admin Candidate Management API Routes
 * Handles candidate creation, modification, and policy management
 */

module.exports = function registerAdminRoutes(app, { query, asyncHandler, pool }) {
  // EN: Get all candidates with policy count for admin dashboard
  // TH: ดึงรายชื่อผู้สมัครทั้งหมดพร้อมจำนวนนโยบาย
  app.get('/api/admin/candidates', asyncHandler(async (req, res) => {
    const termId = req.query.term_id || 1;

    const [rows] = await query(
      `
        SELECT 
          c.candidate_id,
          c.name,
          u.username,
          c.is_registered,
          COALESCE(c.score, 0) AS score,
          (SELECT COUNT(*) FROM candidate_policies WHERE candidate_id = c.candidate_id) AS policy_count,
          COALESCE(u.is_enable, 0) AS status_enable
        FROM candidates c
        LEFT JOIN users u ON c.user_id = u.user_id
        WHERE c.term_id = ?
        ORDER BY c.candidate_id ASC
      `,
      [termId]
    );

    res.json({
      status: 'success',
      data: rows,
      count: rows.length
    });
  }));

  // EN: Get a specific candidate with detailed information
  // TH: ดึงข้อมูลผู้สมัครเฉพาะเจาะจง
  app.get('/api/admin/candidates/:candidateId', asyncHandler(async (req, res) => {
    const { candidateId } = req.params;

    const [rows] = await query(
      `
        SELECT 
          c.candidate_id,
          c.name,
          c.personal_info,
          u.username,
          u.user_id,
          c.is_registered,
          c.score,
          c.profile_picture,
          c.term_id
        FROM candidates c
        LEFT JOIN users u ON c.user_id = u.user_id
        WHERE c.candidate_id = ?
      `,
      [candidateId]
    );

    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Candidate not found' });
    }

    res.json({
      status: 'success',
      data: rows[0]
    });
  }));

  // EN: Create a new candidate
  // TH: สร้างผู้สมัครใหม่
  app.post('/api/admin/candidates', asyncHandler(async (req, res) => {
    const { name, personal_info, term_id } = req.body;

    if (!name || !term_id) {
      return res.status(400).json({ status: 'error', message: 'Name and term_id are required' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Generate candidate ID (CAND-001, CAND-002, etc.)
      const [[{ lastId }]] = await connection.query(
        "SELECT MAX(CAST(SUBSTRING(username, 6) AS UNSIGNED)) as lastId FROM users WHERE username LIKE 'CAND-%'"
      );

      const nextNumber = (lastId || 0) + 1;
      const generatedCandidateId = `CAND-${String(nextNumber).padStart(3, '0')}`;

      // Create user account
      const [userResult] = await connection.query(
        "INSERT INTO users (username, password, role, is_enable) VALUES (?, ?, ?, 1)",
        [generatedCandidateId, 'NOT_REGISTERED', 'candidate']
      );
      const userId = userResult.insertId;

      // Create candidate record
      await connection.query(
        "INSERT INTO candidates (user_id, name, personal_info, is_registered, term_id) VALUES (?, ?, ?, 0, ?)",
        [userId, name, personal_info || '', 0, term_id]
      );

      await connection.commit();

      res.status(201).json({
        status: 'success',
        message: `Candidate ${name} created successfully!`,
        candidate_id: generatedCandidateId,
        username: generatedCandidateId,
        user_id: userId
      });
    } catch (error) {
      await connection.rollback();
      console.error('Create Candidate Error:', error);
      res.status(500).json({ status: 'error', message: 'Error creating candidate' });
    } finally {
      connection.release();
    }
  }));

  // EN: Update candidate information
  // TH: อัปเดตข้อมูลผู้สมัคร
  app.put('/api/admin/candidates/:candidateId', asyncHandler(async (req, res) => {
    const { candidateId } = req.params;
    const { name, personal_info } = req.body;

    const [result] = await query(
      "UPDATE candidates SET name = ?, personal_info = ? WHERE candidate_id = ?",
      [name, personal_info, candidateId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Candidate not found' });
    }

    res.json({
      status: 'success',
      message: 'Candidate updated successfully'
    });
  }));

  // EN: Get all policies for a candidate
  // TH: ดึงนโยบายทั้งหมดของผู้สมัครคนหนึ่ง
  app.get('/api/admin/candidates/:candidateId/policies', asyncHandler(async (req, res) => {
    const { candidateId } = req.params;

    const [rows] = await query(
      `
        SELECT 
          policy_id,
          candidate_id,
          policy_title,
          policy_description,
          created_at,
          updated_at
        FROM candidate_policies
        WHERE candidate_id = ?
        ORDER BY created_at DESC
      `,
      [candidateId]
    );

    res.json({
      status: 'success',
      data: rows,
      count: rows.length
    });
  }));

  // EN: Add a new policy for a candidate
  // TH: เพิ่มนโยบายใหม่สำหรับผู้สมัคร
  app.post('/api/admin/candidates/:candidateId/policies', asyncHandler(async (req, res) => {
    const { candidateId } = req.params;
    const { policy_title, policy_description } = req.body;

    if (!policy_title || !policy_description) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Policy title and description are required' 
      });
    }

    // Verify candidate exists
    const [candidates] = await query('SELECT candidate_id FROM candidates WHERE candidate_id = ?', [candidateId]);
    if (!candidates.length) {
      return res.status(404).json({ status: 'error', message: 'Candidate not found' });
    }

    const [result] = await query(
      `
        INSERT INTO candidate_policies (candidate_id, policy_title, policy_description, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
      `,
      [candidateId, policy_title, policy_description]
    );

    res.status(201).json({
      status: 'success',
      message: 'Policy added successfully',
      policy_id: result.insertId,
      policy_title,
      policy_description
    });
  }));

  // EN: Update an existing policy
  // TH: อัปเดตนโยบายที่มีอยู่
  app.put('/api/admin/candidates/:candidateId/policies/:policyId', asyncHandler(async (req, res) => {
    const { candidateId, policyId } = req.params;
    const { policy_title, policy_description } = req.body;

    const [result] = await query(
      `
        UPDATE candidate_policies 
        SET policy_title = ?, policy_description = ?, updated_at = NOW()
        WHERE policy_id = ? AND candidate_id = ?
      `,
      [policy_title, policy_description, policyId, candidateId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Policy not found' });
    }

    res.json({
      status: 'success',
      message: 'Policy updated successfully'
    });
  }));

  // EN: Delete a policy
  // TH: ลบนโยบาย
  app.delete('/api/admin/candidates/:candidateId/policies/:policyId', asyncHandler(async (req, res) => {
    const { candidateId, policyId } = req.params;

    const [result] = await query(
      'DELETE FROM candidate_policies WHERE policy_id = ? AND candidate_id = ?',
      [policyId, candidateId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Policy not found' });
    }

    res.json({
      status: 'success',
      message: 'Policy deleted successfully'
    });
  }));

  // EN: Get summary statistics for admin dashboard
  // TH: ดึงข้อมูลสรุปสถิติสำหรับแดชบอร์ดแอดมิน
  app.get('/api/admin/dashboard-stats', asyncHandler(async (req, res) => {
    const termId = req.query.term_id || 1;

    const [[{ totalCandidates }]] = await query(
      'SELECT COUNT(*) as totalCandidates FROM candidates WHERE term_id = ?',
      [termId]
    );

    const [[{ withPolicies }]] = await query(
      `
        SELECT COUNT(DISTINCT c.candidate_id) as withPolicies
        FROM candidates c
        INNER JOIN candidate_policies cp ON c.candidate_id = cp.candidate_id
        WHERE c.term_id = ?
      `,
      [termId]
    );

    const [[{ registeredCount }]] = await query(
      'SELECT COUNT(*) as registeredCount FROM candidates WHERE term_id = ? AND is_registered = 1',
      [termId]
    );

    res.json({
      status: 'success',
      stats: {
        total_candidates: totalCandidates,
        with_policies: withPolicies,
        registered_count: registeredCount,
        term_id: termId
      }
    });
  }));
};
