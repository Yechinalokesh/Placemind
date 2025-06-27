const apiBase = 'http://localhost:5000';

async function loadDriveData() {
  const email = document.getElementById('emailInput').value;
  const res = await fetch(`${apiBase}/drive-status/${email}`);
  const drives = await res.json();

  const container = document.getElementById('driveContainer');
  container.innerHTML = '';

  if (drives.length === 0) {
    container.innerHTML = '<p>No drives found for this email.</p>';
    return;
  }

  drives.forEach(drive => {
    const card = document.createElement('div');
    card.className = 'bg-gray-800 p-4 rounded shadow-lg';

    card.innerHTML = `
      <h2 class="text-xl font-semibold mb-2">🏢 ${drive.companyName}</h2>
      <p><b>Status:</b> ${drive.currentStatus}</p>
      <p><b>Final Package:</b> ₹${drive.finalPackage} LPA</p>
      <p><b>Feedback:</b> ${drive.feedback || 'N/A'}</p>
      <div class="mt-3">
        <h3 class="font-bold">📋 Rounds:</h3>
        <ul class="list-disc ml-5">
          ${drive.rounds.map(r => `<li>${r.name}: <span class="text-yellow-400">${r.status}</span></li>`).join('')}
        </ul>
      </div>
    `;

    container.appendChild(card);
  });
}
