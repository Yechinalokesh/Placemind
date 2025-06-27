function addRoundField() {
  const div = document.createElement('div');
  div.className = 'mb-2 flex gap-2';

  div.innerHTML = `
    <input type="text" placeholder="Round Name" class="round-name text-black p-2 rounded w-1/2" required />
    <select class="round-status text-black p-2 rounded" required>
      <option value="Passed">Passed</option>
      <option value="Failed">Failed</option>
      <option value="Pending">Pending</option>
    </select>
  `;
  
  const form = document.getElementById('driveForm');
  form.insertBefore(div, document.getElementById('currentStatus').parentElement);
}

document.getElementById('driveForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Collect form values
  const email = document.getElementById('email').value.trim();
  const companyName = document.getElementById('companyName').value.trim();
  const currentStatus = document.getElementById('currentStatus').value.trim();
  const finalPackage = document.getElementById('finalPackage').value.trim();
  const feedback = document.getElementById('feedback').value.trim();

  // Validate inputs
  if (!email || !companyName || !currentStatus || !finalPackage) {
    alert('⚠️ Please fill all required fields.');
    return;
  }

  // Collect round data
  const roundNames = document.querySelectorAll('.round-name');
  const roundStatuses = document.querySelectorAll('.round-status');

  const rounds = [];
  for (let i = 0; i < roundNames.length; i++) {
    const name = roundNames[i].value.trim();
    const status = roundStatuses[i].value;

    if (name) {
      rounds.push({ name, status });
    }
  }

  // Final drive object
  const drive = {
    studentEmail: email,
    companyName,
    currentStatus,
    finalPackage,
    feedback,
    rounds
  };
  const res = await fetch('http://localhost:5000/add-drive', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')  // 👈 add this line
  },
  body: JSON.stringify(drive)
});

  try {
    const res = await fetch('http://localhost:5000/add-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(drive)
    });

    if (res.ok) {
      alert('🎉 Drive submitted successfully!');
      window.location.href = 'tpo-home.html'; // Redirect to TPO dashboard
    } else {
      alert('❌ Failed to submit drive. Please check input.');
    }
  } catch (err) {
    console.error('❌ Error:', err);
    alert('❌ Something went wrong. Try again later.');
  }
});
