/**
 * Admin Candidates Management Frontend Controller
 * Handles candidate and policy management UI interactions
 */

let currentCandidates = [];
let currentPolicies = [];
let selectedCandidateId = null;
const API_URL = 'http://localhost:3000';

// EN: Initialize page when DOM loads
// TH: เตรียมหน้าเมื่อ DOM โหลด
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadCandidates();
  loadDashboardStats();
});

// EN: Setup all event listeners for modal and button interactions
// TH: ตั้งค่าการฟังเหตุการณ์ทั้งหมด
function setupEventListeners() {
  // Candidate Modal Events
  document.getElementById('addCandidateBtn').addEventListener('click', openCandidateModal);
  document.getElementById('closeModalBtn').addEventListener('click', closeCandidateModal);
  document.getElementById('candidateForm').addEventListener('submit', handleAddCandidate);

  // Policy Modal Events
  document.getElementById('addPolicyBtn').addEventListener('click', openPolicyModal);
  document.getElementById('closePolicyModalBtn').addEventListener('click', closePolicyModal);
  document.getElementById('policyForm').addEventListener('submit', handleAddPolicy);

  // View Policy Modal Events
  document.getElementById('closeViewPolicyModalBtn').addEventListener('click', closeViewPolicyModal);
  document.getElementById('closeViewPolicyBtn').addEventListener('click', closeViewPolicyModal);

  // Search and Filter
  document.getElementById('searchCandidates').addEventListener('input', filterCandidates);
  document.getElementById('filterStatus').addEventListener('change', filterCandidates);

  // Logout
  document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = '/Login.html';
  });
}

// EN: Load all candidates from API
// TH: โหลดรายชื่อผู้สมัครทั้งหมดจาก API
async function loadCandidates() {
  try {
    const response = await fetch(`${API_URL}/api/admin/candidates?term_id=1`);
    const result = await response.json();

    if (result.status === 'success') {
      currentCandidates = result.data;
      renderCandidatesTable(currentCandidates);
      updateCandidateSelect();
      console.log(`✅ Loaded ${currentCandidates.length} candidates`);
    }
  } catch (error) {
    console.error('❌ Error loading candidates:', error);
    showNotification('Error loading candidates', 'error');
  }
}

// EN: Load dashboard statistics
// TH: โหลดสถิติแดชบอร์ด
async function loadDashboardStats() {
  try {
    const response = await fetch(`${API_URL}/api/admin/dashboard-stats?term_id=1`);
    const result = await response.json();

    if (result.status === 'success') {
      const stats = result.stats;
      document.getElementById('totalCandidatesValue').textContent = stats.total_candidates;
      document.getElementById('withPoliciesValue').textContent = stats.with_policies;
      document.getElementById('currentTerm').textContent = `Term ${stats.term_id}`;
    }
  } catch (error) {
    console.error('❌ Error loading stats:', error);
  }
}

// EN: Render candidates table
// TH: วาดตารางผู้สมัคร
function renderCandidatesTable(candidates) {
  const tbody = document.getElementById('candidatesTable');
  tbody.innerHTML = '';

  if (candidates.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-gray-500">
          No candidates yet. <button onclick="document.getElementById('addCandidateBtn').click()" class="text-mfuRed font-bold">Add one now</button>
        </td>
      </tr>
    `;
    return;
  }

  candidates.forEach(candidate => {
    const statusBadge = candidate.is_registered === 1
      ? '<span class="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">Registered</span>'
      : '<span class="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">Pending</span>';

    const bioPreview = candidate.personal_info 
      ? candidate.personal_info.substring(0, 40) + (candidate.personal_info.length > 40 ? '...' : '')
      : '<span class="text-gray-400 italic">No bio</span>';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="pb-2 pr-4 font-bold text-mfuRed">${candidate.candidate_id}</td>
      <td class="pb-2 pr-4 font-semibold">${candidate.name}</td>
      <td class="pb-2 pr-4 text-sm text-gray-600">${bioPreview}</td>
      <td class="pb-2 pr-4">${statusBadge}</td>
      <td class="pb-2 pr-4">
        <span class="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
          ${candidate.policy_count} policies
        </span>
      </td>
      <td class="pb-2 flex gap-2">
        <button onclick="viewCandidatePolicies(${candidate.candidate_id}, '${candidate.name}')" 
          class="px-3 py-1 bg-mfuGold text-white rounded-lg text-xs font-bold hover:bg-mfuGold/90 transition">
          View
        </button>
        <button onclick="editCandidate(${candidate.candidate_id})" 
          class="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition">
          Edit
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// EN: Filter candidates by search and status
// TH: กรองผู้สมัครตามคำค้นหาและสถานะ
function filterCandidates() {
  const searchQuery = document.getElementById('searchCandidates').value.toLowerCase();
  const statusFilter = document.getElementById('filterStatus').value;

  const filtered = currentCandidates.filter(candidate => {
    const matchesSearch = candidate.name.toLowerCase().includes(searchQuery) ||
                         candidate.candidate_id.toString().includes(searchQuery);
    const matchesStatus = !statusFilter ||
                         (statusFilter === 'registered' && candidate.is_registered === 1) ||
                         (statusFilter === 'not-registered' && candidate.is_registered === 0);

    return matchesSearch && matchesStatus;
  });

  renderCandidatesTable(filtered);
}

// EN: Open candidate add/edit modal
// TH: เปิดโมดัลเพิ่ม/แก้ไขผู้สมัคร
function openCandidateModal() {
  document.getElementById('candidateModal').classList.remove('hidden');
  const form = document.getElementById('candidateForm');
  
  // Check if this is edit or add mode
  if (form.dataset.candidateId) {
    // Edit mode - change title and button
    document.querySelector('#candidateModal h3').textContent = 'Edit Candidate';
    document.querySelector('#candidateModal button[type="submit"]').textContent = 'Update Candidate';
  } else {
    // Add mode - reset
    document.querySelector('#candidateModal h3').textContent = 'Add Candidate';
    document.querySelector('#candidateModal button[type="submit"]').textContent = 'Save Candidate';
    form.reset();
  }
}

// EN: Close candidate modal
// TH: ปิดโมดัลผู้สมัคร
function closeCandidateModal() {
  document.getElementById('candidateModal').classList.add('hidden');
  document.getElementById('candidateForm').dataset.candidateId = ''; // Clear edit mode
  document.getElementById('candidateForm').reset();
}

// EN: Handle add candidate form submission
// TH: จัดการการส่งฟอร์มเพิ่มผู้สมัคร
async function handleAddCandidate(e) {
  e.preventDefault();

  const name = document.getElementById('candidateName').value;
  const bio = document.getElementById('candidateBio').value;
  const personalInfo = document.getElementById('candidateInfo').value;
  const form = document.getElementById('candidateForm');
  const candidateId = form.dataset.candidateId;

  try {
    let response;
    let result;

    if (candidateId) {
      // Edit mode - update existing candidate
      response = await fetch(`${API_URL}/api/admin/candidates/${candidateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          bio,
          personal_info: personalInfo
        })
      });
      result = await response.json();

      if (result.status === 'success') {
        showNotification(`✅ Candidate updated successfully`, 'success');
        closeCandidateModal();
        form.dataset.candidateId = ''; // Clear edit mode
        loadCandidates();
      } else {
        showNotification(`❌ ${result.message}`, 'error');
      }
    } else {
      // Add mode - create new candidate
      response = await fetch(`${API_URL}/api/admin/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          bio,
          personal_info: personalInfo,
          term_id: 1
        })
      });
      result = await response.json();

      if (result.status === 'success') {
        showNotification(`✅ ${result.message}`, 'success');
        closeCandidateModal();
        loadCandidates();
      } else {
        showNotification(`❌ ${result.message}`, 'error');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    showNotification('Error saving candidate', 'error');
  }
}

// EN: View all policies for a candidate
// TH: ดูนโยบายทั้งหมดของผู้สมัครคนหนึ่ง
async function viewCandidatePolicies(candidateId, candidateName) {
  selectedCandidateId = candidateId;

  try {
    const response = await fetch(`${API_URL}/api/admin/candidates/${candidateId}/policies`);
    const result = await response.json();

    if (result.status === 'success') {
      currentPolicies = result.data;
      renderPoliciesList(candidateId, candidateName);
    }
  } catch (error) {
    console.error('❌ Error loading policies:', error);
    showNotification('Error loading policies', 'error');
  }
}

// EN: Render policies list
// TH: วาดรายชื่อนโยบาย
function renderPoliciesList(candidateId, candidateName) {
  const container = document.getElementById('policiesList');
  container.innerHTML = '';

  if (currentPolicies.length === 0) {
    container.innerHTML = `
      <div class="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center text-gray-500">
        <p class="font-medium">No policies for ${candidateName} yet.</p>
        <p class="text-sm mt-2">Click "New Policy" to add one.</p>
      </div>
    `;
    return;
  }

  currentPolicies.forEach(policy => {
    const card = document.createElement('div');
    card.className = 'rounded-2xl bg-gradient-to-br from-mfuGold/10 to-mfuRed/10 border border-mfuGold/30 p-6 hover:shadow-lg transition';
    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <h4 class="text-lg font-bold text-mfuRed">${policy.policy_title}</h4>
        <div class="flex gap-2">
          <button onclick="editPolicy(${candidateId}, ${policy.policy_id}, '${policy.policy_title.replace(/'/g, "\\'")}', '${policy.policy_description.replace(/'/g, "\\'")}')"
            class="px-2 py-1 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600 transition">
            Edit
          </button>
          <button onclick="deletePolicy(${candidateId}, ${policy.policy_id})"
            class="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600 transition">
            Delete
          </button>
        </div>
      </div>
      <p class="text-gray-700 text-sm leading-relaxed">${policy.policy_description}</p>
      <p class="text-xs text-gray-400 mt-3">Added: ${new Date(policy.created_at).toLocaleDateString()}</p>
    `;
    container.appendChild(card);
  });
}

// EN: Open policy add modal
// TH: เปิดโมดัลเพิ่มนโยบาย
function openPolicyModal() {
  if (!selectedCandidateId) {
    showNotification('⚠️ Please select a candidate first', 'warning');
    return;
  }
  document.getElementById('policyModal').classList.remove('hidden');
  document.getElementById('policyForm').reset();
}

// EN: Close policy modal
// TH: ปิดโมดัลนโยบาย
function closePolicyModal() {
  document.getElementById('policyModal').classList.add('hidden');
}

// EN: Close view policy modal
// TH: ปิดโมดัลดูนโยบาย
function closeViewPolicyModal() {
  document.getElementById('viewPolicyModal').classList.add('hidden');
}

// EN: Handle add policy form submission
// TH: จัดการการส่งฟอร์มเพิ่มนโยบาย
async function handleAddPolicy(e) {
  e.preventDefault();

  if (!selectedCandidateId) {
    showNotification('❌ No candidate selected', 'error');
    return;
  }

  const title = document.getElementById('policyTitle').value;
  const description = document.getElementById('policyDescription').value;

  try {
    const response = await fetch(`${API_URL}/api/admin/candidates/${selectedCandidateId}/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policy_title: title,
        policy_description: description
      })
    });

    const result = await response.json();

    if (result.status === 'success') {
      showNotification('✅ Policy added successfully', 'success');
      closePolicyModal();
      viewCandidatePolicies(selectedCandidateId, 'Candidate');
    } else {
      showNotification(`❌ ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('❌ Error adding policy:', error);
    showNotification('Error adding policy', 'error');
  }
}

// EN: Edit policy
// TH: แก้ไขนโยบาย
async function editPolicy(candidateId, policyId, title, description) {
  const newTitle = prompt('Edit policy title:', title);
  if (!newTitle) return;

  const newDescription = prompt('Edit policy description:', description);
  if (!newDescription) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/candidates/${candidateId}/policies/${policyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policy_title: newTitle,
        policy_description: newDescription
      })
    });

    const result = await response.json();

    if (result.status === 'success') {
      showNotification('✅ Policy updated successfully', 'success');
      viewCandidatePolicies(candidateId, 'Candidate');
    } else {
      showNotification(`❌ ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('❌ Error updating policy:', error);
    showNotification('Error updating policy', 'error');
  }
}

// EN: Delete policy with confirmation
// TH: ลบนโยบายพร้อมการยืนยัน
async function deletePolicy(candidateId, policyId) {
  if (!confirm('Are you sure you want to delete this policy?')) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/candidates/${candidateId}/policies/${policyId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.status === 'success') {
      showNotification('✅ Policy deleted successfully', 'success');
      viewCandidatePolicies(candidateId, 'Candidate');
    } else {
      showNotification(`❌ ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('❌ Error deleting policy:', error);
    showNotification('Error deleting policy', 'error');
  }
}

// EN: Edit candidate information
// TH: แก้ไขข้อมูลผู้สมัคร
function editCandidate(candidateId) {
  const candidate = currentCandidates.find(c => c.candidate_id === candidateId);
  if (!candidate) return;

  document.getElementById('candidateName').value = candidate.name;
  document.getElementById('candidateBio').value = candidate.personal_info || '';
  document.getElementById('candidateInfo').value = candidate.personal_info || '';
  
  // Change modal title and form action for edit
  const form = document.getElementById('candidateForm');
  form.dataset.candidateId = candidateId;
  
  openCandidateModal();
}

// EN: Update candidate select dropdown
// TH: อัปเดตรายชื่อผู้สมัครในดรอปดาวน์
function updateCandidateSelect() {
  const select = document.getElementById('policyCandidateSelect');
  select.innerHTML = '<option value="">-- Choose a candidate --</option>';

  currentCandidates.forEach(candidate => {
    const option = document.createElement('option');
    option.value = candidate.candidate_id;
    option.textContent = `${candidate.name} (${candidate.candidate_id})`;
    select.appendChild(option);
  });
}

// EN: Show notification toast
// TH: แสดงการแจ้งเตือน
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed top-6 right-6 px-6 py-4 rounded-xl shadow-lg text-white font-bold z-50 animate-pulse ${
    type === 'success' ? 'bg-green-500' :
    type === 'error' ? 'bg-red-500' :
    type === 'warning' ? 'bg-yellow-500' :
    'bg-blue-500'
  }`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// EN: Close modals when clicking outside
// TH: ปิดโมดัลเมื่อคลิกนอก
document.addEventListener('click', (e) => {
  const candidateModal = document.getElementById('candidateModal');
  const policyModal = document.getElementById('policyModal');
  const viewPolicyModal = document.getElementById('viewPolicyModal');

  if (e.target === candidateModal) closeCandidateModal();
  if (e.target === policyModal) closePolicyModal();
  if (e.target === viewPolicyModal) closeViewPolicyModal();
});
