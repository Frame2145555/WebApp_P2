const fs = require('fs/promises');
const path = require('path');

// EN: Find the active election term used by candidate and voter features.
// TH: ค้นหาเทอมการเลือกตั้งที่กำลังใช้งานสำหรับฟีเจอร์ผู้สมัครและผู้โหวต
async function getActiveTermId(query) {
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

// EN: Normalize a candidate DB row into the user payload returned to the frontend.
// TH: จัดรูปข้อมูลผู้สมัครจากฐานข้อมูลให้เป็น payload ผู้ใช้สำหรับส่งไปหน้าเว็บ
function buildCandidateUserPayload(candidateProfile) {
  const policies = candidateProfile?.policies ?? candidateProfile?.bio ?? null;

  return {
    user_id: candidateProfile?.user_id ?? null,
    candidate_id: candidateProfile?.candidate_id ?? null,
    candidate_name: candidateProfile?.candidate_name ?? null,
    display_name: candidateProfile?.display_name ?? null,
    personal_info: candidateProfile?.personal_info ?? null,
    policies,
    bio: policies,
    profile_picture: candidateProfile?.profile_picture ?? null,
    active_term_id: candidateProfile?.term_id ?? null,
    vote_count: Number(candidateProfile?.vote_count || 0)
  };
}

// EN: Load one candidate profile for a given user inside the active term.
// TH: โหลดโปรไฟล์ผู้สมัครของผู้ใช้หนึ่งคนภายในเทอมที่กำลังใช้งาน
async function getCandidateProfileForUser(query, userId, termId) {
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
        c.name AS candidate_name,
        COALESCE(NULLIF(c.name, ''), u.username) AS display_name,
        c.policies,
        c.policies AS bio,
        c.personal_info,
        c.profile_picture,
        COALESCE(c.score, 0) AS vote_count
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

// EN: Make sure a candidate profile row exists before updating profile fields.
// TH: ตรวจสอบให้มีแถวข้อมูลผู้สมัครอยู่ก่อนที่จะอัปเดตข้อมูลโปรไฟล์
async function ensureCandidateProfile(query, userId, termId) {
  let candidateProfile = await getCandidateProfileForUser(query, userId, termId);

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

  candidateProfile = await getCandidateProfileForUser(query, userId, termId);
  return candidateProfile;
}

// EN: Trim optional text fields while still allowing undefined values to pass through.
// TH: ตัดช่องว่างของข้อความที่เป็น optional โดยยังคงรับค่า undefined ได้
function normalizeOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }

  return String(value).trim();
}

// EN: Update editable candidate profile fields in one shared backend helper.
// TH: อัปเดตฟิลด์โปรไฟล์ผู้สมัครที่แก้ไขได้ผ่าน helper กลางของ backend
async function updateCandidateProfileFields(query, userId, termId, fields = {}) {
  const candidateProfile = await ensureCandidateProfile(query, userId, termId);

  if (!candidateProfile) {
    return null;
  }

  const nextDisplayName = normalizeOptionalText(fields.display_name);
  const nextPersonalInfo = normalizeOptionalText(fields.personal_info);
  const nextPolicies = normalizeOptionalText(fields.policies);

  await query(
    `
      UPDATE candidates
      SET
        name = ?,
        personal_info = ?,
        policies = ?
      WHERE candidate_id = ?
    `,
    [
      nextDisplayName === undefined ? candidateProfile.candidate_name || null : nextDisplayName || null,
      nextPersonalInfo === undefined ? candidateProfile.personal_info || null : nextPersonalInfo || null,
      nextPolicies === undefined ? candidateProfile.policies || null : nextPolicies || null,
      candidateProfile.candidate_id
    ]
  );

  return getCandidateProfileForUser(query, userId, termId);
}

// EN: Validate and split a base64 image data URL before saving it.
// TH: ตรวจสอบและแยกข้อมูลรูปแบบ data URL แบบ base64 ก่อนบันทึกไฟล์
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

// EN: Save a candidate profile picture file and remove the previous upload when possible.
// TH: บันทึกรูปโปรไฟล์ผู้สมัครและลบไฟล์เดิมเมื่อสามารถทำได้
async function saveProfilePicture(candidateId, existingPath, imageDataUrl, uploadRoot) {
  const parsedImage = parseImageDataUrl(imageDataUrl);
  const maxSize = 5 * 1024 * 1024;

  if (parsedImage.buffer.length > maxSize) {
    throw new Error('Image must be 5 MB or smaller');
  }

  await fs.mkdir(uploadRoot, { recursive: true });

  const fileName = `candidate-${candidateId}-${Date.now()}.${parsedImage.extension}`;
  const relativePath = path.posix.join('uploads', 'profile-pictures', fileName);
  const absolutePath = path.join(path.dirname(uploadRoot), path.basename(uploadRoot), fileName);

  await fs.writeFile(absolutePath, parsedImage.buffer);

  if (existingPath?.startsWith('uploads/profile-pictures/')) {
    const oldFilePath = path.join(path.dirname(path.dirname(uploadRoot)), existingPath);
    await fs.unlink(oldFilePath).catch(() => {});
  }

  return relativePath;
}

// EN: Return the ranked candidate results used by dashboards and tables.
// TH: ส่งผลคะแนนผู้สมัครแบบจัดอันดับสำหรับแดชบอร์ดและตารางผล
async function listCandidateResults(query, termId) {
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
        c.personal_info,
        c.policies,
        c.policies AS bio,
        c.profile_picture,
        COUNT(v.vote_id) AS vote_count
      FROM candidates c
      INNER JOIN users u ON u.user_id = c.user_id
      LEFT JOIN votes v ON v.candidate_id = c.candidate_id
      WHERE c.term_id = ? AND c.is_registered = 1 AND u.role = 'candidate' AND u.is_enable = 1
      GROUP BY c.candidate_id, u.user_id, u.username, c.name, c.personal_info, c.policies, c.profile_picture
      ORDER BY vote_count DESC, display_name ASC
    `,
    [termId]
  );

  return rows;
}

// EN: Search candidate records by name, username, profile, or policies.
// TH: ค้นหาข้อมูลผู้สมัครจากชื่อ ชื่อผู้ใช้ โปรไฟล์ หรือเนื้อหานโยบาย
async function searchCandidateResults(query, termId, searchQuery) {
  if (!termId || !searchQuery) {
    return [];
  }

  const searchValue = `%${searchQuery}%`;
  const [rows] = await query(
    `
      SELECT
        c.candidate_id,
        u.user_id,
        u.username,
        COALESCE(NULLIF(c.name, ''), u.username) AS display_name,
        c.personal_info,
        c.policies,
        c.profile_picture,
        COUNT(v.vote_id) AS vote_count
      FROM candidates c
      INNER JOIN users u ON u.user_id = c.user_id
      LEFT JOIN votes v ON v.candidate_id = c.candidate_id
      WHERE c.term_id = ?
        AND c.is_registered = 1
        AND u.role = 'candidate'
        AND u.is_enable = 1
        AND (
          COALESCE(NULLIF(c.name, ''), u.username) LIKE ?
          OR u.username LIKE ?
          OR COALESCE(c.personal_info, '') LIKE ?
          OR COALESCE(c.policies, '') LIKE ?
        )
      GROUP BY c.candidate_id, u.user_id, u.username, c.name, c.personal_info, c.policies, c.profile_picture
      ORDER BY vote_count DESC, display_name ASC
      LIMIT 20
    `,
    [termId, searchValue, searchValue, searchValue, searchValue]
  );

  return rows;
}

// EN: Build the candidate-specific login payload returned after sign-in.
// TH: สร้าง payload สำหรับผู้สมัครที่ส่งกลับหลังจากเข้าสู่ระบบ
async function getCandidateLoginData(query, userId, username, activeTermId) {
  const termId = activeTermId ?? await getActiveTermId(query);
  const candidateProfile = await getCandidateProfileForUser(query, userId, termId);

  return {
    ...buildCandidateUserPayload(candidateProfile),
    display_name: candidateProfile?.display_name ?? username,
    active_term_id: termId,
    vote_count: Number(candidateProfile?.vote_count || 0)
  };
}

// EN: Register all candidate dashboard API routes in one place.
// TH: ลงทะเบียน route API ทั้งหมดของแดชบอร์ดผู้สมัครไว้ในจุดเดียว
function registerCandidateDashboardRoutes(app, { query, asyncHandler, uploadRoot }) {
  const resolvedUploadRoot = uploadRoot || path.join(__dirname, 'uploads', 'profile-pictures');

  // EN: Return the live leaderboard data for the active term.
  // TH: ส่งข้อมูลตารางคะแนนสดของเทอมที่กำลังใช้งาน
  const getCandidateResults = asyncHandler(async (req, res) => {
    const activeTermId = await getActiveTermId(query);
    res.json(await listCandidateResults(query, activeTermId));
  });

  // EN: Return one candidate profile so the frontend can prefill the edit form.
  // TH: ส่งโปรไฟล์ผู้สมัครหนึ่งคนเพื่อให้หน้าเว็บเติมข้อมูลในฟอร์มแก้ไขได้
  const getCandidateProfile = asyncHandler(async (req, res) => {
    const activeTermId = await getActiveTermId(query);

    if (!activeTermId) {
      return res.status(404).json({ success: false, message: 'No active election term found' });
    }

    const candidateProfile = await getCandidateProfileForUser(query, req.params.userId, activeTermId);

    if (!candidateProfile) {
      return res.status(404).json({ success: false, message: 'Candidate profile not found' });
    }

    res.json({
      success: true,
      user: buildCandidateUserPayload(candidateProfile)
    });
  });

  // EN: Save candidate name, profile text, or policies from the frontend editor.
  // TH: บันทึกชื่อผู้สมัคร ข้อความโปรไฟล์ หรือนโยบายจากหน้าฟอร์มแก้ไข
  const updateCandidateProfile = asyncHandler(async (req, res) => {
    const { user_id, display_name, personal_info, policies, bio } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }

    if ([display_name, personal_info, policies, bio].every((value) => value === undefined)) {
      return res.status(400).json({ success: false, message: 'Provide profile or policy fields to update' });
    }

    const activeTermId = await getActiveTermId(query);

    if (!activeTermId) {
      return res.status(409).json({ success: false, message: 'No active election term found' });
    }

    const updatedProfile = await updateCandidateProfileFields(query, user_id, activeTermId, {
      display_name,
      personal_info,
      policies: policies ?? bio
    });

    if (!updatedProfile) {
      return res.status(404).json({ success: false, message: 'Candidate profile could not be created' });
    }

    res.json({
      success: true,
      message: 'Candidate profile updated successfully',
      user: buildCandidateUserPayload(updatedProfile)
    });
  });

  // EN: Backward-compatible endpoint for policy or manifesto updates.
  // TH: endpoint แบบรองรับของเดิมสำหรับอัปเดตนโยบายหรือ manifesto
  const updateCandidateManifesto = asyncHandler(async (req, res) => {
    const { user_id, bio, policies } = req.body;

    if (!user_id || (bio === undefined && policies === undefined)) {
      return res.status(400).json({ success: false, message: 'user_id and policies are required' });
    }

    const activeTermId = await getActiveTermId(query);

    if (!activeTermId) {
      return res.status(409).json({ success: false, message: 'No active election term found' });
    }

    const updatedProfile = await updateCandidateProfileFields(query, user_id, activeTermId, {
      policies: policies ?? bio
    });

    res.json({
      success: true,
      message: 'Policies updated successfully',
      user: buildCandidateUserPayload(updatedProfile)
    });
  });

  // EN: Search active-term candidates and return matching result cards.
  // TH: ค้นหาผู้สมัครของเทอมที่กำลังใช้งานและส่งผลลัพธ์ที่ตรงกลับไป
  const searchCandidates = asyncHandler(async (req, res) => {
    const searchQuery = String(req.query.query || req.query.q || '').trim();

    if (!searchQuery) {
      return res.json({ success: true, query: '', results: [] });
    }

    const activeTermId = await getActiveTermId(query);

    if (!activeTermId) {
      return res.status(404).json({ success: false, message: 'No active election term found' });
    }

    res.json({
      success: true,
      query: searchQuery,
      results: await searchCandidateResults(query, activeTermId, searchQuery)
    });
  });

  // EN: Save a new profile photo uploaded by the candidate dashboard.
  // TH: บันทึกรูปโปรไฟล์ใหม่ที่อัปโหลดมาจากแดชบอร์ดผู้สมัคร
  const updateCandidateProfilePicture = asyncHandler(async (req, res) => {
    const { user_id, imageDataUrl } = req.body;

    if (!user_id || !imageDataUrl) {
      return res.status(400).json({ success: false, message: 'user_id and imageDataUrl are required' });
    }

    const activeTermId = await getActiveTermId(query);

    if (!activeTermId) {
      return res.status(409).json({ success: false, message: 'No active election term found' });
    }

    let candidateProfile = await ensureCandidateProfile(query, user_id, activeTermId);

    if (!candidateProfile) {
      return res.status(404).json({ success: false, message: 'Candidate profile could not be created' });
    }

    let profilePicturePath;

    try {
      profilePicturePath = await saveProfilePicture(
        candidateProfile.candidate_id,
        candidateProfile.profile_picture,
        imageDataUrl,
        resolvedUploadRoot
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

    candidateProfile = await getCandidateProfileForUser(query, user_id, activeTermId);

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      user: buildCandidateUserPayload(candidateProfile)
    });
  });

  app.get('/api/results', getCandidateResults);
  app.get('/api/candidate/results', getCandidateResults);
  app.get('/api/candidate/profile/:userId', getCandidateProfile);
  app.get('/api/candidate/search', searchCandidates);

  app.post('/api/candidate/profile', updateCandidateProfile);
  app.post('/api/update-bio', updateCandidateManifesto);
  app.post('/api/candidate/manifesto', updateCandidateManifesto);

  app.post('/api/update-profile-picture', updateCandidateProfilePicture);
  app.post('/api/candidate/profile-picture', updateCandidateProfilePicture);
}

module.exports = {
  getActiveTermId,
  getCandidateLoginData,
  registerCandidateDashboardRoutes
};
