// dashboard.js
function updateDashboard() {
    let totalV = appData.candidates.reduce((sum, c) => sum + c.votes, 0);
    document.getElementById('totalVoters').innerText = appData.voters.toLocaleString();
    document.getElementById('totalCandidates').innerText = appData.candidates.length;
    document.getElementById('totalVotes').innerText = totalV.toLocaleString();
    document.getElementById('votingPercent').innerText = ((totalV / appData.voters) * 100).toFixed(1) + "%";
}