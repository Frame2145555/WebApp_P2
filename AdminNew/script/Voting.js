
function goToPage(pageName) {
    const urlParams = new URLSearchParams(window.location.search);
    const currentTermId = urlParams.get('term_id');

    if (currentTermId) {
        window.location.href = `/AdminNew/views/${pageName}?term_id=${currentTermId}`;
    } else {
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
        if (!tbody) return;

        const toggle = document.getElementById('seeVotingToggle');
        const search = document.getElementById('searchVoter');

        if (toggle) toggle.addEventListener('change', applyVoterFilters);
        if (search) search.addEventListener('input', applyVoterFilters);

        refreshVoterTableFromServer();
        voterRefreshTimer = window.setInterval(refreshVoterTableFromServer, 10000);
    }

    async function refreshVoterTableFromServer() {
        const tbody = document.getElementById('voterTableBody');
        if (!tbody) return;

        try {
            const termId = new URLSearchParams(window.location.search).get('term_id');
            const res = await fetch(termId ? `${API.listVoters}?term_id=${termId}` : API.listVoters, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) return;
            const json = await res.json();
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
                        ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Voted</span>'
                        : '<span class="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">Not Voted</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                    ${isEnabled
                        ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Enabled</span>'
                        : '<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">Disabled</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                    <button onclick="toggleVoterStatus(this)" class="btn btn-xs btn-outline ${isEnabled ? 'btn-error' : 'btn-success'} w-16">
                        ${isEnabled ? 'Disable' : 'Enable'}
                    </button>
                    <button onclick="deleteVoter('${userId}', '${escapeHtml(citizenId)}')" class="btn btn-xs btn-error text-white w-16">Delete</button>
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

    window.toggleVoterStatus = async function toggleVoterStatus(btn) {
        const row = btn.closest('tr');
        if (!row) return;

        const isEnabled = row.dataset.enabled === '1';
        const userId = Number(row.dataset.userId);
        const citizenId = row.dataset.citizenId || 'this voter';

        if (!Number.isFinite(userId)) {
            Swal.fire('Error', 'Could not find user_id for this voter.', 'error');
            return;
        }

        const nextStatus = isEnabled ? 0 : 1;
        const actionText = nextStatus === 1 ? 'Enable' : 'Disable';

        const confirmed = await Swal.fire({
            title: `Confirm ${actionText}?`,
            text: `Do you want to ${actionText.toLowerCase()} voter ${citizenId}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, proceed!',
            cancelButtonText: 'Cancel',
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
                throw new Error(json?.message || 'Unable to update status.');
            }

            Swal.fire({
                title: 'Success!',
                text: json.message || `${actionText}d voter successfully.`,
                icon: 'success',
                buttonsStyling: false,
                scrollbarPadding: false,
                customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
            });

            row.dataset.enabled = String(nextStatus);

            const accountCell = row.cells?.[3];
            if (accountCell) {
                accountCell.innerHTML = nextStatus === 1
                    ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Enabled</span>'
                    : '<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">Disabled</span>';
            }

            btn.innerText = nextStatus === 1 ? 'Disable' : 'Enable';
            btn.className = `btn btn-xs btn-outline ${nextStatus === 1 ? 'btn-error' : 'btn-success'} w-16`;
        } catch (error) {
            Swal.fire({
                title: 'Error',
                text: error.message || 'Unable to update status.',
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
            Swal.fire('Error', 'Could not find user_id for this voter.', 'error');
            return;
        }

        const confirm = await Swal.fire({
            title: 'Confirm deletion?',
            text: `Are you sure you want to delete voter ${citizenId}? This action cannot be undone.`,
            icon: 'error',
            showCancelButton: true,
            confirmButtonText: 'Delete now',
            cancelButtonText: 'Cancel',
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
                    title: 'Deleted successfully!',
                    text: result.message,
                    icon: 'success',
                    scrollbarPadding: false,
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
                });
                refreshVoterTableFromServer();
            } else {
                Swal.fire({
                    title: 'Unable to delete',
                    text: result.message || 'An error occurred.',
                    icon: 'warning',
                    scrollbarPadding: false,
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn btn-warning mx-2' }
                });
            }
        } catch (error) {
            console.error('Delete Voter Error:', error);
            Swal.fire('Error', 'Unable to connect to the server.', 'error');
        }
    };

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
            cancelButtonText: 'Cancel',
            buttonsStyling: false,
            scrollbarPadding: false,
            customClass: {
                confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none mx-2 w-24',
                cancelButton: 'btn btn-outline mx-2 w-24'
            },
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
            await Swal.fire('Error', 'term_id was not found in the URL.', 'error');
            return;
        }

        const citizenId = normalizeCitizenId(citizenIdRaw);
        const validationError = validateVoterInput({ citizenId, laserId, fullName });
        if (validationError) {
            await Swal.fire('Invalid input', validationError, 'error');
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
                await Swal.fire('Error', json?.message || 'Failed to add voter.', 'error');
                return;
            }

            saveVoterName(citizenId, fullName);
            await Swal.fire('Success', json?.message || 'Voter added successfully.', 'success');
            await refreshVoterTableFromServer();
        } catch (error) {
            await Swal.fire('Error', 'Unable to connect to the server.', 'error');
        }
    };

    function validateVoterInput({ citizenId, laserId, fullName }) {
        if (!fullName) return 'Please enter full name.';
        if (!/^[0-9]{13}$/.test(citizenId)) return 'Citizen ID must contain exactly 13 digits.';
        if (!/^[A-Za-z0-9]{12}$/.test(laserId)) return 'Laser ID must be exactly 12 alphanumeric characters.';
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
