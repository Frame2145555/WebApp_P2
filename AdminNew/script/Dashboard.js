// ==========================================
// 1. ดึงค่า term_id จาก URL 
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const currentTermId = urlParams.get('term_id');

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
        const response = await fetch(`http://localhost:3000/api/admin/term/${currentTermId}`);
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
            title: isTurningOn ? 'ยืนยันการเปิดระบบโหวต?' : 'ยืนยันการปิดระบบโหวต?',
            text: isTurningOn ? "เทอมอื่นๆ ที่เปิดอยู่จะถูกปิดอัตโนมัติ" : "ผู้ใช้งานจะไม่สามารถลงคะแนนได้อีก",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: isTurningOn ? '#22c55e' : '#ef4444', // สีเขียวตอนเปิด สีแดงตอนปิด
            cancelButtonColor: '#9ca3af',
            confirmButtonText: isTurningOn ? 'ใช่, เปิดโหวตเลย!' : 'ใช่, ปิดโหวตเลย!',
            cancelButtonText: 'ยกเลิก'
        });

        // ถ้ากดยกเลิก ให้ดันสวิตช์กลับไปที่เดิม
        if (!confirmResult.isConfirmed) {
            e.target.checked = !isTurningOn; 
            return;
        }

        // ถ้ากดยืนยัน ยิง API ไปอัปเดต Database
        try {
            const response = await fetch(`http://localhost:3000/api/admin/term/${currentTermId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            const result = await response.json();

            if (result.status === 'success') {
                Swal.fire({
                    title: 'สำเร็จ!',
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
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถอัปเดตสถานะได้', 'error');
            e.target.checked = !isTurningOn; // ดันสวิตช์กลับไปที่เดิมถ้า Error
        }
    });
}

(() => {
    document.addEventListener('DOMContentLoaded', () => {
        initDashboardChart();
        initVotingToggle();
        loadTermStatus();
    });

    // กราฟสรุปคะแนนบน Dashboard
    function initDashboardChart() {
        const canvas = document.getElementById('scoreChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
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
                } else {
                    this.checked = !isEnabled;
                }
            });
        });
    }
})();