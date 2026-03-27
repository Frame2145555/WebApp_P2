document.addEventListener('DOMContentLoaded', () => {
    initChart();
    initEventListeners();
    // Add default row
    addCandidateToTable('CAND-001', 'Enabled');
});

// --- 1. การจัดการกราฟ ---
let scoreChart;
function initChart() {
    const ctx = document.getElementById('scoreChart').getContext('2d');
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

// --- 2. การจัดการเหตุการณ์ (Event Listeners) ---
function initEventListeners() {
    // เปิด-ปิดระบบโหวต
    document.getElementById('votingToggle').addEventListener('change', function() {
        const isEnabled = this.checked;
        const text = document.getElementById('statusText');
        
        Swal.fire({
            title: isEnabled ? 'เปิดระบบโหวต?' : 'ปิดระบบโหวต?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#8C1515',
            confirmButtonText: 'ตกลง'
        }).then((result) => {
            if (result.isConfirmed) {
                text.innerText = isEnabled ? 'ระบบกำลังเปิดรับการโหวต' : 'ระบบปิดการรับโหวตแล้ว';
                text.className = isEnabled ? 'text-green-600' : 'text-red-600';
            } else {
                this.checked = !isEnabled;
            }
        });
    });

    // เพิ่ม Candidate
    document.getElementById('addCandBtn').addEventListener('click', () => {
        const input = document.getElementById('candIdInput');
        if (input.value.trim() === "") return Swal.fire('Error', 'กรุณากรอก ID', 'error');
        
        addCandidateToTable(input.value, 'Enabled');
        input.value = "";
        Swal.fire('Success', 'เพิ่มข้อมูลเรียบร้อยแล้ว', 'success');
    });

    // ค้นหาในตาราง
    document.getElementById('searchBox').addEventListener('keyup', function() {
        const filter = this.value.toUpperCase();
        const rows = document.querySelector("#candidateTable tbody").rows;
        
        Array.from(rows).forEach(row => {
            const id = row.cells[0].textContent;
            row.style.display = id.toUpperCase().indexOf(filter) > -1 ? "" : "none";
        });
    });
}

// --- 3. ฟังก์ชันเสริม (Helper Functions) ---
function addCandidateToTable(id, status) {
    const tbody = document.querySelector("#candidateTable tbody");
    const row = tbody.insertRow();
    
    row.innerHTML = `
        <td class="px-6 py-4 font-medium text-gray-800">${id}</td>
        <td class="px-6 py-4">
            <span class="status-badge px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                ${status}
            </span>
        </td>
        <td class="px-6 py-4 text-center">
            <button onclick="toggleStatus(this)" class="text-red-600 hover:underline text-sm font-medium">Disable</button>
        </td>
    `;
}

function toggleStatus(btn) {
    const row = btn.closest('tr');
    const badge = row.querySelector('.status-badge');
    const isEnabled = badge.innerText === 'Enabled';

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
}

document.addEventListener('DOMContentLoaded', () => {
    // ... โค้ดเดิมที่มีอยู่ ...
    initTabNavigation();
});

// ปรับปรุงฟังก์ชันการสลับหน้าใน script.js
function initTabNavigation() {
    const menus = [
        { btn: 'menu-dashboard', sec: 'section-dashboard' },
        { btn: 'menu-voter', sec: 'section-voter' },
        { btn: 'menu-candidate', sec: 'section-candidate' }
    ];

    menus.forEach(item => {
        const btnElement = document.getElementById(item.btn);
        if (btnElement) {
            btnElement.addEventListener('click', (e) => {
                e.preventDefault();
                updateActiveTab(item, menus);
            });
        }
    });
}

function updateActiveTab(activeItem, allItems) {
    allItems.forEach(item => {
        const btn = document.getElementById(item.btn);
        const sec = document.getElementById(item.sec);

        if (btn && sec) { // ตรวจสอบว่า btn และ sec ไม่ใช่ null
            if (item.btn === activeItem.btn) {
                // หน้าที่เลือก: แสดงผลและไฮไลท์เมนู
                btn.classList.add('active');
                sec.classList.remove('hidden-section');
                sec.classList.add('active-section');
            } else {
                // หน้าอื่น: ซ่อนทิ้งทั้งหมด ไม่ให้เหลือพื้นที่ว่าง
                btn.classList.remove('active');
                sec.classList.remove('active-section');
                sec.classList.add('hidden-section');
            }
        } else {
            console.warn(`Element with id '${item.btn}' or '${item.sec}' not found.`);
        }
    });
}

// --- ฟังก์ชันจัดการ Voter (ตรงกับข้อ 6, 7 ในรูป) ---
function addVoterPrompt() {
    Swal.fire({
        title: 'เพิ่มรายชื่อผู้มีสิทธิ์โหวต',
        html: `
            <input id="swal-id" class="swal2-input" placeholder="เลขบัตรประชาชน">
            <input id="swal-name" class="swal2-input" placeholder="ชื่อ-นามสกุล">
        `,
        focusConfirm: false,
        preConfirm: () => {
            return [
                document.getElementById('swal-id').value,
                document.getElementById('swal-name').value
            ]
        }
    }).then((result) => {
        if (result.value) {
            const [id, name] = result.value;
            const tbody = document.getElementById('voterTableBody');
            const row = tbody.insertRow();
            row.innerHTML = `
                <td class="px-6 py-4">${id}</td>
                <td class="px-6 py-4">${name}</td>
                <td class="px-6 py-4 text-center"><span class="text-xs text-orange-500">Not Voted</span></td>
                <td class="px-6 py-4 text-center"><span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Enabled</span></td>
                <td class="px-6 py-4 text-center"><button onclick="toggleVoterStatus(this)" class="text-red-600 text-sm font-medium hover:underline">Disable</button></td>
            `;
        }
    });
}

function toggleVoterStatus(btn) {
    const statusSpan = btn.closest('tr').cells[3].querySelector('span');
    const isEnabled = statusSpan.innerText === 'Enabled';

    if (isEnabled) {
        statusSpan.innerText = 'Disabled';
        statusSpan.className = 'px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold';
        btn.innerText = 'Enable';
        btn.className = 'text-green-600 text-sm font-medium hover:underline';
    } else {
        statusSpan.innerText = 'Enabled';
        statusSpan.className = 'px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold';
        btn.innerText = 'Disable';
        btn.className = 'text-red-600 text-sm font-medium hover:underline';
    }
}

// --- ฟังก์ชันสำหรับจัดการ Candidate Management ---
function initCandidateManagement() {
    const candidateButton = document.getElementById('menu-candidate');
    const sections = document.querySelectorAll('main > div'); // เลือกทุก section ใน main

    if (candidateButton) {
        candidateButton.addEventListener('click', (e) => {
            e.preventDefault();

            sections.forEach(section => {
                if (section.id === 'section-candidate') {
                    section.classList.remove('hidden-section');
                    section.classList.add('active-section');
                } else {
                    section.classList.remove('active-section');
                    section.classList.add('hidden-section');
                }
            });
        });
    }
}

// --- ฟังก์ชันสำหรับจัดการ Voter Management ---
function initVoterManagement() {
    const voterButton = document.getElementById('menu-voter');
    const sections = document.querySelectorAll('main > div'); // เลือกทุก section ใน main

    if (voterButton) {
        voterButton.addEventListener('click', (e) => {
            e.preventDefault();

            sections.forEach(section => {
                if (section.id === 'section-voter') {
                    section.classList.remove('hidden-section');
                    section.classList.add('active-section');
                } else {
                    section.classList.remove('active-section');
                    section.classList.add('hidden-section');
                }
            });
        });
    }
}

// เรียกใช้ฟังก์ชันเมื่อโหลดหน้า
initCandidateManagement();