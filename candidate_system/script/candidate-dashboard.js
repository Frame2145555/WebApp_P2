document.addEventListener('DOMContentLoaded', () => {
  // ตรวจสิทธิ์ผู้ใช้งานก่อนแสดงหน้า candidate dashboard
  const user = VotingApp.requireRole('candidate');

  if (!user) {
    return;
  }

  // เก็บ state กลางของหน้า เพื่อให้ render ใหม่ได้ง่าย
  const state = {
    results: [],
    filteredResults: [],
    chart: null,
    pendingProfileImage: null
  };

  // รวม element ที่ต้องใช้บ่อยไว้ที่เดียว จะได้อ่านและดูแลง่าย
  const elements = {
    displayName: document.getElementById('display-name'),
    summaryName: document.getElementById('summaryName'),
    summaryRank: document.getElementById('summaryRank'),
    voteCount: document.getElementById('voteCount'),
    rankValue: document.getElementById('rankValue'),
    displayBio: document.getElementById('display-bio'),
    bioInput: document.getElementById('bioInput'),
    resultsStatus: document.getElementById('resultsStatus'),
    tableStatus: document.getElementById('tableStatus'),
    searchInput: document.getElementById('searchInput'),
    resultsTable: document.getElementById('resultsTable'),
    bioModal: document.getElementById('bioModal'),
    logoutButton: document.getElementById('logoutButton'),
    shareButton: document.getElementById('shareProfileButton'),
    openBioModalButton: document.getElementById('openBioModalButton'),
    closeBioModalButton: document.getElementById('closeBioModalButton'),
    saveBioButton: document.getElementById('saveBioButton'),
    profilePicturePreview: document.getElementById('profilePicturePreview'),
    profileImageInput: document.getElementById('profileImageInput'),
    choosePhotoButton: document.getElementById('choosePhotoButton'),
    savePhotoButton: document.getElementById('savePhotoButton'),
    profilePhotoStatus: document.getElementById('profilePhotoStatus'),
    chartContext: document.getElementById('leaderboardChart').getContext('2d')
  };

  const currentDisplayName = user.display_name || user.username || 'Candidate';
  const defaultProfilePicture = '../image/mfu-logo.png';

  // แสดงข้อมูลผู้ใช้เบื้องต้นตอนโหลดหน้า
  elements.displayName.textContent = currentDisplayName;
  elements.summaryName.textContent = currentDisplayName;
  syncBioFromUser();
  renderProfilePicture(user.profile_picture);

  // ผูก event ของปุ่มและช่องกรอกข้อมูล
  elements.logoutButton.addEventListener('click', VotingApp.logout);
  elements.shareButton.addEventListener('click', copyProfileLink);
  elements.openBioModalButton.addEventListener('click', openBioModal);
  elements.closeBioModalButton.addEventListener('click', closeBioModal);
  elements.saveBioButton.addEventListener('click', saveBio);
  elements.choosePhotoButton.addEventListener('click', () => elements.profileImageInput.click());
  elements.savePhotoButton.addEventListener('click', saveProfilePicture);
  elements.profileImageInput.addEventListener('change', handleProfileImageSelection);
  elements.searchInput.addEventListener('input', applySearch);

  loadDashboard();

  // ดึง manifesto จากข้อมูลผู้ใช้ที่เก็บไว้ในเครื่อง
  function syncBioFromUser() {
    if (!user.bio) {
      return;
    }

    elements.displayBio.textContent = `"${user.bio}"`;
    elements.bioInput.value = user.bio;
  }

  // แสดงรูปโปรไฟล์ ถ้าไม่มีให้ใช้โลโก้แทน
  function renderProfilePicture(profilePicture) {
    elements.profilePicturePreview.src = profilePicture
      ? VotingApp.resolveAssetUrl(profilePicture)
      : defaultProfilePicture;
  }

  // แปลงคะแนนเป็นตัวเลขที่ปลอดภัย
  function normalizeVoteCount(value) {
    return Number(value) || 0;
  }

  // เรียงผลคะแนนจากมากไปน้อย
  function sortResults(results) {
    return [...results].sort((left, right) => normalizeVoteCount(right.vote_count) - normalizeVoteCount(left.vote_count));
  }

  // ตรวจว่าข้อมูลแถวนั้นเป็นของ candidate คนปัจจุบันหรือไม่
  function isCurrentCandidate(candidate) {
    return String(candidate.user_id) === String(user.user_id) || candidate.username === user.username;
  }

  // เลือกชื่อที่จะแสดงในตารางและกราฟ
  function getCandidateLabel(candidate) {
    return candidate.display_name || candidate.username || 'Unknown Candidate';
  }

  // ดึงผลของ candidate ปัจจุบันจากชุดข้อมูลทั้งหมด
  function getCurrentCandidateResult() {
    return sortResults(state.results).find(isCurrentCandidate);
  }

  // โหลดข้อมูลคะแนนล่าสุดจาก backend
  async function loadDashboard() {
    try {
      state.results = sortResults(await VotingApp.api('/api/results'));
      elements.resultsStatus.textContent = state.results.length ? 'Live results connected.' : 'No active results yet.';
    } catch (error) {
      state.results = [];
      elements.resultsStatus.textContent = error.message;
    }

    applySearch();
    updateSummary();
    renderChart();
  }

  // กรองรายการตามคำค้นหา
  function applySearch() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const sortedResults = sortResults(state.results);

    state.filteredResults = query
      ? sortedResults.filter((candidate) => {
        const searchValue = `${candidate.display_name || ''} ${candidate.username || ''}`.toLowerCase();
        return searchValue.includes(query);
      })
      : sortedResults;

    renderResultsTable();
  }

  // อัปเดตสรุปคะแนนและอันดับของ candidate ปัจจุบัน
  function updateSummary() {
    const currentCandidate = getCurrentCandidateResult();
    const rank = currentCandidate ? sortResults(state.results).findIndex(isCurrentCandidate) + 1 : '--';

    elements.voteCount.textContent = currentCandidate ? normalizeVoteCount(currentCandidate.vote_count) : 0;
    elements.rankValue.textContent = rank;
    elements.summaryRank.textContent = rank;
  }

  // วาดตารางผลคะแนนแบบ live
  function renderResultsTable() {
    if (!state.filteredResults.length) {
      elements.resultsTable.innerHTML = `
        <tr>
          <td colspan="4" class="rounded-2xl bg-gray-50 px-4 py-8 text-center text-gray-500">
            No candidate results match this search yet.
          </td>
        </tr>
      `;
      elements.tableStatus.textContent = state.results.length ? 'No matches for the current search.' : 'No results available.';
      return;
    }

    const sortedResults = sortResults(state.results);
    elements.tableStatus.textContent = `Showing ${state.filteredResults.length} candidate${state.filteredResults.length === 1 ? '' : 's'}.`;

    elements.resultsTable.innerHTML = state.filteredResults.map((candidate) => {
      const rank = sortedResults.findIndex((item) => Number(item.candidate_id) === Number(candidate.candidate_id)) + 1;
      const isOwner = isCurrentCandidate(candidate);
      const candidateName = VotingApp.escapeHtml(getCandidateLabel(candidate));

      return `
        <tr class="${isOwner ? 'bg-mfuRed text-white shadow-lg' : 'bg-gray-50 text-gray-800'}">
          <td class="rounded-l-2xl px-4 py-4 font-black">${rank}</td>
          <td class="px-4 py-4 font-semibold">${candidateName}</td>
          <td class="px-4 py-4 font-bold">${normalizeVoteCount(candidate.vote_count)}</td>
          <td class="rounded-r-2xl px-4 py-4">
            <span class="${isOwner ? 'bg-white/15 text-white' : 'bg-mfuRed/10 text-mfuRed'} inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em]">
              ${isOwner ? 'You' : 'Candidate'}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // วาดกราฟอันดับ top 5 ด้วย Chart.js
  function renderChart() {
    const chartResults = sortResults(state.results).slice(0, 5);
    const labels = chartResults.length ? chartResults.map((candidate) => getCandidateLabel(candidate)) : ['No Data'];
    const data = chartResults.length ? chartResults.map((candidate) => normalizeVoteCount(candidate.vote_count)) : [0];
    const colors = chartResults.length
      ? chartResults.map((candidate) => (isCurrentCandidate(candidate) ? '#8C1D1D' : '#B38E50'))
      : ['#D1D5DB'];

    if (state.chart) {
      state.chart.destroy();
    }

    state.chart = new Chart(elements.chartContext, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Votes',
          data,
          backgroundColor: colors,
          borderRadius: 999
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  }

  // เปิด modal สำหรับแก้ manifesto
  function openBioModal() {
    elements.bioModal.classList.remove('hidden');
  }

  // ปิด modal แก้ manifesto
  function closeBioModal() {
    elements.bioModal.classList.add('hidden');
  }

  // คัดลอกลิงก์โปรไฟล์ปัจจุบันไปยัง clipboard
  async function copyProfileLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Profile link copied!');
    } catch (error) {
      alert('Unable to copy link on this browser.');
    }
  }

  // บันทึก manifesto ใหม่ไป backend
  async function saveBio() {
    const bioContent = elements.bioInput.value.trim();

    if (!bioContent) {
      alert('Please enter your manifesto first.');
      return;
    }

    try {
      const response = await VotingApp.api('/api/update-bio', {
        method: 'POST',
        body: {
          user_id: user.user_id,
          bio: bioContent
        }
      });

      user.bio = response.user?.bio ?? bioContent;
      user.candidate_id = response.user?.candidate_id ?? user.candidate_id ?? null;
      user.display_name = response.user?.display_name ?? user.display_name ?? user.username;

      VotingApp.setUser(user);
      elements.displayBio.textContent = `"${user.bio}"`;
      closeBioModal();
      alert('Manifesto updated!');
    } catch (error) {
      alert(error.message);
    }
  }

  // เปลี่ยนข้อความสถานะของรูปโปรไฟล์ตามระดับความสำคัญ
  function setProfilePhotoStatus(text, tone = 'default') {
    elements.profilePhotoStatus.textContent = text;
    elements.profilePhotoStatus.className = `text-xs font-semibold uppercase tracking-[0.2em] ${
      tone === 'error'
        ? 'text-red-600'
        : tone === 'success'
          ? 'text-green-700'
          : 'text-gray-400'
    }`;
  }

  // ตรวจสอบไฟล์ที่ผู้ใช้เลือกและเตรียมรูปก่อนอัปโหลด
  function handleProfileImageSelection(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    const maxFileSize = 5 * 1024 * 1024;

    if (!allowedTypes.has(file.type)) {
      setProfilePhotoStatus('Use PNG, JPG or WEBP only', 'error');
      elements.profileImageInput.value = '';
      return;
    }

    if (file.size > maxFileSize) {
      setProfilePhotoStatus('Image must be 5 MB or smaller', 'error');
      elements.profileImageInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      state.pendingProfileImage = String(reader.result || '');
      state.pendingProfileFile = file;
      elements.profilePicturePreview.src = state.pendingProfileImage;
      elements.savePhotoButton.disabled = false;
      setProfilePhotoStatus('Ready to save new photo', 'success');
    };
    reader.onerror = () => {
      setProfilePhotoStatus('Could not read selected file', 'error');
    };
    reader.readAsDataURL(file);
  }

  // ส่งรูปโปรไฟล์ไป backend
  async function saveProfilePicture() {
    if (!state.pendingProfileFile) {
      setProfilePhotoStatus('Choose a photo first', 'error');
      return;
    }

    elements.savePhotoButton.disabled = true;
    setProfilePhotoStatus('Uploading photo...', 'default');

    try {
      // 🚨 ปั้นก้อนข้อมูลแบบ FormData (สำหรับส่งไฟล์ผ่าน HTTP)
      const formData = new FormData();
      formData.append('user_id', user.user_id);
      formData.append('profile_image', state.pendingProfileFile); // แนบไฟล์ของจริงไป

      // เรียกใช้ API (ตัว VotingApp.api ฉลาดพอที่จะรู้ว่านี่คือไฟล์ และจะจัดการให้อัตโนมัติ)
      const response = await VotingApp.api('/api/update-profile-picture', {
        method: 'POST',
        body: formData
      });

      // อัปเดตข้อมูล LocalStorage
      user.profile_picture = response.user?.profile_picture ?? user.profile_picture ?? null;
      VotingApp.setUser(user);

      renderProfilePicture(user.profile_picture);
      state.pendingProfileImage = null;
      state.pendingProfileFile = null;
      elements.profileImageInput.value = '';
      setProfilePhotoStatus('Profile photo updated', 'success');
    } catch (error) {
      renderProfilePicture(user.profile_picture);
      setProfilePhotoStatus(error.message, 'error');
      elements.savePhotoButton.disabled = false;
    }
  }
});
