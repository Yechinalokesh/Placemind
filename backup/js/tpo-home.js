// public/js/tpo-home.js

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));

  if (!token || !user || user.role !== 'tpo') {
    alert('Access denied. Only TPOs allowed.');
    window.location.href = 'auth.html';
    return;
  }

  document.getElementById('tpoName').textContent = user.name;

  await fetchPlacements();
  await fetchChartData();
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = 'index.html';
});

// Fetch and display placement records
async function fetchPlacements() {
  const res = await fetch('/students');
  const students = await res.json();

  const tbody = document.querySelector('#placementTable tbody');
  tbody.innerHTML = '';

  students.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${s.rollNo}</td>
      <td>${s.name}</td>
      <td>${s.branch}</td>
      <td>${s.package}</td>
      <td>${s.company}</td>
      <td>
        <button class="edit-btn" data-id="${s._id}">✏️</button>
        <button class="delete-btn" data-id="${s._id}">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Edit and delete button handlers
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editStudent(btn.dataset.id));
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this record?')) {
        await fetch(`/delete-student/${btn.dataset.id}`, { method: 'DELETE' });
        fetchPlacements();
      }
    });
  });
}

// Edit student record
async function editStudent(id) {
  const newPackage = prompt('Enter updated package:');
  const newCompany = prompt('Enter updated company:');

  if (newPackage && newCompany) {
    await fetch(`/update-student/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: newPackage, company: newCompany })
    });
    fetchPlacements();
  }
}

// Fetch chart data and render
async function fetchChartData() {
  const res = await fetch('/students');
  const data = await res.json();

  const branches = {};
  data.forEach(s => {
    branches[s.branch] = (branches[s.branch] || 0) + 1;
  });

  const ctx = document.getElementById('chartCanvas').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(branches),
      datasets: [{
        label: 'Placements by Branch',
        data: Object.values(branches),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}
