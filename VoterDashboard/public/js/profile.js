// profile.js

// 1. ฟังก์ชันรับไฟล์รูปภาพเมื่อผู้ใช้กดอัปโหลด
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file) {
        // จำกัดขนาดไฟล์ไม่เกิน 2MB
        if (file.size > 2 * 1024 * 1024) {
            alert("Image file is too large. Please choose a file up to 2MB.");
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

    // Show loading state
    profName.innerText = 'Loading...';
    document.getElementById('profId').innerText = 'ID: ---';
    document.getElementById('profFaculty').innerText = 'Faculty: ---';

    // Get user from session
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) {
        profName.innerText = 'Not logged in';
        return;
    }

    // Fetch profile from API
    fetch(`/api/voter-dashboard/profile/${user.user_id}`)
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                const profile = result.data;

                profName.innerText = profile.name;
                document.getElementById('profId').innerText = `ID: ${profile.id}`;
                document.getElementById('profFaculty').innerText = `Faculty: ${profile.faculty}`;

                // อัปเดต Sidebar ด้วย (ถ้ามี)
                const sidebarVoterId = document.getElementById('sidebarVoterId');
                if (sidebarVoterId) sidebarVoterId.innerText = `ID: ${profile.id}`;

                const sidebarStatus = document.getElementById('sidebarStatus');
                if (sidebarStatus) {
                    sidebarStatus.innerText = profile.hasVoted ? "✓ Voted" : "Ready to Vote";
                    sidebarStatus.style.color = profile.hasVoted ? "#4CAF50" : "var(--gold-bright)";
                }

                const badge = document.getElementById('profStatusBadge');
                if (badge) {
                    if (profile.hasVoted) {
                        badge.innerText = "Status: Voted Successfully";
                        badge.className = "profile-status-badge status-voted";
                    } else {
                        badge.innerText = "Status: Ready to Vote";
                        badge.className = "profile-status-badge status-ready";
                    }
                }
            } else {
                profName.innerText = 'Error loading profile';
                console.error('Profile loading error:', result.message);
            }
        })
        .catch(error => {
            profName.innerText = 'Connection error';
            console.error('Profile loading error:', error);
        });
}

function redirectToLogin() {
    const loginPath = window.location.protocol === 'file:'
        ? '../../index-Login-register(tua)/public/Login.html'
        : '/Login';
    window.location.href = loginPath;
}

function handleLogout() {
    sessionStorage.removeItem('user');
    redirectToLogin();
}

document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.querySelector('.logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Load profile data
    updateProfileUI();
});