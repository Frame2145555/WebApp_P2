let currentTermId = null; // สร้างตัวแปรไว้ให้ฟังก์ชันอื่นดึงไปใช้ได้

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentTermId = urlParams.get('term_id');

    // ถ้าไม่มี term_id ให้เตะกลับหน้า Term
    if (!currentTermId) {
        window.location.href = '/AdminNew/views/Term.html';
        return; // หยุดการทำงานทันที
    }

    // 🚨 อัปเดตลิงก์ใน Sidebar ให้ห้อย term_id ไปด้วย (รอจน HTML โหลดเสร็จแล้วถึงทำ)
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

// ฟังก์ชันหลักสำหรับดึงข้อมูลจาก API
async function loadCandidates(searchQuery = '') {
    try {
        // ยิงไปที่ API หลังบ้านของเรา พร้อมส่ง term_id และ search keyword ไปด้วย
        const response = await fetch(`http://localhost:3000/api/admin/candidates?term_id=${currentTermId}`);
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

    // หาคนที่คะแนนเยอะสุด เพื่อเทียบสัดส่วน 100% ของความยาวกราฟ
    const maxScore = candidates.length > 0 ? Math.max(...candidates.map(c => c.score)) : 1;
    const safeMaxScore = maxScore === 0 ? 1 : maxScore;

    candidates.forEach(cand => {
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

// วาดตาราง Candidate Management
function renderTable(candidates) {
    const tbody = document.querySelector('tbody');
    tbody.innerHTML = ''; 

    candidates.forEach(cand => {
        const statusBadge = cand.status_enable === 1 
            ? `<span class="badge badge-success badge-sm text-white font-bold">enabled</span>` 
            : `<span class="badge badge-error badge-sm text-white font-bold">disabled</span>`;

        // สลับค่าที่จะส่งไป API: ถ้าปัจจุบันเปิด(1) ให้ส่งคำสั่งปิด(0)
        const nextStatus = cand.status_enable === 1 ? 0 : 1;

        const rowHtml = `
            <tr class="hover:bg-gray-50">
                <td class="font-bold text-gray-700">${cand.candidate_id}</td>
                <td>${cand.name}</td>
                <td class="text-center">
                    <button class="btn btn-xs btn-outline border-gray-300 text-gray-600" onclick="showPolicies('${cand.policies}')">Read</button>
                </td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center">
                    <div class="flex justify-center gap-2">
                        <button class="btn btn-xs btn-outline ${cand.status_enable === 1 ? 'btn-error' : 'btn-success'} w-16" 
                                onclick="toggleStatus('${cand.candidate_id}', ${nextStatus})">
                            ${cand.status_enable === 1 ? 'Disable' : 'Enable'}
                        </button>
                        <button class="btn btn-xs btn-error text-white w-16" 
                                onclick="deleteCandidate('${cand.candidate_id}')">
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
async function toggleStatus(candidateId, newStatus) {
    const actionText = newStatus === 1 ? 'เปิดใช้งาน (Enable)' : 'ระงับการใช้งาน (Disable)';

    const confirm = await Swal.fire({
        title: `ยืนยันการ${actionText}?`,
        text: `คุณต้องการ${actionText} ผู้สมัครรหัส ${candidateId} ใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ใช่, ดำเนินการเลย!',
        cancelButtonText: 'ยกเลิก',
        buttonsStyling: false, 
        
        // เพิ่มบรรทัดนี้เข้าไปครับ! สั่งไม่ให้มันหดจอ
        scrollbarPadding: false, 

        customClass: {
            confirmButton: `btn ${newStatus === 1 ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white mx-2 border-none`,
            cancelButton: 'btn btn-outline mx-2'
        }
    });

    // ถ้ายืนยัน ให้ยิง API ไปหลังบ้าน
    if (confirm.isConfirmed) {
        try {
            const response = await fetch('http://localhost:3000/api/admin/toggle-candidate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    candidate_id: candidateId, 
                    status: newStatus 
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                Swal.fire({
                    title: 'สำเร็จ!',
                    text: result.message,
                    icon: 'success',
                    buttonsStyling: false,
                    scrollbarPadding: false, // ใส่ตรงนี้ด้วย
                    customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
                });
                loadCandidates(); // รีเฟรชตาราง
            } else {
                Swal.fire({
                    title: 'แจ้งเตือน',
                    text: result.message,
                    icon: 'warning',
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn btn-warning mx-2' }
                });
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    }
}

// ฟังก์ชัน เพิ่มผู้สมัครใหม่ (Add Candidate)
// 1. จับตัวปุ่ม Add และ ช่องกรอกข้อมูลทั้ง 2 ช่อง
const addCandidateBtn = document.querySelector('#addCandidateForm button.bg-mfu-red');
const candidateInputs = document.querySelectorAll('#addCandidateForm input');

if (addCandidateBtn) {
    addCandidateBtn.addEventListener('click', async () => {
        // 2. ดึงค่าที่แอดมินพิมพ์ออกมา
        const candidate_id = candidateInputs[0].value.trim(); // ช่องแรก: Candidate ID
        const name = candidateInputs[1].value.trim();         // ช่องสอง: ชื่อ

        // เช็คว่าพิมพ์ครบไหม (ถ้าไม่ครบ เด้งด่าเบาๆ)
        if (!candidate_id || !name) {
            Swal.fire({
                title: 'แจ้งเตือน',
                text: 'กรุณากรอกรหัสและชื่อผู้สมัครให้ครบถ้วน',
                icon: 'warning',
                confirmButtonText: 'ตกลง',
                customClass: { confirmButton: 'btn btn-warning text-white' }
            });
            return;
        }

        try {
            // ยิง API ส่งข้อมูลไปให้หลังบ้าน
            const response = await fetch('http://localhost:3000/api/admin/create-candidate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    candidate_id: candidate_id, 
                    name: name,
                    term_id: currentTermId // 🚨 เพิ่มบรรทัดนี้! ส่ง term_id รอดพ้นไม้กวาดฟาดแน่นอน!
                })
            });

            const result = await response.json();

            // ถ้ายิงผ่าน
            if (result.status === 'success') {
                
                // สั่งปิดหน้าต่าง Modal ด้วยคำสั่งดั้งเดิมของ HTML5
                const modal = document.getElementById('add_candidate_modal');
                if (modal) {
                    modal.close(); 
                }
                
                // ล้างข้อมูลฟอร์ม
                document.getElementById('addCandidateForm').reset();
                
                // รีเฟรชตารางและกราฟ
                loadCandidates(); 

                // ท่าไม้ตายใหม่: หน่วงเวลา 0.1 วินาที ให้ Modal ปิดสนิทก่อน ค่อยโชว์ SweetAlert (หลบหลีกปัญหา Top Layer)
                setTimeout(() => {
                    Swal.fire({
                        title: 'เพิ่มผู้สมัครสำเร็จ!',
                        text: result.message,
                        icon: 'success',
                        scrollbarPadding: false,
                        confirmButtonText: 'ตกลง',
                        customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
                    });
                }, 150); // 150 มิลลิวินาที
                
            } else {
                // ถ้า API ตอบกลับมาว่ามี Error (เช่น ID ซ้ำ)
                Swal.fire({
                    title: 'ไม่สามารถเพิ่มได้',
                    text: result.message,
                    icon: 'error',
                    confirmButtonText: 'ลองใหม่',
                    customClass: { confirmButton: 'btn btn-error text-white' }
                });
            }
        } catch (error) {
            console.error('Add Candidate Error:', error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
        }
    });
}

// ==========================================
// ฟังก์ชัน ลบผู้สมัคร (Delete Candidate)
// ==========================================
async function deleteCandidate(candidateId) {
    // 1. เด้งถามให้ชัวร์ก่อนลบ (ปุ่มสีแดงขู่ไว้ก่อน)
    const confirm = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `คุณแน่ใจหรือไม่ว่าต้องการลบผู้สมัครรหัส ${candidateId}? (ข้อมูลจะหายไปถาวร!)`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonText: 'ลบเลย!',
        cancelButtonText: 'ยกเลิก',
        buttonsStyling: false,
        scrollbarPadding: false,
        customClass: {
            confirmButton: 'btn bg-red-600 hover:bg-red-700 text-white mx-2 border-none',
            cancelButton: 'btn btn-outline mx-2'
        }
    });

    // 2. ถ้ากดยืนยัน ก็ยิง API ลบเลย
    if (confirm.isConfirmed) {
        try {
            const response = await fetch(`http://localhost:3000/api/admin/candidate/${candidateId}`, {
                method: 'DELETE' // 🚨 เรียกใช้ Method DELETE ที่เราเพิ่งสร้าง
            });

            const result = await response.json();

            if (result.status === 'success') {
                Swal.fire({
                    title: 'ลบสำเร็จ!',
                    text: result.message,
                    icon: 'success',
                    scrollbarPadding: false,
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
                });
                
                // รีเฟรชตารางให้ข้อมูลหายไปทันที
                loadCandidates(); 
            } else {
                Swal.fire({
                    title: 'ไม่สามารถลบได้',
                    text: result.message,
                    icon: 'warning',
                    scrollbarPadding: false,
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn btn-warning mx-2' }
                });
            }
        } catch (error) {
            console.error('Delete Error:', error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    }
}


