// policies.js
function renderPolicies() {
    const html = appData.candidates.map(c => `
        <div class="candidate-card">
            <div class="candidate-avatar">${c.initials}</div>
            <div class="candidate-name">${c.name}</div>
            <div class="candidate-party">${c.party}</div>
            <button class="policy-btn" onclick="viewPolicy(${c.id})">Read Policy</button>
        </div>
    `).join('');
    document.getElementById('candidatesGridPolicies').innerHTML = html;
}

function viewPolicy(id) {
    let c = appData.candidates.find(x => x.id === id);
    document.getElementById('policyTitle').innerText = c.name + "'s Policy";
    document.getElementById('policyContent').innerText = c.policy;
    document.getElementById('policyModal').classList.add('active');
}