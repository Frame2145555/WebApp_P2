let currentTermId = null; // สร้างตัวแปรไว้ให้ฟังก์ชันอื่นดึงไปใช้ได้
const API_ORIGIN = window.location.port === '3000' ? '' : `${window.location.protocol}//${window.location.hostname}:3000`;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentTermId = urlParams.get('term_id');

    // ถ้าไม่มี term_id ให้เตะกลับหน้า Term
    if (!currentTermId) {
        window.location.href = '/AdminNew/views/Term.html';
        return; // หยุดการทำงานทันที
    }

    // อัปเดตลิงก์ใน Sidebar ให้ห้อย term_id ไปด้วย (รอจน HTML โหลดเสร็จแล้วถึงทำ)
    const sidebarLinks = document.querySelectorAll('aside ul li a');
    sidebarLinks.forEach(link => {
        const originalHref = link.getAttribute('href');

        // กรองลิงก์ที่ไม่ต้องใส่ term_id ออก (เช่น # หรือหน้า Term)
        if (originalHref && originalHref !== '#' && !originalHref.includes('Term.html')) {
            // ดักไว้เผื่อลิงก์มันมี ?term_id อยู่แล้ว จะได้ไม่เบิ้ลซ้ำ
            if (!originalHref.includes('?term_id=')) {
                link.href = `${originalHref}?term_id=${currentTermId}`;
            }
        }
    });
    loadCandidates();
});

// ฟังก์ชัน: ก๊อปปี้ term_id ปัจจุบัน แล้วส่งไปหน้าใหม่
function goToPage(pageName) {
    // ก๊อปปี้ term_id จาก URL ด้านบนของหน้าปัจจุบัน
    const urlParams = new URLSearchParams(window.location.search);
    const currentTermId = urlParams.get('term_id');

    // เช็คว่าก๊อปปี้มาได้ไหม
    if (currentTermId) {
        // ถ้ามี: สั่งวาร์ปไปหน้าใหม่ พร้อมแปะ ?term_id=... ห้อยท้ายไปด้วย!
        window.location.href = `/AdminNew/views/${pageName}?term_id=${currentTermId}`;
    } else {
        // ถ้าไม่มี (แอดมินหลงทาง): เตะกลับหน้า Term
        window.location.href = '/AdminNew/views/Term.html';
    }
}

// ฟังก์ชันหลักสำหรับดึงข้อมูลจาก API
async function loadCandidates(searchQuery = '') {
    try {
        // ยิงไปที่ API หลังบ้านของเรา พร้อมส่ง term_id และ search keyword ไปด้วย
        const response = await fetch(`${API_ORIGIN}/api/admin/candidates?term_id=${currentTermId}`);
        const result = await response.json();

        if (result.status === 'success') {
            const candidates = result.data;
            renderLiveResults(candidates); // วาดกราฟแท่ง
            renderTable(candidates);       // วาดตาราง
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

// วาดกราฟแท่ง (Live Results)
function renderLiveResults(candidates) {
    const container = document.querySelector('.flex-col.gap-5');
    container.innerHTML = ''; // ล้างของเก่า

    // นำผู้สมัครมาเรียงคะแนนจากมากไปน้อย แล้วตัดเอาแค่ 5 อันดับแรก
    const top5Candidates = [...candidates]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    // หาคนที่คะแนนเยอะสุด (ใน 5 คนนี้) เพื่อเทียบสัดส่วน 100% ของความยาวกราฟ
    const maxScore = top5Candidates.length > 0 ? Math.max(...top5Candidates.map(c => c.score)) : 1;
    const safeMaxScore = maxScore === 0 ? 1 : maxScore;

    // ใช้ข้อมูล 5 อันดับแรกในการวนลูปวาดกราฟ
    top5Candidates.forEach(cand => {
        const widthPercent = (cand.score / safeMaxScore) * 100;
        const barHtml = `
        <div class="flex items-center gap-4">
        <div class="w-24 font-bold text-gray-700">${cand.display_id}</div> 
        <div class="flex-1 bg-gray-100 rounded-sm h-6 overflow-hidden">
            <div class="bg-mfu-red h-full transition-all duration-500" style="width: ${widthPercent}%"></div>
        </div>
        <div class="w-12 text-right font-bold text-gray-600">${cand.score}</div>
    </div>
`;
        container.innerHTML += barHtml;
    });
}

// วาดตาราง Candidate Management
function renderTable(candidates) {
    const tbody = document.querySelector('tbody');
    tbody.innerHTML = ''; 

    candidates.forEach(cand => {
        const statusBadge = cand.status_enable === 1 
            ? `<span class="badge badge-success badge-sm text-white font-bold">enabled</span>` 
            : `<span class="badge badge-error badge-sm text-white font-bold">disabled</span>`;

        const nextStatus = cand.status_enable === 1 ? 0 : 1;

        const encodedPolicies = encodeURIComponent(cand.policies || 'ยังไม่มีนโยบาย');

        const rowHtml = `
            <tr class="hover:bg-gray-50">
                <td class="font-bold text-gray-700">${cand.display_id}</td>
                <td>${cand.name}</td>
                <td class="text-center font-bold" style="color: #5c0f0f;">${cand.score || 0}</td>
                <td class="text-center">
                    <button class="btn btn-xs btn-outline border-gray-300 text-gray-600" onclick="showPolicies(decodeURIComponent('${encodedPolicies}'))">Read</button>
                </td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center">
                    <div class="flex justify-center gap-2">
                        <button class="btn btn-xs btn-outline ${cand.status_enable === 1 ? 'btn-error' : 'btn-success'} w-16" 
                                onclick="toggleStatus('${cand.internal_id}', '${cand.display_id}', ${nextStatus})">
                            ${cand.status_enable === 1 ? 'Disable' : 'Enable'}
                        </button>
                        <button class="btn btn-xs btn-error text-white w-16" 
                                onclick="deleteCandidate('${cand.internal_id}', '${cand.display_id}')">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.innerHTML += rowHtml;
    });
}

// ทำให้ช่อง Search
const searchInput = document.querySelector('input[placeholder="Search ID or Name"]');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim();
        loadCandidates(keyword); // ส่งคำที่พิมพ์ไปดึง API ใหม่ทันที
    });
}

// ฟังก์ชัน เปิด/ปิด สถานะ candidate
async function toggleStatus(internalId, displayId, newStatus) {
    // 1. FRONTEND VALIDATION (ดักจับก่อนทำงานจริง) - ใช้ internalId เช็ค
    if (!internalId) {
        Swal.fire('Error', 'Candidate ID not found. Unable to change status.', 'error');
        return;
    }
    if (newStatus !== 0 && newStatus !== 1) {
        Swal.fire('Error', 'Invalid status value (must be 0 or 1).', 'error');
        return;
    }

    const actionText = newStatus === 1 ? 'Enable' : 'Disable';

    const confirm = await Swal.fire({
        title: `Confirm ${actionText}?`,
        // โชว์รหัส CAND-XXX (displayId) ให้แอดมินดู
        text: `Do you want to ${actionText.toLowerCase()} candidate ${displayId}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, proceed!',
        cancelButtonText: 'Cancel',
        buttonsStyling: false,
        scrollbarPadding: false,
        customClass: {
            confirmButton: `btn ${newStatus === 1 ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white mx-2 border-none`,
            cancelButton: 'btn btn-outline mx-2'
        }
    });

    if (confirm.isConfirmed) {
        try {
            const response = await fetch(`${API_ORIGIN}/api/admin/toggle-candidate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // ไฮไลท์: ส่งตัวเลขจริงๆ (internalId) ไปให้ Database ทำงาน
                    candidate_id: internalId,
                    status: newStatus
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                Swal.fire({
                    title: 'Success!',
                    text: result.message,
                    icon: 'success',
                    buttonsStyling: false,
                    scrollbarPadding: false,
                    customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
                });
                loadCandidates(); // รีเฟรชตาราง
            } else {
                Swal.fire({
                    title: 'Notice',
                    text: result.message,
                    icon: 'warning',
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn btn-warning mx-2' }
                });
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Unable to connect to the server.', 'error');
        }
    }
}

// ฟังก์ชัน เพิ่มผู้สมัครใหม่ (Add Candidate)
// 1. จับตัวปุ่ม Add และ ช่องกรอกข้อมูลทั้ง 2 ช่อง
const addCandidateBtn = document.getElementById('addCandidateBtn');
const candidateInputs = document.querySelectorAll('#addCandidateForm input');

if (addCandidateBtn) {
    addCandidateBtn.addEventListener('click', async () => {
        // ใช้ querySelector จับ input ตัวแรกและตัวเดียวในฟอร์มได้เลย
        const nameInput = document.querySelector('#addCandidateForm input');
        const name = nameInput.value.trim();

        // เช็คว่าพิมพ์ชื่อหรือยัง?
        if (!name) {
            Swal.fire({
                title: 'Notice',
                text: 'Please enter the candidate name.',
                icon: 'warning',
                confirmButtonText: 'OK',
                customClass: { confirmButton: 'btn btn-warning text-white' }
            });
            return;
        }

        try {
            // ยิง API ส่งข้อมูลไปให้หลังบ้าน (ไม่ส่ง candidate_id แล้ว)
            const response = await fetch(`${API_ORIGIN}/api/admin/create-candidate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    term_id: currentTermId
                })
            });

            const result = await response.json();

            if (result.status === 'success') {

                // สั่งปิดหน้าต่าง Modal 
                const modal = document.getElementById('add_candidate_modal');
                if (modal) {
                    modal.close();
                }

                // ล้างข้อมูลฟอร์ม
                document.getElementById('addCandidateForm').reset();

                // รีเฟรชตารางและกราฟ
                loadCandidates();

                setTimeout(() => {
                    Swal.fire({
                        title: 'Candidate added successfully!',
                        text: result.message, // ข้อความนี้จะบอกรหัสที่ Backend สร้างให้ (เช่น CAND-001)
                        icon: 'success',
                        scrollbarPadding: false,
                        confirmButtonText: 'OK',
                        customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
                    });
                }, 150);

            } else {
                Swal.fire({
                    title: 'Unable to add candidate',
                    text: result.message,
                    icon: 'error',
                    confirmButtonText: 'Try again',
                    customClass: { confirmButton: 'btn btn-error text-white' }
                });
            }
        } catch (error) {
            console.error('Add Candidate Error:', error);
            Swal.fire('Error', 'Unable to connect to the server.', 'error');
        }
    });
}

// ฟังก์ชัน ลบผู้สมัคร (Delete Candidate)
async function deleteCandidate(internalId, displayId) {
    // ใช้ internalId ในการตรวจสอบความถูกต้องเบื้องต้น
    if (!internalId) {
        Swal.fire('Error', 'Candidate ID to delete was not found.', 'error');
        return;
    }

    const confirm = await Swal.fire({
        title: 'Confirm deletion?',
        // โชว์ CAND-XXX (displayId) ให้แอดมินมั่นใจ
        text: `Are you sure you want to delete candidate ${displayId}? This action cannot be undone.`,
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

    if (confirm.isConfirmed) {
        try {
            // ใช้ internalId (ตัวเลข) ต่อท้าย URL เพื่อสั่งลบที่หลังบ้าน
            const response = await fetch(`${API_ORIGIN}/api/admin/candidate/${internalId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.status === 'success') {
                Swal.fire({
                    title: 'Deleted successfully!',
                    text: result.message,
                    icon: 'success',
                    scrollbarPadding: false,
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
                });
                loadCandidates();
            } else {
                Swal.fire({
                    title: 'Unable to delete candidate',
                    text: result.message,
                    icon: 'warning',
                    scrollbarPadding: false,
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn btn-warning mx-2' }
                });
            }
        } catch (error) {
            console.error('Delete Error:', error);
            Swal.fire('Error', 'Unable to connect to the server.', 'error');
        }
    }
}