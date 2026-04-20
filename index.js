const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const path = require('path');
const argon2 = require('argon2');

const { pool, query, verifyDatabaseConnection, closePool } = require('./db');
const { getActiveTermId, getCandidateLoginData, registerCandidateDashboardRoutes } = require('./candidate-api');
const registerAdminRoutes = require('./admin-api');
const { initializeDatabase } = require('./schema-policies');

dotenv.config({ quiet: true });

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const LOGIN_REDIRECTS = {
  admin: 'admin_dashboard.html',
  candidate: 'candidate_dashboard.html',
  voter: 'voter_dashboard.html'
};

function getLoginRedirect(role) {
  return LOGIN_REDIRECTS[role] || 'login.html';
}

function executeDb(db, sql, params = []) {
  if (typeof db === 'function') {
    return db(sql, params);
  }

  return db.execute(sql, params);
}

async function verifyPassword(storedPassword, submittedPassword) {
  if (!storedPassword || !submittedPassword) {
    return false;
  }

  if (storedPassword.startsWith('$argon2')) {
    try {
      return await argon2.verify(storedPassword, submittedPassword);
    } catch (error) {
      return false;
    }
  }

  return storedPassword === submittedPassword;
}

async function getSystemStatus() {
  const activeTermId = await getActiveTermId(query);
  const [settingRows] = await query(
    `
      SELECT setting_name, setting_value
      FROM setting_system
      WHERE setting_name IN ('is_voting_enabled', 'is_register_enabled')
    `
  );

  const settings = Object.fromEntries(
    settingRows.map((row) => [row.setting_name, Boolean(Number(row.setting_value))])
  );

  return {
    activeTermId,
    isVotingEnabled: settings.is_voting_enabled ?? false,
    isRegistrationEnabled: settings.is_register_enabled ?? false
  };
}

// EN: Load candidate profile data used by the voter dashboard cards.
// TH: โหลดข้อมูลโปรไฟล์ผู้สมัครที่ใช้ใน การ์ดของแดชบอร์ดผู้โหวต
async function listActiveCandidates(termId) {
  if (!termId) {
    return [];
  }

  const [rows] = await query(
    `
      SELECT
        c.candidate_id,
        c.user_id,
        u.username,
        COALESCE(NULLIF(c.name, ''), u.username) AS display_name,
        c.personal_info,
        c.policies,
        c.policies AS bio,
        c.profile_picture,
        COALESCE(c.score, 0) AS score,
        COALESCE(c.score, 0) AS vote_count,
        c.term_id
      FROM candidates c
      INNER JOIN users u ON u.user_id = c.user_id
      WHERE c.term_id = ? AND c.is_registered = 1 AND u.role = 'candidate' AND u.is_enable = 1
      ORDER BY display_name ASC
    `,
    [termId]
  );

  return rows;
}

async function getVotingCandidates(termId) {
  if (!termId) {
    return [];
  }

  const [rows] = await query(
    `
      SELECT
        c.candidate_id,
        COALESCE(c.score, 0) AS score,
        c.policies,
        u.username,
        COALESCE(NULLIF(c.name, ''), u.username) AS name,
        c.profile_picture
      FROM candidates c
      LEFT JOIN users u ON u.user_id = c.user_id
      WHERE c.term_id = ? AND c.is_registered = 1
      ORDER BY score DESC, c.candidate_id ASC
    `,
    [termId]
  );

  return rows;
}

async function getVoterRecord(db, identifier, termId, options = {}) {
  if (!identifier || !termId) {
    return null;
  }

  const suffix = options.lock ? '\n      FOR UPDATE' : '';
  const selectByColumn = (column) => `
      SELECT
        v.voter_id,
        v.user_id,
        v.is_voted,
        u.username,
        u.role,
        u.is_enable
      FROM voters v
      INNER JOIN users u ON u.user_id = v.user_id
      WHERE ${column} = ? AND v.term_id = ?
      LIMIT 1${suffix}
    `;

  let [rows] = await executeDb(db, selectByColumn('v.user_id'), [identifier, termId]);

  if (rows.length) {
    return rows[0];
  }

  [rows] = await executeDb(db, selectByColumn('v.voter_id'), [identifier, termId]);
  return rows[0] ?? null;
}

async function getRecordedVote(db, voterId, termId, options = {}) {
  if (!voterId || !termId) {
    return null;
  }

  const suffix = options.lock ? '\n      FOR UPDATE' : '';
  const [rows] = await executeDb(
    db,
    `
      SELECT v.vote_id, v.candidate_id
      FROM votes v
      INNER JOIN candidates c ON c.candidate_id = v.candidate_id
      WHERE v.voter_id = ? AND c.term_id = ?
      ORDER BY v.vote_id DESC
      LIMIT 1${suffix}
    `,
    [voterId, termId]
  );

  return rows[0] ?? null;
}

async function getVoteStatusForVoter(voterIdentifier, termId) {
  if (!termId) {
    return { hasVoted: false, candidateId: null, voterId: null };
  }

  const voterRecord = await getVoterRecord(query, voterIdentifier, termId);

  if (!voterRecord) {
    return { hasVoted: false, candidateId: null, voterId: null };
  }

  const vote = await getRecordedVote(query, voterRecord.voter_id, termId);

  return {
    hasVoted: Number(voterRecord.is_voted) === 1 || Boolean(vote),
    candidateId: vote?.candidate_id ?? null,
    voterId: voterRecord.voter_id
  };
}

async function getCandidateRecord(db, candidateId, termId, options = {}) {
  const suffix = options.lock ? '\n      FOR UPDATE' : '';
  const [rows] = await executeDb(
    db,
    `
      SELECT candidate_id
      FROM candidates
      WHERE candidate_id = ? AND term_id = ? AND is_registered = 1
      LIMIT 1${suffix}
    `,
    [candidateId, termId]
  );

  return rows[0] ?? null;
}

const getHealthHandler = asyncHandler(async (req, res) => {
  const systemStatus = await getSystemStatus();
  const [rows] = await query('SELECT 1 AS db_ok');

  res.json({
    status: 'ok',
    message: 'Server is running',
    database: rows[0]?.db_ok === 1 ? 'connected' : 'unknown',
    activeTermId: systemStatus.activeTermId
  });
});

app.get('/health', getHealthHandler);
app.get('/api/status', getHealthHandler);

app.get('/api/system-status', asyncHandler(async (req, res) => {
  res.json(await getSystemStatus());
}));

app.get('/api/users', asyncHandler(async (req, res) => {
  const [rows] = await query(
    `
      SELECT user_id, username, role, is_enable
      FROM users
      ORDER BY user_id ASC
    `
  );

  res.json(rows);
}));

app.get('/api/candidates', asyncHandler(async (req, res) => {
  const { activeTermId } = await getSystemStatus();
  res.json(await listActiveCandidates(activeTermId));
}));

app.get('/api/voting/candidates', asyncHandler(async (req, res) => {
  const requestedTermId = req.query.term_id ? Number(req.query.term_id) : null;
  const activeTermId = requestedTermId || await getActiveTermId(query);

  if (!activeTermId) {
    return res.status(404).json({ status: 'error', message: 'No active election term found' });
  }

  res.json({
    status: 'success',
    data: await getVotingCandidates(activeTermId),
    term_id: activeTermId
  });
}));

registerCandidateDashboardRoutes(app, {
  query,
  asyncHandler,
  uploadRoot: path.join(__dirname, 'uploads', 'profile-pictures')
});

registerAdminRoutes(app, {
  query,
  asyncHandler,
  pool
});

app.get('/api/voters/:voterId/vote-status', asyncHandler(async (req, res) => {
  const activeTermId = await getActiveTermId(query);
  res.json(await getVoteStatusForVoter(req.params.voterId, activeTermId));
}));

const loginHandler = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const [users] = await query(
    `
      SELECT user_id, username, password, role, is_enable
      FROM users
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  );

  if (!users.length) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const user = users[0];

  if (Number(user.is_enable) === 0) {
    return res.status(403).json({ success: false, message: 'This account is disabled' });
  }

  if (user.password === 'NOT_REGISTERED') {
    return res.status(403).json({ success: false, message: 'This account is not registered yet' });
  }

  const isValidPassword = await verifyPassword(user.password, password);

  if (!isValidPassword) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const activeTermId = await getActiveTermId(query);
  const candidateData = user.role === 'candidate'
    ? await getCandidateLoginData(query, user.user_id, user.username, activeTermId)
    : null;
  const redirect = getLoginRedirect(user.role);
  const responseUser = {
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    candidate_id: candidateData?.candidate_id ?? null,
    candidate_name: candidateData?.candidate_name ?? null,
    bio: candidateData?.bio ?? null,
    policies: candidateData?.policies ?? candidateData?.bio ?? null,
    personal_info: candidateData?.personal_info ?? null,
    profile_picture: candidateData?.profile_picture ?? null,
    display_name: candidateData?.display_name ?? user.username,
    active_term_id: candidateData?.active_term_id ?? activeTermId
  };

  res.json({
    success: true,
    status: 'success',
    message: 'Login OK',
    role: user.role,
    user_id: user.user_id,
    score: Number(candidateData?.vote_count || 0),
    redirect,
    user: responseUser
  });
});

app.post('/api/login', loginHandler);
app.post('/api/auth/login', loginHandler);

const voteHandler = asyncHandler(async (req, res) => {
  const voterIdentifier = req.body.user_id ?? req.body.voter_id;
  const candidateId = Number(req.body.candidate_id);

  if (!voterIdentifier || !candidateId) {
    return res.status(400).json({ success: false, message: 'user_id and candidate_id are required' });
  }

  const systemStatus = await getSystemStatus();

  if (!systemStatus.activeTermId) {
    return res.status(409).json({ success: false, message: 'No active election term found' });
  }

  if (!systemStatus.isVotingEnabled) {
    return res.status(409).json({ success: false, message: 'Voting is currently disabled' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const voterRecord = await getVoterRecord(connection, voterIdentifier, systemStatus.activeTermId, { lock: true });

    if (!voterRecord || voterRecord.role !== 'voter') {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'No active voter record found for this account' });
    }

    if (Number(voterRecord.is_enable) === 0) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'This voter account is disabled' });
    }

    const existingVote = await getRecordedVote(connection, voterRecord.voter_id, systemStatus.activeTermId, { lock: true });

    if (Number(voterRecord.is_voted) === 1 || existingVote) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'You have already voted' });
    }

    const candidateRecord = await getCandidateRecord(connection, candidateId, systemStatus.activeTermId, { lock: true });

    if (!candidateRecord) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Candidate not found for the active term' });
    }

    await connection.execute(
      `
        UPDATE voters
        SET is_voted = 1
        WHERE voter_id = ?
      `,
      [voterRecord.voter_id]
    );

    await connection.execute(
      `
        UPDATE candidates
        SET score = COALESCE(score, 0) + 1
        WHERE candidate_id = ?
      `,
      [candidateId]
    );

    await connection.execute(
      `
        INSERT INTO votes (voter_id, candidate_id)
        VALUES (?, ?)
      `,
      [voterRecord.voter_id, candidateId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  res.json({ success: true, status: 'success', message: 'Vote recorded successfully' });
});

app.post('/api/vote', voteHandler);
app.post('/api/voting/vote', voteHandler);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/AdminNew/views/Term.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin_dashboard.html'));
});
app.get('/Voter-Dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'voter_dashboard.html'));
});
app.get('/File_of_Luu/candidate_dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'candidate_dashboard.html'));
});
app.use(express.static(path.join(__dirname)));

app.use((error, req, res, next) => {
  console.error('API error:', error);
  res.status(500).json({
    success: false,
    message: 'Database error'
  });
});

async function startServer() {
  await verifyDatabaseConnection();
  
  // Initialize the candidate_policies table
  try {
    await initializeDatabase(pool);
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('⚠️ Warning: Could not initialize database schema:', error.message);
  }

  return app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error('Unable to start server:', error.message);
    await closePool();
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer
};
