// ==========================================
// ฟังก์ชัน: ก๊อปปี้ term_id ปัจจุบัน แล้วส่งไปหน้าใหม่
// ==========================================
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

(() => {
    const API = {
        listVoters: '/api/admin/voters',
        createVoter: '/api/admin/create-voter'
    };

    const VOTER_NAMES_STORAGE_KEY = 'mfu_voter_names_v1';
    let voterRefreshTimer = null;

    document.addEventListener('DOMContentLoaded', () => {
        initVoterManagementIfPresent();
    });

    function initVoterManagementIfPresent() {
        const tbody = document.getElementById('voterTableBody');
        if (!tbody) return; // ไม่ใช่หน้า Voting

        const toggle = document.getElementById('seeVotingToggle');
        const search = document.getElementById('searchVoter');

        if (toggle) toggle.addEventListener('change', applyVoterFilters);
        if (search) search.addEventListener('input', applyVoterFilters);

        refreshVoterTableFromServer();
        voterRefreshTimer = window.setInterval(refreshVoterTableFromServer, 10000); // auto refresh ทุก 10 วิ
    }

    async function refreshVoterTableFromServer() {
        const tbody = document.getElementById('voterTableBody');
        if (!tbody) return;

        try {
            const termId = new URLSearchParams(window.location.search).get('term_id');
            const res = await fetch(termId ? `${API.listVoters}?term_id=${termId}` : API.listVoters, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) return;
            const json = await res.json(); // รูปแบบ { data: [...] }
            const voters = Array.isArray(json?.data) ? json.data : [];
            renderVoterRows(tbody, voters);
            applyVoterFilters();
        } catch (error) {
            console.warn('Failed to refresh voters:', error);
        }
    }

    function renderVoterRows(tbody, voters) {
        const nameMap = loadVoterNameMap();
        tbody.innerHTML = '';

        voters.forEach(voter => {
            const citizenId = String(voter.citizen_id ?? '').trim();
            const isVoted = Number(voter.is_voted) === 1;
            const isEnabled = Number(voter.is_enable) === 1;
            const fullName = (nameMap[citizenId] || '').trim();

            const tr = document.createElement('tr');
            tr.dataset.citizenId = citizenId;
            tr.dataset.voted = isVoted ? '1' : '0';
            tr.dataset.enabled = isEnabled ? '1' : '0';
            tr.dataset.fullName = fullName;

            tr.innerHTML = `
                <td class="px-6 py-4">${escapeHtml(citizenId)}</td>
                <td class="px-6 py-4">${escapeHtml(fullName || '-')}</td>
                <td class="px-6 py-4 text-center">
                    ${isVoted
                        ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Voted</span>'
                        : '<span class="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">Not Voted</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                    ${isEnabled
                        ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Enabled</span>'
                        : '<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">Disabled</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                    <button onclick="toggleVoterStatus(this)" class="${isEnabled
                        ? 'text-red-600'
                        : 'text-green-600'} text-sm font-medium hover:underline">${isEnabled ? 'Disable' : 'Enable'}</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    function applyVoterFilters() {
        const tbody = document.getElementById('voterTableBody');
        if (!tbody) return;

        const toggle = document.getElementById('seeVotingToggle');
        const search = document.getElementById('searchVoter');
        const query = (search?.value || '').trim().toLowerCase();

        // toggle on = แสดงเฉพาะคนที่ยัง Not Voted, toggle off = แสดงทั้งหมด
        const showOnlyNotVoted = Boolean(toggle?.checked);

        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
            const votedFromDataset = row.dataset.voted === '1' || row.dataset.voted === '0';
            const voted = votedFromDataset
                ? row.dataset.voted === '1'
                : (() => {
                    const statusText = String(row.cells?.[2]?.textContent || '').toLowerCase();
                    if (statusText.includes('not voted')) return false;
                    if (statusText.includes('voted')) return true;
                    return false;
                })();

            const citizenId = ((row.dataset.citizenId || row.cells?.[0]?.textContent || '')).toLowerCase();
            const fullName = ((row.dataset.fullName || row.cells?.[1]?.textContent || '')).toLowerCase();

            const statusMatch = showOnlyNotVoted ? !voted : true;
            const textMatch = query === '' || citizenId.includes(query) || fullName.includes(query);
            row.style.display = statusMatch && textMatch ? '' : 'none';
        });
    }

    window.toggleVoterStatus = function toggleVoterStatus(btn) {
        const row = btn.closest('tr');
        if (!row) return;

        const isEnabled = row.dataset.enabled === '1';
        row.dataset.enabled = isEnabled ? '0' : '1';

        const accountCell = row.cells?.[3];
        if (accountCell) {
            accountCell.innerHTML = isEnabled
                ? '<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">Disabled</span>'
                : '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Enabled</span>';
        }

        btn.innerText = isEnabled ? 'Enable' : 'Disable';
        btn.className = `${isEnabled ? 'text-green-600' : 'text-red-600'} text-sm font-medium hover:underline`;
    };

    // Modal สำหรับเพิ่ม voter ใหม่ + validation
    window.addVoterPrompt = async function addVoterPrompt() {
        const result = await Swal.fire({
            title: 'Add Voter',
            html: `
                <input id="swal-id" class="swal2-input" placeholder="Citizen ID">
                <input id="swal-laserid" class="swal2-input" placeholder="Laser ID">
                <input id="swal-name" class="swal2-input" placeholder="Full Name">
            `,
            showCancelButton: true,
            confirmButtonText: 'Add',
            focusConfirm: false,
            preConfirm: () => {
                return {
                    citizenId: document.getElementById('swal-id')?.value || '',
                    laserId: document.getElementById('swal-laserid')?.value || '',
                    fullName: document.getElementById('swal-name')?.value || ''
                };
            }
        });

        if (!result.isConfirmed) return;

        const citizenIdRaw = String(result.value?.citizenId || '').trim();
        const laserId = String(result.value?.laserId || '').trim();
        const fullName = String(result.value?.fullName || '').trim();
        const termId = new URLSearchParams(window.location.search).get('term_id');
        if (!termId) {
            await Swal.fire('Error', 'ไม่พบ term_id ใน URL', 'error');
            return;
        }

        const citizenId = normalizeCitizenId(citizenIdRaw);
        const validationError = validateVoterInput({ citizenId, laserId, fullName });
        if (validationError) {
            await Swal.fire('กรอกข้อมูลไม่ถูกต้อง', validationError, 'error');
            return;
        }

        try {
            const res = await fetch(API.createVoter, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ citizen_id: citizenId, laser_id: laserId, confirm_laser_id: laserId, term_id: Number(termId) })
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                await Swal.fire('Error', json?.message || 'เพิ่มรายชื่อ Voter ไม่สำเร็จ', 'error');
                return;
            }

            saveVoterName(citizenId, fullName);
            await Swal.fire('Success', json?.message || 'เพิ่มข้อมูลเรียบร้อยแล้ว', 'success');
            await refreshVoterTableFromServer();
        } catch (error) {
            await Swal.fire('Error', 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ', 'error');
        }
    };

    function validateVoterInput({ citizenId, laserId, fullName }) {
        if (!fullName) return 'กรุณากรอก Full Name';
        if (!/^[0-9]{13}$/.test(citizenId)) return 'Citizen ID ต้องเป็นตัวเลข 13 หลักเท่านั้น';
        if (!/^[A-Za-z0-9]{12}$/.test(laserId)) return 'Laser ID ต้องยาว 12 ตัว และเป็นตัวเลข/อักษรอังกฤษเท่านั้น';
        return null;
    }

    function normalizeCitizenId(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function loadVoterNameMap() {
        try {
            const raw = localStorage.getItem(VOTER_NAMES_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch {
            return {};
        }
    }

    function saveVoterName(citizenId, fullName) {
        const map = loadVoterNameMap();
        map[citizenId] = fullName;
        localStorage.setItem(VOTER_NAMES_STORAGE_KEY, JSON.stringify(map));
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();
