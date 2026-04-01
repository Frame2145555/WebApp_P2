// เมื่อโหลดหน้าเว็บเสร็จ ให้ดึงข้อมูลมาแสดงทันที
document.addEventListener('DOMContentLoaded', () => {
    loadTerms();
});

// ฟังก์ชัน: ดึงข้อมูล Term จาก API และวาดการ์ด
async function loadTerms() {
    try {
        const response = await fetch('http://localhost:3000/api/admin/terms');
        const result = await response.json();

        if (result.status === 'success') {
            renderTermCards(result.data);
        }
    } catch (error) {
        console.error('Error loading terms:', error);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลรอบการเลือกตั้งได้', 'error');
    }
}

// นำข้อมูล Array มาสร้างเป็นการ์ด HTML
function renderTermCards(terms) {
    const container = document.getElementById('terms-container');
    container.innerHTML = ''; // เคลียร์ของเก่าทิ้งก่อน (ถ้ามี)

    // ถ้ายังไม่มีข้อมูลเลย
    if (terms.length === 0) {
        container.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">ยังไม่มีข้อมูลรอบการเลือกตั้ง กรุณาเพิ่มข้อมูลใหม่</p>';
        return;
    }

    // วนลูปวาดการ์ดทีละใบ
    terms.forEach(term => {
        // เช็คว่าเปิดโหวตอยู่หรือปิดไปแล้ว (1 = OPEN, 0 = CLOSE)
        const isOpen = term.is_active === 1;
        
        // กำหนดสีของการ์ดตามสถานะ
        const statusClass = isOpen ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50';
        const statusText = isOpen ? 'OPEN' : 'CLOSE';
        const borderClass = isOpen ? 'border-t-green-500' : 'border-t-red-500 opacity-75 hover:opacity-100';

        const cardHtml = `
            <a href="/AdminNew/views/Dashboard.html?term_id=${term.term_id}"
                class="card bg-white shadow-sm border border-gray-100 border-t-4 ${borderClass} rounded-lg hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer block">
                <div class="card-body items-center text-center p-8">
                    <h2 class="card-title text-4xl font-bold text-gray-800">${term.name}</h2>
                    <p class="text-gray-400 text-sm mt-2">${term.description || 'คลิกเพื่อดูสถิติและจัดการ'}</p>
                    <div class="mt-4">
                        <span class="font-bold px-4 py-1 rounded-full text-sm ${statusClass}">${statusText}</span>
                    </div>
                </div>
            </a>
        `;
        container.innerHTML += cardHtml;
    });
}

// ระบบ: กดปุ่มเพิ่มรอบการเลือกตั้งใหม่ (Add Term)
const btnSubmitTerm = document.getElementById('btn-submit-term');

if (btnSubmitTerm) {
    btnSubmitTerm.addEventListener('click', async () => {
        const nameInput = document.getElementById('input-term-name');
        const descInput = document.getElementById('input-term-desc');

        const name = nameInput.value.trim();
        const description = descInput.value.trim();

        // 1. เช็คว่ากรอกชื่อเทอมหรือยัง
        if (!name) {
            Swal.fire({
                title: 'แจ้งเตือน',
                text: 'กรุณากรอกชื่อรอบการเลือกตั้ง (เช่น 1/2569)',
                icon: 'warning',
                scrollbarPadding: false,
                customClass: { confirmButton: 'btn btn-warning text-white' }
            });
            return;
        }

        // 2. ถ้ายิง API สำเร็จ
        try {
            const response = await fetch('http://localhost:3000/api/admin/create-term', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, description: description })
            });

            const result = await response.json();

            if (result.status === 'success') {
                // ปิด Modal
                const modal = document.getElementById('add_term_modal');
                if (modal) modal.close();

                // ล้างช่องกรอกข้อมูล
                document.getElementById('addTermForm').reset();

                // สั่งให้โหลดการ์ดใหม่
                loadTerms();

                // โชว์แจ้งเตือนสำเร็จ (หน่วงเวลาหลบ Modal เหมือนเดิม)
                setTimeout(() => {
                    Swal.fire({
                        title: 'สำเร็จ!',
                        text: result.message,
                        icon: 'success',
                        scrollbarPadding: false,
                        confirmButtonText: 'ตกลง',
                        customClass: { confirmButton: 'btn bg-mfu-red text-white hover:bg-red-900 border-none' }
                    });
                }, 150);
            } else {
                Swal.fire('ไม่สามารถเพิ่มได้', result.message, 'error');
            }
        } catch (error) {
            console.error('Create Term Error:', error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    });
}