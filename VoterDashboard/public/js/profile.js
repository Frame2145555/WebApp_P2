// profile.js

// 1. ฟังก์ชันรับไฟล์รูปภาพเมื่อผู้ใช้กดอัปโหลด
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file) {
        // จำกัดขนาดไฟล์ไม่เกิน 2MB
        if (file.size > 2 * 1024 * 1024) {
            alert("ไฟล์รูปใหญ่เกินไปครับ กรุณาเลือกไฟล์ขนาดไม่เกิน 2MB");
            return;
        }

        // แปลงไฟล์เป็น Base64 เพื่อเก็บลง LocalStorage
        const reader = new FileReader();
        reader.onload = function (e) {
            appData.user.avatarUrl = e.target.result;
            saveData(); // บันทึกลงระบบ
            updateProfileAvatarUI(); // อัปเดตให้รูปแสดงทันที
        };
        reader.readAsDataURL(file);
    }
}

// 2. ฟังก์ชันแสดงผลรูปภาพ
function updateProfileAvatarUI() {
    const avatarDisplay = document.getElementById('profileAvatarDisplay');
    // ป้องกัน Error ถ้ากำลังเปิดหน้าอื่นแล้วไม่มี ID นี้
    if (!avatarDisplay) return;

    if (appData.user.avatarUrl) {
        avatarDisplay.innerHTML = `<img src="${appData.user.avatarUrl}" alt="Profile">`;
    } else {
        avatarDisplay.innerHTML = '👤';
    }
}

// 3. ฟังก์ชันแสดงข้อมูลโปรไฟล์
function updateProfileUI() {
    const profName = document.getElementById('profName');
    // ป้องกัน Error ถ้าหน้าปัจจุบันไม่มี ID profName สคริปต์จะไม่ทำงานต่อและไม่พัง
    if (!profName) return;

    profName.innerText = appData.user.name;
    document.getElementById('profId').innerText = `ID: ${appData.user.id}`;
    document.getElementById('profFaculty').innerText = `Faculty: ${appData.user.faculty}`;

    // อัปเดต Sidebar ด้วย (ถ้ามี)
    const sidebarVoterId = document.getElementById('sidebarVoterId');
    if (sidebarVoterId) sidebarVoterId.innerText = `ID: ${appData.user.id}`;

    const sidebarStatus = document.getElementById('sidebarStatus');
    if (sidebarStatus) {
        sidebarStatus.innerText = appData.user.hasVoted ? "✓ Voted" : "Ready to Vote";
        sidebarStatus.style.color = appData.user.hasVoted ? "#4CAF50" : "var(--gold-bright)";
    }

    const badge = document.getElementById('profStatusBadge');
    if (badge) {
        if (appData.user.hasVoted) {
            badge.innerText = "Status: Voted Successfully";
            badge.className = "profile-status-badge status-voted";
        } else {
            badge.innerText = "Status: Ready to Vote";
            badge.className = "profile-status-badge status-ready";
        }
    }
}