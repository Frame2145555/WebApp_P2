const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const { query, verifyDatabaseConnection, closePool } = require('./db');

dotenv.config({ quiet: true });

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

async function getActiveTermId() {
  const [rows] = await query(
    `
      SELECT term_id
      FROM terms
      WHERE is_active = 1
      ORDER BY term_id DESC
      LIMIT 1
    `
  );

  return rows[0]?.term_id ?? null;
}

async function getSystemStatus() {
  const activeTermId = await getActiveTermId();
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

async function getCandidateProfileForUser(userId, termId) {
  if (!termId) {
    return null;
  }

  const [rows] = await query(
    `
      SELECT
        c.candidate_id,
        c.user_id,
        c.term_id,
        c.is_registered,
        COALESCE(NULLIF(c.name, ''), u.username) AS display_name,
        c.policies AS bio,
        c.personal_info,
        c.profile_picture
      FROM candidates c
      INNER JOIN users u ON u.user_id = c.user_id
      WHERE c.user_id = ? AND c.term_id = ?
      ORDER BY c.is_registered DESC, c.candidate_id DESC
      LIMIT 1
    `,
    [userId, termId]
  );

  return rows[0] ?? null;
}

async function ensureCandidateProfile(userId, termId) {
  let candidateProfile = await getCandidateProfileForUser(userId, termId);

  if (candidateProfile) {
    return candidateProfile;
  }

  await query(
    `
      INSERT INTO candidates (user_id, is_registered, term_id)
      VALUES (?, 1, ?)
    `,
    [userId, termId]
  );

  candidateProfile = await getCandidateProfileForUser(userId, termId);
  return candidateProfile;
}

function parseImageDataUrl(imageDataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(imageDataUrl || '');

  if (!match) {
    throw new Error('Invalid image format');
  }

  const mimeType = match[1].toLowerCase();
  const base64Data = match[2];
  const extensionMap = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp'
  };

  return {
    mimeType,
    extension: extensionMap[mimeType],
    buffer: Buffer.from(base64Data, 'base64')
  };
}

async function saveProfilePicture(candidateId, existingPath, imageDataUrl) {
  const parsedImage = parseImageDataUrl(imageDataUrl);
  const maxSize = 5 * 1024 * 1024;

  if (parsedImage.buffer.length > maxSize) {
    throw new Error('Image must be 5 MB or smaller');
  }

  const uploadsDirectory = path.join(__dirname, 'uploads', 'profile-pictures');
  await fs.mkdir(uploadsDirectory, { recursive: true });

  const fileName = `candidate-${candidateId}-${Date.now()}.${parsedImage.extension}`;
  const relativePath = path.posix.join('uploads', 'profile-pictures', fileName);
  const absolutePath = path.join(__dirname, relativePath);

  await fs.writeFile(absolutePath, parsedImage.buffer);

  if (existingPath?.startsWith('uploads/profile-pictures/')) {
    const oldFilePath = path.join(__dirname, existingPath);
    await fs.unlink(oldFilePath).catch(() => {});
  }

  return relativePath;
}

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
        c.policies AS bio,
        c.profile_picture,
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

async function listActiveResults(termId) {
  if (!termId) {
    return [];
  }

  const [rows] = await query(
    `
      SELECT
        c.candidate_id,
        u.user_id,
        u.username,
        COALESCE(NULLIF(c.name, ''), u.username) AS display_name,
        c.policies AS bio,
        COUNT(v.vote_id) AS vote_count
      FROM candidates c
      INNER JOIN users u ON u.user_id = c.user_id
      LEFT JOIN votes v ON v.candidate_id = c.candidate_id
      WHERE c.term_id = ? AND c.is_registered = 1 AND u.role = 'candidate' AND u.is_enable = 1
      GROUP BY c.candidate_id, u.user_id, u.username, c.name, c.policies
      ORDER BY vote_count DESC, display_name ASC
    `,
    [termId]
  );

  return rows;
}

async function getVoteStatusForVoter(voterId) {
  const [rows] = await query(
    `
      SELECT vote_id, candidate_id
      FROM votes
      WHERE voter_id = ?
      LIMIT 1
    `,
    [voterId]
  );

  return {
    hasVoted: rows.length > 0,
    candidateId: rows[0]?.candidate_id ?? null
  };
}

app.get('/health', asyncHandler(async (req, res) => {
  const systemStatus = await getSystemStatus();
  const [rows] = await query('SELECT 1 AS db_ok');

  res.json({
    status: 'ok',
    message: 'Server is running',
    database: rows[0]?.db_ok === 1 ? 'connected' : 'unknown',
    activeTermId: systemStatus.activeTermId
  });
}));

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

app.get('/api/results', asyncHandler(async (req, res) => {
  const { activeTermId } = await getSystemStatus();
  res.json(await listActiveResults(activeTermId));
}));

app.get('/api/voters/:voterId/vote-status', asyncHandler(async (req, res) => {
  res.json(await getVoteStatusForVoter(req.params.voterId));
}));

app.post('/api/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const [users] = await query(
    `
      SELECT user_id, username, role
      FROM users
      WHERE username = ? AND password = ? AND is_enable = 1
      LIMIT 1
    `,
    [username, password]
  );

  if (!users.length) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const user = users[0];
  const { activeTermId } = await getSystemStatus();
  const candidateProfile = user.role === 'candidate'
    ? await getCandidateProfileForUser(user.user_id, activeTermId)
    : null;

  res.json({
    success: true,
    redirect: `${user.role}_dashboard.html`,
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
  });
}));

app.post('/api/update-bio', asyncHandler(async (req, res) => {
  const { user_id, bio } = req.body;

  if (!user_id || bio === undefined) {
    return res.status(400).json({ success: false, message: 'user_id and bio are required' });
  }

  const { activeTermId } = await getSystemStatus();

  if (!activeTermId) {
    return res.status(409).json({ success: false, message: 'No active election term found' });
  }

  const existingProfile = await getCandidateProfileForUser(user_id, activeTermId);

  if (existingProfile) {
    await query(
      `
        UPDATE candidates
        SET policies = ?
        WHERE candidate_id = ?
      `,
      [bio, existingProfile.candidate_id]
    );
  } else {
    await query(
      `
        INSERT INTO candidates (user_id, policies, is_registered, term_id)
        VALUES (?, ?, 1, ?)
      `,
      [user_id, bio, activeTermId]
    );
  }

  const updatedProfile = await getCandidateProfileForUser(user_id, activeTermId);

  res.json({
    success: true,
    message: 'Manifesto updated successfully',
    user: {
      candidate_id: updatedProfile?.candidate_id ?? null,
      bio: updatedProfile?.bio ?? bio,
      profile_picture: updatedProfile?.profile_picture ?? null,
      display_name: updatedProfile?.display_name ?? null
    }
  });
}));

app.post('/api/update-profile-picture', asyncHandler(async (req, res) => {
  const { user_id, imageDataUrl } = req.body;

  if (!user_id || !imageDataUrl) {
    return res.status(400).json({ success: false, message: 'user_id and imageDataUrl are required' });
  }

  const { activeTermId } = await getSystemStatus();

  if (!activeTermId) {
    return res.status(409).json({ success: false, message: 'No active election term found' });
  }

  let candidateProfile = await ensureCandidateProfile(user_id, activeTermId);

  if (!candidateProfile) {
    return res.status(404).json({ success: false, message: 'Candidate profile could not be created' });
  }

  let profilePicturePath;

  try {
    profilePicturePath = await saveProfilePicture(
      candidateProfile.candidate_id,
      candidateProfile.profile_picture,
      imageDataUrl
    );
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  await query(
    `
      UPDATE candidates
      SET profile_picture = ?
      WHERE candidate_id = ?
    `,
    [profilePicturePath, candidateProfile.candidate_id]
  );

  candidateProfile = await getCandidateProfileForUser(user_id, activeTermId);

  res.json({
    success: true,
    message: 'Profile picture updated successfully',
    user: {
      candidate_id: candidateProfile?.candidate_id ?? null,
      profile_picture: candidateProfile?.profile_picture ?? null,
      display_name: candidateProfile?.display_name ?? null
    }
  });
}));

app.post('/api/vote', asyncHandler(async (req, res) => {
  const { voter_id, candidate_id } = req.body;

  if (!voter_id || !candidate_id) {
    return res.status(400).json({ success: false, message: 'voter_id and candidate_id are required' });
  }

  const systemStatus = await getSystemStatus();

  if (!systemStatus.activeTermId) {
    return res.status(409).json({ success: false, message: 'No active election term found' });
  }

  if (!systemStatus.isVotingEnabled) {
    return res.status(409).json({ success: false, message: 'Voting is currently disabled' });
  }

  const [candidateRows] = await query(
    `
      SELECT candidate_id
      FROM candidates
      WHERE candidate_id = ? AND term_id = ? AND is_registered = 1
      LIMIT 1
    `,
    [candidate_id, systemStatus.activeTermId]
  );

  if (!candidateRows.length) {
    return res.status(404).json({ success: false, message: 'Candidate not found for the active term' });
  }

  const voteStatus = await getVoteStatusForVoter(voter_id);

  if (voteStatus.hasVoted) {
    return res.status(400).json({ success: false, message: 'You have already voted' });
  }

  await query(
    `
      INSERT INTO votes (voter_id, candidate_id)
      VALUES (?, ?)
    `,
    [voter_id, candidate_id]
  );

  res.json({ success: true, message: 'Vote recorded successfully' });
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
