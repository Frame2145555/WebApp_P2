// history.js
function renderHistory() {
    const container = document.getElementById('historyContainer');
    if (appData.user.history.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📜</div>No voting history found.</div>`;
        return;
    }

    let rows = appData.user.history.map(h => `
        <div class="table-row">
            <div><strong>${h.candidate}</strong><br><span style="color:var(--text-muted); font-size:12px;">${h.party}</span></div>
            <div>1 Vote</div>
            <div class="timestamp-cell">${h.time}</div>
        </div>
    `).join('');

    container.innerHTML = `<div class="history-table">
        <div class="table-header"><div>Candidate</div><div>Action</div><div>Timestamp</div></div>
        ${rows}</div>`;
}