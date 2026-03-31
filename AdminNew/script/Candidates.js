// สมมติว่าดึง term_id มาจาก URL (เช่น ?term_id=1) หรือ LocalStorage
// ตอนนี้ตั้งค่าจำลองเป็น 1 ไปก่อน
const currentTermId = new URLSearchParams(window.location.search).get('term_id') || 1; 

// ฟังก์ชันหลักสำหรับดึงข้อมูลและแสดงผล
async function loadCandidates(searchQuery = '') {
    try {
        // ยิง API ไปที่หลังบ้านของคุณ (เปลี่ยน URL ให้ตรงกับพอร์ตของคุณด้วยนะ)
        const response = await fetch(`http://localhost:3000/api/candidates?term_id=${currentTermId}&search=${searchQuery}`);
        const result = await response.json();

        if (result.status === 'success') {
            const candidates = result.data;
            renderLiveResults(candidates);
            renderTable(candidates);
        } else {
            Swal.fire('Error', 'ไม่สามารถดึงข้อมูลได้', 'error');
        }
    } catch (error) {
        console.error("Fetch Candidates Error:", error);
    }
}

// 📊 ฟังก์ชันวาดกราฟแท่ง (Live Results)
function renderLiveResults(candidates) {
    const container = document.querySelector('.flex-col.gap-5'); // หา div ที่ครอบกราฟ
    container.innerHTML = ''; // ล้างของเก่าทิ้ง

    // หาคะแนนสูงสุด เพื่อเอามาคำนวณ % ความยาวของแถบสีแดง (ถ้าไม่มีใครได้คะแนนเลย ให้เต็มที่ 1)
    const maxScore = candidates.length > 0 ? Math.max(...candidates.map(c => c.score)) : 1;
    const safeMaxScore = maxScore === 0 ? 1 : maxScore;

    candidates.forEach(cand => {
        // คำนวณความยาว % ของแท่งกราฟ
        const widthPercent = (cand.score / safeMaxScore) * 100;

        const barHtml = `
            <div class="flex items-center gap-4">
                <div class="w-24 font-bold text-gray-700">${cand.candidate_id}</div>
                <div class="flex-1 bg-gray-100 rounded-sm h-6 overflow-hidden">
                    <div class="bg-mfu-red h-full transition-all duration-500" style="width: ${widthPercent}%"></div>
                </div>
                <div class="w-12 text-right font-bold text-gray-600">${cand.score}</div>
            </div>
        `;
        container.innerHTML += barHtml;
    });
}

// 📋 ฟังก์ชันวาดตาราง Candidate Management
function renderTable(candidates) {
    const tbody = document.querySelector('tbody');
    tbody.innerHTML = ''; // ล้างตารางเก่า

    candidates.forEach(cand => {
        // เช็ค Status เพื่อตกแต่งป้ายสี
        const statusBadge = cand.status_enable === 1 
            ? `<span class="badge badge-success badge-sm text-white font-bold">enabled</span>` 
            : `<span class="badge badge-error badge-sm text-white font-bold">disabled</span>`;
        
        const actionBtn = cand.status_enable === 1
            ? `<button class="btn btn-xs btn-error btn-outline" onclick="toggleStatus('${cand.candidate_id}', 0)">Disable</button>`
            : `<button class="btn btn-xs btn-success btn-outline" onclick="toggleStatus('${cand.candidate_id}', 1)">Enable</button>`;

        const rowHtml = `
            <tr class="hover:bg-gray-50">
                <td class="font-bold text-gray-700">${cand.candidate_id}</td>
                <td>${cand.name}</td>
                <td class="text-center">
                    <button class="btn btn-xs btn-outline border-gray-300 text-gray-600" onclick="showPolicies('${cand.policies}')">Read</button>
                </td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center">${actionBtn}</td>
            </tr>
        `;
        tbody.innerHTML += rowHtml;
    });
}

// 🔍 ระบบค้นหา (Search)
const searchInput = document.querySelector('input[placeholder="Search ID or Name"]');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim();
        loadCandidates(keyword); // พอพิมพ์ปุ๊บ สั่งโหลดใหม่พร้อมคำค้นหาเลย (Real-time search)
    });
}

// 📖 ฟังก์ชันกดดูนโยบาย (ใช้ SweetAlert2 ที่เพื่อนคุณโหลดมาให้)
function showPolicies(policyText) {
    Swal.fire({
        title: 'นโยบายผู้สมัคร',
        text: policyText,
        icon: 'info',
        confirmButtonColor: '#8C1515' // สีแดง MFU
    });
}

// 🚀 โหลดข้อมูลครั้งแรกเมื่อเปิดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
    loadCandidates();
});