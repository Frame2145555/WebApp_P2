(() => {
    // จุดรวม API endpoint ฝั่ง admin
    const API = {
        listVoters: '/api/admin/voters',
        createVoter: '/api/admin/create-voter'
    };

    // key สำหรับเก็บชื่อเต็มของ voter ใน localStorage
    const VOTER_NAMES_STORAGE_KEY = 'mfu_voter_names_v1';

    document.addEventListener('DOMContentLoaded', () => {
        initTabNavigationIfPresent();
        initDashboardChartIfPresent();
        initDashboardVotingStatusToggleIfPresent();
        initCandidateManagementIfPresent();
        initVoterManagementIfPresent();
    });

    // ------------------------------
    // Dashboard (กราฟ + toggle เปิด/ปิดโหวต)
    // ------------------------------
    let scoreChart;
    function initDashboardChartIfPresent() {
        const canvas = document.getElementById('scoreChart');
        if (!canvas || typeof Chart === 'undefined') return; // ไม่มีกราฟก็ข้าม

        const ctx = canvas.getContext('2d');
        scoreChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['CAND-001', 'CAND-002', 'CAND-003'],
                datasets: [{
                    label: 'Votes',
                    data: [450, 320, 150],
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

    function initDashboardVotingStatusToggleIfPresent() {
        const votingToggle = document.getElementById('votingToggle');
        const statusText = document.getElementById('statusText');
        if (!votingToggle || !statusText) return; // หน้าอื่นไม่มี element นี้

        votingToggle.addEventListener('change', function () {
            const isEnabled = this.checked;

            Swal.fire({
                title: isEnabled ? 'เปิดระบบโหวต?' : 'ปิดระบบโหวต?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#8C1515',
                confirmButtonText: 'ตกลง'
            }).then((result) => {
                if (result.isConfirmed) {
                    statusText.innerText = isEnabled ? 'ระบบกำลังเปิดรับการโหวต' : 'ระบบปิดการรับโหวตแล้ว';
                    statusText.className = isEnabled ? 'text-green-600' : 'text-red-600';
                } else {
                    this.checked = !isEnabled;
                }
            });
        });
    }

    // ------------------------------
    // Admin2 tab navigation (admin.html) สลับ section ด้วยปุ่มซ้าย
    // ------------------------------
    function initTabNavigationIfPresent() {
        const dashboardBtn = document.getElementById('menu-dashboard');
        const voterBtn = document.getElementById('menu-voter');
        const candidateBtn = document.getElementById('menu-candidate');
        if (!dashboardBtn && !voterBtn && !candidateBtn) return;

        const menus = [
            { btn: 'menu-dashboard', sec: 'section-dashboard' },
            { btn: 'menu-voter', sec: 'section-voter' },
            { btn: 'menu-candidate', sec: 'section-candidate' }
        ];

        menus.forEach(item => {
            const btnElement = document.getElementById(item.btn);
            if (!btnElement) return;
            btnElement.addEventListener('click', (e) => {
                e.preventDefault();
                updateActiveTab(item, menus);
            });
        });
    }

    function updateActiveTab(activeItem, allItems) {
        allItems.forEach(item => {
            const btn = document.getElementById(item.btn);
            const sec = document.getElementById(item.sec);
            if (!btn || !sec) return;

            if (item.btn === activeItem.btn) {
                btn.classList.add('active');
                sec.classList.remove('hidden-section');
                sec.classList.add('active-section');
            } else {
                btn.classList.remove('active');
                sec.classList.remove('active-section');
                sec.classList.add('hidden-section');
            }
        });
    }

    // ------------------------------
    // Candidate management (ถ้าอยู่หน้า Candidates.html)
    // ------------------------------
    function initCandidateManagementIfPresent() {
        const table = document.getElementById('candidateTable');
        if (!table) return;

        const addBtn = document.getElementById('addCandBtn');
        const idInput = document.getElementById('candIdInput');
        const searchBox = document.getElementById('searchBox');

        if (addBtn && idInput) {
            addBtn.addEventListener('click', () => {
                if (idInput.value.trim() === '') {
                    return Swal.fire('Error', 'กรุณากรอก ID', 'error');
                }
                addCandidateToTable(idInput.value.trim(), 'Enabled');
                idInput.value = '';
                Swal.fire('Success', 'เพิ่มข้อมูลเรียบร้อยแล้ว', 'success');
            });
        }

        if (searchBox) {
            searchBox.addEventListener('keyup', function () {
                const filter = this.value.toUpperCase();
                const rows = table.querySelector('tbody')?.rows || [];
                Array.from(rows).forEach(row => {
                    const id = row.cells?.[0]?.textContent || '';
                    row.style.display = id.toUpperCase().includes(filter) ? '' : 'none';
                });
            });
        }
    }

    function addCandidateToTable(id, status) {
        const tbody = document.querySelector('#candidateTable tbody');
        if (!tbody) return;
        const row = tbody.insertRow();
        row.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-800">${escapeHtml(id)}</td>
            <td class="px-6 py-4">
                <span class="status-badge px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">${escapeHtml(status)}</span>
            </td>
            <td class="px-6 py-4 text-center">
                <button onclick="toggleStatus(this)" class="text-red-600 hover:underline text-sm font-medium">Disable</button>
            </td>
        `;
    }

    window.toggleStatus = function toggleStatus(btn) {
        const row = btn.closest('tr');
        const badge = row?.querySelector('.status-badge');
        if (!badge) return;

        const isEnabled = badge.innerText.trim() === 'Enabled';
        if (isEnabled) {
            badge.innerText = 'Disabled';
            badge.className = 'status-badge px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500';
            btn.innerText = 'Enable';
            btn.className = 'text-green-600 hover:underline text-sm font-medium';
        } else {
            badge.innerText = 'Enabled';
            badge.className = 'status-badge px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700';
            btn.innerText = 'Disable';
            btn.className = 'text-red-600 hover:underline text-sm font-medium';
        }
    };

    // ------------------------------
    // Voter management (หน้า Voting.html)
    // ------------------------------
    let voterRefreshTimer = null;

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
            const res = await fetch(API.listVoters, { headers: { 'Accept': 'application/json' } });
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

        const showOnlyVoted = Boolean(toggle?.checked);

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

            const statusMatch = showOnlyVoted ? voted : !voted;
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

    // Add Voter prompt + validation + save
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

        const citizenId = normalizeCitizenId(citizenIdRaw);
        const validationError = validateVoterInput({ citizenId, laserId, fullName }); // ตรวจความถูกต้องก่อนยิง API
        if (validationError) {
            await Swal.fire('กรอกข้อมูลไม่ถูกต้อง', validationError, 'error');
            return;
        }

        try {
            const res = await fetch(API.createVoter, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ citizen_id: citizenId, laser_id: laserId })
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

    // ตรวจรูปแบบข้อมูล voter
    function validateVoterInput({ citizenId, laserId, fullName }) {
        if (!fullName) return 'กรุณากรอก Full Name';
        if (!/^[0-9]{13}$/.test(citizenId)) return 'Citizen ID ต้องเป็นตัวเลข 13 หลักเท่านั้น';
        if (!/^[A-Za-z0-9]{12}$/.test(laserId)) return 'Laser ID ต้องยาว 12 ตัว และเป็นตัวเลข/อักษรอังกฤษเท่านั้น';
        return null;
    }

    // ล้างตัวอักษรที่ไม่ใช่ตัวเลขออก
    function normalizeCitizenId(value) {
        return String(value || '').replace(/\D/g, '');
    }

    // โหลดชื่อเต็มที่ cache ไว้ใน localStorage
    function loadVoterNameMap() {
        try {
            const raw = localStorage.getItem(VOTER_NAMES_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch {
            return {};
        }
    }

    // บันทึกชื่อเต็มของ voter ลง localStorage
    function saveVoterName(citizenId, fullName) {
        const map = loadVoterNameMap();
        map[citizenId] = fullName;
        localStorage.setItem(VOTER_NAMES_STORAGE_KEY, JSON.stringify(map));
    }

    // ป้องกัน XSS เวลาฝังค่าใน HTML
    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();