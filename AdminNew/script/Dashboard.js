// ==========================================
// 1. ดึงค่า term_id จาก URL 
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const currentTermId = urlParams.get('term_id');
const API_ORIGIN = window.location.port === '3000' ? '' : `${window.location.protocol}//${window.location.hostname}:3000`;

// ถ้าเกิดไม่มี term_id ให้เตะกลับไปหน้า Term
if (!currentTermId) {
    window.location.href = '/AdminNew/views/Term.html'; 
} else {
    // 🚨 อัปเดตลิงก์ใน Sidebar ให้ห้อย term_id ไปด้วยอัตโนมัติ!
    const sidebarLinks = document.querySelectorAll('aside ul li a');
    sidebarLinks.forEach(link => {
        const originalHref = link.getAttribute('href');
        // ยกเว้นหน้า Term ที่ไม่ต้องพก term_id กลับไป
        if (originalHref && originalHref !== '#' && !originalHref.includes('Term.html')) {
            // เอาลิงก์เดิม มาต่อท้ายด้วย ?term_id=...
            link.href = `${originalHref}?term_id=${currentTermId}`;
        }
    });
}

// ฟังก์ชัน: ก๊อปปี้ term_id ปัจจุบัน แล้วส่งไปหน้าใหม่
function goToPage(pageName) {
    // 1. ก๊อปปี้ term_id จาก URL ด้านบนของหน้าปัจจุบัน
    const urlParams = new URLSearchParams(window.location.search);
    const currentTermId = urlParams.get('term_id');

    // 2. เช็คว่าก๊อปปี้มาได้ไหม
    if (currentTermId) {
        // ถ้ามี: สั่งวาร์ปไปหน้าใหม่ พร้อมแปะ ?term_id=... ห้อยท้ายไปด้วย!
        window.location.href = `/AdminNew/views/${pageName}?term_id=${currentTermId}`;
    } else {
        // ถ้าไม่มี (แอดมินหลงทาง): เตะกลับหน้า Term
        window.location.href = '/AdminNew/views/Term.html';
    }
}

// 1. ฟังก์ชันดึงสถานะเทอมปัจจุบันมาแสดงตอนโหลดหน้าเว็บ
async function loadTermStatus() {
    try {
        const response = await fetch(`${API_ORIGIN}/api/admin/term/${currentTermId}`);
        const result = await response.json();

        if (result.status === 'success') {
            const term = result.data;
            const toggleBtn = document.getElementById('toggle-voting-status');
            
            // ถ้าเทอมนี้ is_active เป็น 1 ให้ปุ่มสวิตช์เป็น On (checked)
            if (toggleBtn) {
                toggleBtn.checked = term.is_active === 1;
            }
        }
    } catch (error) {
        console.error('Error loading term status:', error);
    }
}

// 2. ระบบตรวจจับการกดสวิตช์ เปิด/ปิด โหวต
const toggleVotingStatus = document.getElementById('toggle-voting-status');

if (toggleVotingStatus) {
    toggleVotingStatus.addEventListener('change', async (e) => {
        // e.target.checked จะเป็น true ถ้าเลื่อนเปิด และ false ถ้าเลื่อนปิด
        const isTurningOn = e.target.checked; 
        const newStatus = isTurningOn ? 1 : 0;

        // เด้ง SweetAlert ถามเพื่อความชัวร์ (กันมือลั่น)
        const confirmResult = await Swal.fire({
            title: isTurningOn ? 'Confirm enabling voting?' : 'Confirm disabling voting?',
            text: isTurningOn ? "Other active terms will be closed automatically." : "Users will no longer be able to vote.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: isTurningOn ? '#22c55e' : '#ef4444', // สีเขียวตอนเปิด สีแดงตอนปิด
            cancelButtonColor: '#9ca3af',
            confirmButtonText: isTurningOn ? 'Yes, enable now' : 'Yes, disable now',
            cancelButtonText: 'Cancel'
        });

        // ถ้ากดยกเลิก ให้ดันสวิตช์กลับไปที่เดิม
        if (!confirmResult.isConfirmed) {
            e.target.checked = !isTurningOn; 
            return;
        }

        // ถ้ากดยืนยัน ยิง API ไปอัปเดต Database
        try {
            const response = await fetch(`${API_ORIGIN}/api/admin/term/${currentTermId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            const result = await response.json();

            if (result.status === 'success') {
                Swal.fire({
                    title: 'Success!',
                    text: result.message,
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Update Status Error:', error);
            Swal.fire('Error', 'Unable to update status.', 'error');
            e.target.checked = !isTurningOn; // ดันสวิตช์กลับไปที่เดิมถ้า Error
        }
    });
}

(() => {
    let scoreChartInstance = null;
    let allCandidatesForResults = [];
    let resultSearchKeyword = '';

    document.addEventListener('DOMContentLoaded', () => {
        loadDashboardSummary();
        initVotingToggle();
        loadTermStatus();
        initResultsSearch();
    });

    async function loadDashboardSummary() {
        const canvas = document.getElementById('scoreChart');
        const resultsList = document.getElementById('results-list');
        if (!canvas) return;
        try {
            const res = await fetch(`/api/admin/dashboard?term_id=${currentTermId}`);
            const json = await res.json();
            if (!res.ok || json.status !== 'success') throw new Error(json.message || 'fetch fail');

            const data = json.data || {};
            updateStatsCards(data);
            renderChart(canvas, data.candidates || []);
            allCandidatesForResults = Array.isArray(data.candidates) ? data.candidates : [];
            if (resultsList) renderVotingResults(allCandidatesForResults, resultSearchKeyword);
        } catch (err) {
            console.error('dashboard summary error', err);
            allCandidatesForResults = [];
            if (resultsList) renderVotingResults([], resultSearchKeyword);
        }
    }

    function initResultsSearch() {
        const searchInput = document.getElementById('results-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', () => {
            resultSearchKeyword = searchInput.value || '';
            renderVotingResults(allCandidatesForResults, resultSearchKeyword);
        });
    }

    function updateStatsCards(data) {
        const totalVotersEl = document.getElementById('stat-total-voters');
        const votedEl = document.getElementById('stat-voted');
        const percentEl = document.getElementById('stat-percent');
        const candEl = document.getElementById('stat-candidates');

        if (totalVotersEl) totalVotersEl.textContent = data.total_voters ?? '-';
        if (votedEl) votedEl.textContent = data.total_voted ?? '-';
        if (percentEl) percentEl.textContent = data.voted_percent != null ? `${data.voted_percent}%` : '-';
        if (candEl) candEl.textContent = data.total_candidates ?? '-';
    }

    function renderChart(canvas, candidates) {
        const labels = candidates.map(c => c.name || c.candidate_name || c.full_name || c.candidate_id || c.id || '-');
        const votes = candidates.map(c => Number(c.score ?? c.votes ?? c.vote_count ?? 0));
        const ctx = canvas.getContext('2d');

        if (scoreChartInstance) scoreChartInstance.destroy();

        scoreChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Votes',
                    data: votes,
                    backgroundColor: '#8C1515',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y'
            }
        });
    }

    function renderVotingResults(candidates, searchKeyword = '') {
        const resultsList = document.getElementById('results-list');
        if (!resultsList) return;

        resultsList.innerHTML = '';

        const normalizedKeyword = String(searchKeyword || '').trim().toLowerCase();

        const sourceCandidates = Array.isArray(candidates) ? candidates : [];
        const filteredCandidates = sourceCandidates.filter((candidate) => {
            if (!normalizedKeyword) return true;
            const name = String(candidate.name || candidate.candidate_name || candidate.full_name || '').toLowerCase();
            const code = String(candidate.candidate_code || candidate.code || candidate.candidate_id || candidate.id || '').toLowerCase();
            return name.includes(normalizedKeyword) || code.includes(normalizedKeyword);
        });

        if (filteredCandidates.length === 0) {
            const emptyState = document.createElement('p');
            emptyState.className = 'results-empty';
            emptyState.textContent = normalizedKeyword
                ? 'No candidates match your search.'
                : 'No voting results available for this term.';
            resultsList.appendChild(emptyState);
            return;
        }

        const rankedCandidates = [...filteredCandidates]
            .map((candidate, index) => ({
                ...candidate,
                __originalIndex: index,
                __votes: Number(candidate.score ?? candidate.votes ?? candidate.vote_count ?? 0)
            }))
            .sort((a, b) => {
                if (b.__votes !== a.__votes) return b.__votes - a.__votes;
                return a.__originalIndex - b.__originalIndex;
            });

        rankedCandidates.forEach((candidate, index) => {
            const rank = index + 1;
            const row = document.createElement('article');
            row.className = 'result-row';

            const rankBadge = document.createElement('span');
            rankBadge.className = 'result-rank-badge';
            if (rank === 1) rankBadge.classList.add('rank-first');
            if (rank === 2) rankBadge.classList.add('rank-second');
            if (rank === 3) rankBadge.classList.add('rank-third');
            rankBadge.textContent = String(rank);

            const candidateBlock = document.createElement('div');

            const candidateName = document.createElement('p');
            candidateName.className = 'result-candidate-name';
            candidateName.textContent = candidate.name || candidate.candidate_name || candidate.full_name || `Candidate ${rank}`;

            const candidateCode = document.createElement('p');
            candidateCode.className = 'result-candidate-code';
            candidateCode.textContent = formatCandidateCode(candidate);

            candidateBlock.appendChild(candidateName);
            candidateBlock.appendChild(candidateCode);

            const voteCount = document.createElement('p');
            voteCount.className = 'result-votes';
            voteCount.textContent = String(candidate.__votes);

            row.appendChild(rankBadge);
            row.appendChild(candidateBlock);
            row.appendChild(voteCount);

            resultsList.appendChild(row);
        });
    }

    function formatCandidateCode(candidate) {
        const rawCode = candidate.candidate_code || candidate.code || candidate.candidate_id || candidate.id;
        if (rawCode == null) return '-';

        const codeText = String(rawCode).trim();
        if (!codeText) return '-';

        const numericMatch = codeText.match(/\d+/);
        if (numericMatch) {
            const numericValue = Number(numericMatch[0]);
            if (Number.isFinite(numericValue)) {
                return `CAND-${String(numericValue).padStart(3, '0')}`;
            }
        }

        return codeText.toUpperCase();
    }

    // Toggle เปิด/ปิดระบบโหวตบน Dashboard
    function initVotingToggle() {
        const votingToggle = document.getElementById('votingToggle');
        const statusText = document.getElementById('statusText');
        if (!votingToggle || !statusText) return;

        votingToggle.addEventListener('change', function () {
            const isEnabled = this.checked;

            Swal.fire({
                title: isEnabled ? 'Open Voting System?' : 'Close Voting System?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#8C1515',
                confirmButtonText: 'Okay',
                cancelButtonText: 'Cancel'
            }).then((result) => {
                if (result.isConfirmed) {
                    statusText.innerText = isEnabled ? 'now is voting' : 'system is closed for voting';
                    statusText.className = isEnabled ? 'text-green-600' : 'text-red-600';
                    // ซิงก์สถานะกับ API term
                    fetch(`/api/admin/toggle-voting`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ term_id: Number(currentTermId), status: isEnabled ? 1 : 0 })
                    }).catch(err => console.error('toggle voting api error', err));
                } else {
                    this.checked = !isEnabled;
                }
            });
        });
    }
})();