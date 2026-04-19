
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
            const userId = Number(voter.user_id);
            const fullName = (nameMap[citizenId] || '').trim();

            const tr = document.createElement('tr');
            tr.dataset.userId = Number.isFinite(userId) ? String(userId) : '';
            tr.dataset.citizenId = citizenId;
            tr.dataset.voted = isVoted ? '1' : '0';
            tr.dataset.enabled = isEnabled ? '1' : '0';
            tr.dataset.fullName = fullName;

            tr.innerHTML = `
                <td class="px-6 py-4">${escapeHtml(citizenId)}</td>
                <td class="px-6 py-4">${escapeHtml(fullName || '-')}</td>
                <td class="px-6 py-4 text-center">
                    ${isVoted
                        ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">ใช้สิทธิ์แล้ว</span>'
                        : '<span class="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">ยังไม่ได้ใช้สิทธิ์</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                    ${isEnabled
                        ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">เปิดใช้งาน</span>'
                        : '<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">ปิดใช้งาน</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                    <button onclick="toggleVoterStatus(this)" class="btn btn-xs btn-outline ${isEnabled ? 'btn-error' : 'btn-success'} w-20">
                        ${isEnabled ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    </button>
                    <button onclick="deleteVoter('${userId}', '${escapeHtml(citizenId)}')" class="btn btn-xs btn-error text-white w-14">ลบ</button>
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
                    if (statusText.includes('ยังไม่ได้ใช้สิทธิ์')) return false;
                    if (statusText.includes('ใช้สิทธิ์แล้ว')) return true;
                    return false;
                })();

            const citizenId = ((row.dataset.citizenId || row.cells?.[0]?.textContent || '')).toLowerCase();
            const fullName = ((row.dataset.fullName || row.cells?.[1]?.textContent || '')).toLowerCase();

            const statusMatch = showOnlyNotVoted ? !voted : true;
            const textMatch = query === '' || citizenId.includes(query) || fullName.includes(query);
            row.style.display = statusMatch && textMatch ? '' : 'none';
        });
    }

    window.toggleVoterStatus = async function toggleVoterStatus(btn) {
        const row = btn.closest('tr');
        if (!row) return;

        const isEnabled = row.dataset.enabled === '1';
        const userId = Number(row.dataset.userId);
        const citizenId = row.dataset.citizenId || 'ผู้มีสิทธิ์คนนี้';

        if (!Number.isFinite(userId)) {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบ user_id ของผู้ใช้คนนี้', 'error');
            return;
        }

        const nextStatus = isEnabled ? 0 : 1;
        const actionText = nextStatus === 1 ? 'เปิดใช้งาน' : 'ปิดใช้งาน';

        const confirmed = await Swal.fire({
            title: `ยืนยันการ${actionText}?`,
            text: `ต้องการ${actionText}ผู้มีสิทธิ์ ${citizenId} ใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก',
            buttonsStyling: false,
            scrollbarPadding: false,
            customClass: {
                confirmButton: `btn ${nextStatus === 1 ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white mx-2 border-none`,
                cancelButton: 'btn btn-outline mx-2'
            }
        });

        if (!confirmed.isConfirmed) return;

        btn.disabled = true;

        try {
            const res = await fetch('/api/admin/toggle-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, status: nextStatus })
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(json?.message || 'ไม่สามารถอัปเดตสถานะได้');
            }

            Swal.fire({
                title: 'สำเร็จ!',
                text: json.message || `${actionText}ผู้มีสิทธิ์เรียบร้อยแล้ว`,
                icon: 'success',
                buttonsStyling: false,
                scrollbarPadding: false,
                customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
            });

            row.dataset.enabled = String(nextStatus);

            const accountCell = row.cells?.[3];
            if (accountCell) {
                accountCell.innerHTML = nextStatus === 1
                    ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">เปิดใช้งาน</span>'
                    : '<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">ปิดใช้งาน</span>';
            }

            btn.innerText = nextStatus === 1 ? 'ปิดใช้งาน' : 'เปิดใช้งาน';
            btn.className = `btn btn-xs btn-outline ${nextStatus === 1 ? 'btn-error' : 'btn-success'} w-20`;
        } catch (error) {
            Swal.fire({
                title: 'ข้อผิดพลาด',
                text: error.message || 'ไม่สามารถอัปเดตสถานะได้',
                icon: 'error',
                buttonsStyling: false,
                scrollbarPadding: false,
                customClass: { confirmButton: 'btn btn-error text-white border-none' }
            });
        } finally {
            btn.disabled = false;
        }
    };

    window.deleteVoter = async function deleteVoter(userId, citizenId) {
        if (!userId) {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบ user_id ของผู้มีสิทธิ์คนนี้', 'error');
            return;
        }

        const confirm = await Swal.fire({
            title: 'ยืนยันการลบ?',
            text: `ต้องการลบผู้มีสิทธิ์ ${citizenId} ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้`,
            icon: 'error',
            showCancelButton: true,
            confirmButtonText: 'ลบเลย',
            cancelButtonText: 'ยกเลิก',
            buttonsStyling: false,
            scrollbarPadding: false,
            customClass: {
                confirmButton: 'btn bg-red-600 hover:bg-red-700 text-white mx-2 border-none',
                cancelButton: 'btn btn-outline mx-2'
            }
        });

        if (!confirm.isConfirmed) return;

        try {
            const response = await fetch(`/api/admin/voter/${userId}`, { method: 'DELETE' });
            const result = await response.json().catch(() => ({}));

            if (result.status === 'success') {
                await Swal.fire({
                    title: 'ลบสำเร็จ!',
                    text: result.message,
                    icon: 'success',
                    scrollbarPadding: false,
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
                });
                refreshVoterTableFromServer();
            } else {
                Swal.fire({
                    title: 'ไม่สามารถลบได้',
                    text: result.message || 'เกิดข้อผิดพลาด',
                    icon: 'warning',
                    scrollbarPadding: false,
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn btn-warning mx-2' }
                });
            }
        } catch (error) {
            console.error('Delete Voter Error:', error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
        }
    };

    // Modal สำหรับเพิ่ม voter ใหม่ + validation
    window.addVoterPrompt = async function addVoterPrompt() {
        const result = await Swal.fire({
            title: 'เพิ่มผู้มีสิทธิ์เลือกตั้ง',
            html: `
                <input id="swal-id" class="swal2-input" placeholder="เลขบัตรประชาชน (13 หลัก)">
                <input id="swal-laserid" class="swal2-input" placeholder="รหัสหลังบัตร (Laser ID)">
                <input id="swal-name" class="swal2-input" placeholder="ชื่อ-นามสกุล">
            `,
            showCancelButton: true,
            confirmButtonText: 'เพิ่ม',
            cancelButtonText: 'ยกเลิก',
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
            await Swal.fire('ข้อผิดพลาด', 'ไม่พบ term_id ใน URL', 'error');
            return;
        }

        const citizenId = normalizeCitizenId(citizenIdRaw);
        const validationError = validateVoterInput({ citizenId, laserId, fullName });
        if (validationError) {
            await Swal.fire('ข้อมูลไม่ถูกต้อง', validationError, 'error');
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
                await Swal.fire('ข้อผิดพลาด', json?.message || 'ไม่สามารถเพิ่มผู้มีสิทธิ์ได้', 'error');
                return;
            }

            saveVoterName(citizenId, fullName);
            await Swal.fire('สำเร็จ', json?.message || 'เพิ่มผู้มีสิทธิ์เรียบร้อยแล้ว', 'success');
            await refreshVoterTableFromServer();
        } catch (error) {
            await Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
        }
    };

    function validateVoterInput({ citizenId, laserId, fullName }) {
        if (!fullName) return 'กรุณากรอกชื่อ-นามสกุล';
        if (!/^[0-9]{13}$/.test(citizenId)) return 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก';
        if (!/^[A-Za-z0-9]{12}$/.test(laserId)) return 'รหัสหลังบัตร (Laser ID) ต้องมี 12 ตัวอักษรหรือตัวเลข';
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
