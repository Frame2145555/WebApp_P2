// search.js
function performSearch() {
    let q = document.getElementById('searchInput').value.toLowerCase();

    // ค้นหาทั้งจากชื่อและชื่อพรรค (กรองทันทีที่พิมพ์)
    let res = appData.candidates.filter(c =>
        c.name.toLowerCase().includes(q) || c.party.toLowerCase().includes(q)
    );

    let html = res.map(c => `
        <div class="search-result-item">
            <div>
                <strong>${c.name}</strong> 
                <span style="color:var(--text-muted); font-size:13px; margin-left:8px;">(${c.party})</span>
            </div>
            <div class="result-score">${c.votes} Votes</div>
        </div>
    `).join('');

    // ถ้าไม่เจอใครเลยให้แสดงข้อความนี้
    if (!html) {
        html = `
        <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>No results found for "${q}"</p>
        </div>`;
    }

    document.getElementById('searchResultsContainer').innerHTML = html;
}