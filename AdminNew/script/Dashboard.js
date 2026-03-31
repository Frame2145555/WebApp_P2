(() => {
    document.addEventListener('DOMContentLoaded', () => {
        initDashboardChart();
        initVotingToggle();
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