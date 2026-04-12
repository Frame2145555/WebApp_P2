
// เก็บข้อมูลจาก Database
let state = {
    user: null,         // ข้อมูล Voter ที่ล็อกอินเข้ามา
    candidates: [],     // รายชื่อผู้สมัครจาก Database
    hasVoted: false,    // สถานะการโหวต
    chartInstance: null // เก็บตัวแปรกราฟ
};

// 🚀 Initialization (ตอนโหลดหน้าเว็บ)
async function initApp() {
    // เปลี่ยนจาก localStorage เป็น sessionStorage
    const userData = sessionStorage.getItem('user');
    if (!userData) {
        alert("กรุณาเข้าสู่ระบบก่อน");
        window.location.replace('/public/Login.html');
        return;
    }
    state.user = JSON.parse(userData);

    // เปลี่ยนการเช็คสถานะการโหวต
    state.hasVoted = sessionStorage.getItem(`voted_${state.user.user_id}`) === 'true';

    await fetchCandidates();
    refreshAllUI();

    setInterval(async () => {
        await fetchCandidates();
        updateDashboard();
        renderChart();
    }, 10000);
}

// 🚀 API Calls (เชื่อมต่อ Backend)
async function fetchCandidates() {
    try {
        const response = await fetch('/api/voting/candidates');
        const result = await response.json();
        
        if (result.status === 'success') {
            state.candidates = result.data;
            state.totalVoters = result.total_voters || 0; // 🚨 เก็บค่าจาก DB ไว้ใน state
        }
    } catch (error) {
        console.error("Error fetching candidates:", error);
    }
}

// 🚀 UI Renders
function refreshAllUI() {
    updateProfileUI();
    updateDashboard();
    renderPolicies();
    renderVotingSection();
    renderChart();
}

function updateProfileUI() {
    document.getElementById('profName').innerText = state.user.display_name || state.user.username;
    document.getElementById('profId').innerText = `ID: ${state.user.username}`;
    document.getElementById('sidebarVoterId').innerText = `ID: ${state.user.username}`;

    const statusText = state.hasVoted ? "✓ Voted" : "Ready to Vote";
    document.getElementById('sidebarStatus').innerText = statusText;
    document.getElementById('sidebarStatus').style.color = state.hasVoted ? "#4CAF50" : "var(--gold-bright)";

    const badge = document.getElementById('profStatusBadge');
    if (state.hasVoted) {
        badge.innerText = "Status: Voted Successfully";
        badge.className = "profile-status-badge status-voted";
    } else {
        badge.innerText = "Status: Ready to Vote";
        badge.className = "profile-status-badge status-ready";
    }
}

function updateDashboard() {
    let totalV = state.candidates.reduce((sum, c) => sum + (c.score || 0), 0);
    
    document.getElementById('totalCandidates').innerText = state.candidates.length;
    document.getElementById('totalVotes').innerText = totalV.toLocaleString();
    
    // ใช้ตัวเลขจริงจาก Database
    const realTotalVoters = state.totalVoters || 0; 
    document.getElementById('totalVoters').innerText = realTotalVoters.toLocaleString();
    
    // คำนวณเปอร์เซ็นต์แบบไม่ให้หารศูนย์ (NaN)
    const percent = realTotalVoters > 0 ? ((totalV / realTotalVoters) * 100).toFixed(1) : 0;
    document.getElementById('votingPercent').innerText = percent + "%";
}

// ฟังก์ชันวาดกราฟ Top 3
function renderChart() {
    const ctx = document.getElementById('topCandidatesChart').getContext('2d');

    // เรียงลำดับคนคะแนนเยอะสุด และตัดมาแค่ 3 คน
    const top3 = [...state.candidates]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    const labels = top3.map(c => `${c.name} (${c.display_id})`);
    const data = top3.map(c => c.score);
    const colors = ['#8C1515', '#D4AF37', '#4a4a4a']; // แดงมฟล, ทอง, เทา

    if (state.chartInstance) {
        state.chartInstance.destroy(); // ลบกราฟเก่าก่อนวาดใหม่
    }

    state.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'คะแนนโหวต',
                data: data,
                backgroundColor: colors,
                borderRadius: 8,
                maxBarThickness: 60 // 🚨 บังคับไม่ให้แท่งกราฟอ้วนเกิน 60px
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // 🚨 บังคับให้กราฟพอดีกับความสูงของกล่อง (300px)
            layout: {
                padding: { top: 10, bottom: 10 } // เพิ่มระยะขอบนิดหน่อยให้ดูโปร่ง
            },
            plugins: { 
                legend: { display: false } 
            },
            scales: { 
                y: { 
                    beginAtZero: true, 
                    ticks: { precision: 0 } 
                },
                x: {
                    grid: { display: false } // 🚨 ซ่อนเส้นตารางแนวตั้ง จะทำให้กราฟดูคลีนและโมเดิร์นขึ้น
                }
            }
        }
    });
}

function renderPolicies() {
    const html = state.candidates.map(c => `
        <div class="candidate-card">
            <div class="candidate-avatar">
                ${c.profile_picture ? `<img src="${c.profile_picture}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : '👤'}
            </div>
            <div class="candidate-name">${c.name}</div>
            <div class="candidate-party">${c.display_id}</div>
            <button class="policy-btn" onclick="viewPolicy(${c.candidate_id})">Read Policy</button>
        </div>
    `).join('');
    document.getElementById('candidatesGridPolicies').innerHTML = html || '<p>ยังไม่มีผู้สมัคร</p>';
}

function renderVotingSection() {
    const container = document.getElementById('voteContainer');
    if (state.hasVoted) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="color:#4CAF50">✅</div>
                <h3 style="color:#8C1515; margin-bottom:10px;">You have already voted!</h3>
                <p>คุณได้ใช้สิทธิ์ลงคะแนนเสียงไปเรียบร้อยแล้ว ไม่สามารถโหวตซ้ำได้</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="alert-box" style="margin-bottom: 24px;">
            <strong>Note:</strong> คุณสามารถโหวตได้เพียง 1 ครั้งเท่านั้น กรุณาตรวจสอบให้แน่ใจก่อนกดยืนยัน
        </div>
        <div class="candidates-grid">
            ${state.candidates.map(c => `
                <div class="candidate-card">
                    <div class="candidate-avatar">
                        ${c.profile_picture ? `<img src="${c.profile_picture}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : '👤'}
                    </div>
                    <div class="candidate-name">${c.name}</div>
                    <div class="candidate-party">${c.display_id}</div>
                    <div class="candidate-actions">
                        <button class="vote-btn" onclick="confirmVote(${c.candidate_id})">VOTE</button>
                    </div>
                </div>
            `).join('')}
        </div>`;
}

// 🚀 ระบบจัดการการโหวต (Voting Process)
let selectedCandidate = null;

function viewPolicy(id) {
    let c = state.candidates.find(x => x.candidate_id === id);
    document.getElementById('policyTitle').innerText = `นโยบายของ ${c.name}`;
    document.getElementById('policyContent').innerText = c.policies || 'ยังไม่มีนโยบาย';
    document.getElementById('policyModal').classList.add('active');
}

function confirmVote(id) {
    if (state.hasVoted) return alert("You have already voted!");
    selectedCandidate = state.candidates.find(x => x.candidate_id === id);
    document.getElementById('confirmName').innerText = selectedCandidate.name;
    document.getElementById('confirmParty').innerText = selectedCandidate.display_id;
    document.getElementById('confirmVoteModal').classList.add('active');
}

// 🚨 ฟังก์ชันยิงคะแนนเข้า Database ของจริง!
async function processVote() {
    // ปิดหน้าต่างยืนยันก่อน
    closeModal('confirmVoteModal');

    try {
        const response = await fetch('/api/voting/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.user.user_id,
                candidate_id: selectedCandidate.candidate_id
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            // สำเร็จ! ล็อคสถานะการโหวต
            state.hasVoted = true;
            // เปลี่ยนมาเก็บใน sessionStorage
            sessionStorage.setItem(`voted_${state.user.user_id}`, 'true');

            await fetchCandidates();
            refreshAllUI();

            // โชว์หน้าต่าง Success
            document.getElementById('successCandidate').innerText = selectedCandidate.name;
            document.getElementById('successTime').innerText = new Date().toLocaleString('th-TH');
            document.getElementById('successModal').classList.add('active');

        } else {
            // โดนหลังบ้านเตะกลับมา (เช่น โหวตไปแล้ว, โดนแบน)
            alert(`ไม่สามารถโหวตได้: ${result.message}`);
        }
    } catch (error) {
        console.error("Voting Error:", error);
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
}

// ฟังก์ชันอื่นๆ (Tabs, Close Modal)
function finishVotingFlow() { closeModal('successModal'); switchTab('dashboard', document.querySelectorAll('.menu-item')[1]); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function logout() {
    sessionStorage.removeItem('user'); // ลบออกจาก sessionStorage
    window.location.replace('/public/Login.html');
}
function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (element && element.classList.contains('menu-item')) element.classList.add('active');
    if (tabId === 'search') performSearch();
}

window.onload = initApp;