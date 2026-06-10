// App state
let currentView = 'dashboard';
let activeTimer = null;
let timerInterval = null;
let timerStartTime = null;
let earningsChart = null;

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const view = item.dataset.view;
        switchView(view);
    });
});

function switchView(view) {
    currentView = view;
    
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === view) {
            item.classList.add('active');
        }
    });
    
    // Show view
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });
    document.getElementById(`${view}-view`).classList.add('active');
    
    // Load data for view
    if (view === 'dashboard') {
        loadDashboard();
    } else if (view === 'clients') {
        loadClients();
    } else if (view === 'projects') {
        loadProjects();
    } else if (view === 'time-tracker') {
        loadTimeTracker();
    } else if (view === 'invoices') {
        loadInvoices();
    }
}

// Dashboard
function loadDashboard() {
    const month = document.getElementById('dashboard-month').value;
    
    document.getElementById('total-earnings').textContent = `$${db.getTotalEarnings().toFixed(2)}`;
    document.getElementById('total-hours').textContent = db.getTotalHours();
    document.getElementById('unpaid-invoices').textContent = `$${db.getUnpaidInvoicesTotal().toFixed(2)}`;
    document.getElementById('active-projects').textContent = db.getActiveProjectsCount();
    
    // Load recent activity
    const activities = db.getRecentActivity();
    const activityList = document.getElementById('recent-activity');
    activityList.innerHTML = activities.map(a => `
        <div class="activity-item">
            <div>
                <div>${a.description}</div>
                <small>${a.date}</small>
            </div>
            <span>${a.type === 'time' ? '⏱️' : '📄'}</span>
        </div>
    `).join('');
    
    // Update chart
    updateEarningsChart();
}

function updateEarningsChart() {
    const earnings = db.getEarningsByMonth();
    const months = Object.keys(earnings).sort();
    const values = months.map(m => earnings[m]);
    
    const ctx = document.getElementById('earnings-chart').getContext('2d');
    if (earningsChart) {
        earningsChart.destroy();
    }
    earningsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Earnings ($)',
                data: values,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Clients
function loadClients() {
    const clients = db.getClients();
    const clientsList = document.getElementById('clients-list');
    clientsList.innerHTML = clients.map(client => `
        <div class="client-card">
            <div class="client-header">
                <div class="client-name">${escapeHtml(client.name)}</div>
                <div class="client-actions">
                    <button onclick="editClient('${client.id}')">✏️</button>
                    <button onclick="deleteClient('${client.id}')">🗑️</button>
                </div>
            </div>
            <div class="client-email">📧 ${escapeHtml(client.email)}</div>
            ${client.phone ? `<div class="client-phone">📞 ${escapeHtml(client.phone)}</div>` : ''}
            ${client.company ? `<div class="client-company">🏢 ${escapeHtml(client.company)}</div>` : ''}
        </div>
    `).join('');
}

function openClientModal(clientId = null) {
    const modal = document.getElementById('client-modal');
    const form = document.getElementById('client-form');
    
    if (clientId) {
        const client = db.getClients().find(c => c.id === clientId);
        if (client) {
            document.getElementById('client-id').value = client.id;
            document.getElementById('client-name').value = client.name;
            document.getElementById('client-email').value = client.email;
            document.getElementById('client-phone').value = client.phone || '';
            document.getElementById('client-company').value = client.company || '';
            document.getElementById('client-address').value = client.address || '';
        }
    } else {
        form.reset();
        document.getElementById('client-id').value = '';
    }
    
    modal.style.display = 'block';
}

function editClient(id) {
    openClientModal(id);
}

function deleteClient(id) {
    if (confirm('Are you sure you want to delete this client?')) {
        db.deleteClient(id);
        loadClients();
        loadDashboard();
    }
}

// Projects
function loadProjects() {
    const projects = db.getProjects();
    const clients = db.getClients();
    const projectsList = document.getElementById('projects-list');
    
    projectsList.innerHTML = projects.map(project => {
        const client = clients.find(c => c.id === project.clientId);
        const hours = db.getProjectHours(project.id);
        const earnings = db.getProjectEarnings(project.id);
        return `
            <div class="project-card">
                <div class="project-info">
                    <h3>${escapeHtml(project.name)}</h3>
                    <div class="project-client">Client: ${client ? escapeHtml(client.name) : 'Unknown'}</div>
                    <div class="project-rate">$${project.hourlyRate}/hour</div>
                    <div class="project-hours">${hours} hours logged ($${earnings.toFixed(2)})</div>
                    <span class="project-status status-${project.status}">${project.status}</span>
                </div>
                <div class="project-actions">
                    <button onclick="editProject('${project.id}')" class="btn-secondary">Edit</button>
                    <button onclick="deleteProject('${project.id}')" class="btn-secondary">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function openProjectModal(projectId = null) {
    const modal = document.getElementById('project-modal');
    const clientSelect = document.getElementById('project-client');
    
    // Load clients into select
    const clients = db.getClients();
    clientSelect.innerHTML = '<option value="">Select Client</option>' + 
        clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    
    if (projectId) {
        const project = db.getProjects().find(p => p.id === projectId);
        if (project) {
            document.getElementById('project-id').value = project.id;
            document.getElementById('project-name').value = project.name;
            document.getElementById('project-client').value = project.clientId;
            document.getElementById('project-rate').value = project.hourlyRate;
            document.getElementById('project-status').value = project.status;
        }
    } else {
        document.getElementById('project-form').reset();
        document.getElementById('project-id').value = '';
    }
    
    modal.style.display = 'block';
}

function editProject(id) {
    openProjectModal(id);
}

function deleteProject(id) {
    if (confirm('Are you sure you want to delete this project? This will also delete all time entries.')) {
        db.deleteProject(id);
        loadProjects();
        loadDashboard();
        loadTimeTracker();
    }
}

// Time Tracker
function loadTimeTracker() {
    // Load projects into timer dropdown
    const projects = db.getProjects();
    const timerSelect = document.getElementById('timer-project');
    timerSelect.innerHTML = '<option value="">Select Project</option>' +
        projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    
    // Load recent time entries
    const entries = db.getTimeEntries();
    const entriesList = document.getElementById('entries-list');
    
    entriesList.innerHTML = entries.sort((a, b) => new Date(b.date) - new Date(a.date)).map(entry => {
        const project = db.getProjectById(entry.projectId);
        return `
            <div class="entry-item">
                <div class="entry-details">
                    <div class="entry-project">${project ? escapeHtml(project.name) : 'Unknown Project'}</div>
                    <div class="entry-description">${escapeHtml(entry.description)}</div>
                    <div class="entry-duration">${entry.duration} hours - ${entry.date}</div>
                </div>
                <div class="entry-actions">
                    <button onclick="deleteTimeEntry('${entry.id}')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

let timerRunning = false;
let timerSeconds = 0;

document.getElementById('start-timer-btn').addEventListener('click', () => {
    const projectId = document.getElementById('timer-project').value;
    if (!projectId) {
        alert('Please select a project first');
        return;
    }
    
    if (timerRunning) {
        alert('Timer is already running');
        return;
    }
    
    startTimer();
});

document.getElementById('stop-timer').addEventListener('click', () => {
    if (!timerRunning) return;
    
    const projectId = document.getElementById('timer-project').value;
    const description = document.getElementById('timer-description').value;
    
    if (!description) {
        alert('Please add a description');
        return;
    }
    
    const hours = timerSeconds / 3600;
    db.addTimeEntry({
        projectId: projectId,
        description: description,
        duration: hours
    });
    
    stopTimer();
    loadTimeTracker();
    loadDashboard();
});

function startTimer() {
    timerRunning = true;
    timerStartTime = Date.now();
    timerSeconds = 0;
    
    document.getElementById('active-timer').style.display = 'block';
    document.getElementById('start-timer-btn').style.display = 'none';
    
    timerInterval = setInterval(() => {
        timerSeconds = Math.floor((Date.now() - timerStartTime) / 1000);
        const hours = Math.floor(timerSeconds / 3600);
        const minutes = Math.floor((timerSeconds % 3600) / 60);
        const seconds = timerSeconds % 60;
        document.getElementById('timer-time').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    timerRunning = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    document.getElementById('active-timer').style.display = 'none';
    document.getElementById('start-timer-btn').style.display = 'block';
    document.getElementById('timer-project').value = '';
    document.getElementById('timer-description').value = '';
    document.getElementById('timer-time').textContent = '00:00:00';
}

function deleteTimeEntry(id) {
    if (confirm('Delete this time entry?')) {
        db.deleteTimeEntry(id);
        loadTimeTracker();
        loadDashboard();
    }
}

// Invoices
function loadInvoices() {
    const invoices = db.getInvoices();
    const clients = db.getClients();
    const invoicesList = document.getElementById('invoices-list');
    
    invoicesList.innerHTML = invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(invoice => {
        const client = clients.find(c => c.id === invoice.clientId);
        const isOverdue = invoice.status === 'unpaid' && new Date(invoice.dueDate) < new Date();
        return `
            <div class="invoice-card">
                <div class="invoice-info">
                    <h3>Invoice #${escapeHtml(invoice.number)}</h3>
                    <div class="invoice-client">${client ? escapeHtml(client.name) : 'Unknown'}</div>
                    <div class="invoice-dates">
                        Issued: ${invoice.date} | Due: ${invoice.dueDate}
                        ${isOverdue ? ' | ⚠️ OVERDUE' : ''}
                    </div>
                </div>
                <div class="invoice-right">
                    <div class="invoice-amount">$${invoice.total.toFixed(2)}</div>
                    <div class="invoice-status status-${invoice.status}">${invoice.status.toUpperCase()}</div>
                    <div class="invoice-actions">
                        ${invoice.status === 'unpaid' ? `<button class="btn-pay" onclick="markAsPaid('${invoice.id}')">Mark Paid</button>` : ''}
                        <button class="btn-download" onclick="downloadInvoice('${invoice.id}')">Download PDF</button>
                        <button onclick="deleteInvoice('${invoice.id}')" class="btn-secondary">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openInvoiceModal() {
    const modal = document.getElementById('invoice-modal');
    const clientSelect = document.getElementById('invoice-client');
    
    // Load clients
    const clients = db.getClients();
    clientSelect.innerHTML = '<option value="">Select Client</option>' +
        clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    document.getElementById('invoice-date').value = today;
    document.getElementById('invoice-due-date').value = dueDate.toISOString().split('T')[0];
    document.getElementById('invoice-number').value = `INV-${Date.now()}`;
    
    // Reset items
    document.getElementById('invoice-items-list').innerHTML = `
        <div class="invoice-item-row">
            <input type="text" placeholder="Description" class="item-desc">
            <input type="number" placeholder="Quantity" class="item-qty" value="1">
            <input type="number" placeholder="Rate" class="item-rate">
            <input type="number" placeholder="Amount" class="item-amount" readonly>
            <button type="button" class="remove-item-btn" onclick="removeInvoiceItem(this)">✖</button>
        </div>
    `;
    
    modal.style.display = 'block';
}

function addInvoiceItem() {
    const container = document.getElementById('invoice-items-list');
    const newItem = document.createElement('div');
    newItem.className = 'invoice-item-row';
    newItem.innerHTML = `
        <input type="text" placeholder="Description" class="item-desc">
        <input type="number" placeholder="Quantity" class="item-qty" value="1">
        <input type="number" placeholder="Rate" class="item-rate">
        <input type="number" placeholder="Amount" class="item-amount" readonly>
        <button type="button" class="remove-item-btn" onclick="removeInvoiceItem(this)">✖</button>
    `;
    container.appendChild(newItem);
}

function removeInvoiceItem(btn) {
    const container = document.getElementById('invoice-items-list');
    if (container.children.length > 1) {
        btn.closest('.invoice-item-row').remove();
    }
}

// Calculate invoice totals
document.addEventListener('input', (e) => {
    if (e.target.classList && (e.target.classList.contains('item-qty') || e.target.classList.contains('item-rate'))) {
        calculateInvoiceTotals();
    }
});

function calculateInvoiceTotals() {
    const rows = document.querySelectorAll('.invoice-item-row');
    let subtotal = 0;
    
    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
        const amount = qty * rate;
        row.querySelector('.item-amount').value = amount.toFixed(2);
        subtotal += amount;
    });
    
    const tax = subtotal * 0.10;
    const total = subtotal + tax;
    
    document.getElementById('invoice-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('invoice-tax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('invoice-total').textContent = `$${total.toFixed(2)}`;
}

// Invoice form submission
document.getElementById('invoice-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const items = [];
    const rows = document.querySelectorAll('.invoice-item-row');
    rows.forEach(row => {
        const desc = row.querySelector('.item-desc').value;
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
        if (desc && qty > 0 && rate > 0) {
            items.push({ description: desc, quantity: qty, rate: rate, amount: qty * rate });
        }
    });
    
    if (items.length === 0) {
        alert('Please add at least one invoice item');
        return;
    }
    
    const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
    const tax = subtotal * 0.10;
    const total = subtotal + tax;
    
    const invoice = {
        clientId: document.getElementById('invoice-client').value,
        number: document.getElementById('invoice-number').value,
        date: document.getElementById('invoice-date').value,
        dueDate: document.getElementById('invoice-due-date').value,
        notes: document.getElementById('invoice-notes').value,
        items: items,
        subtotal: subtotal,
        tax: tax,
        total: total
    };
    
    db.addInvoice(invoice);
    closeAllModals();
    loadInvoices();
    loadDashboard();
});

function markAsPaid(id) {
    if (confirm('Mark this invoice as paid?')) {
        db.markInvoiceAsPaid(id);
        loadInvoices();
        loadDashboard();
    }
}

function deleteInvoice(id) {
    if (confirm('Delete this invoice?')) {
        db.deleteInvoice(id);
        loadInvoices();
        loadDashboard();
    }
}

async function downloadInvoice(id) {
    const invoice = db.getInvoices().find(i => i.id === id);
    const client = db.getClientById(invoice.clientId);
    
    // Create invoice HTML for PDF
    const invoiceHTML = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
            <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="color: #667eea;">INVOICE</h1>
                <p>#${invoice.number}</p>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                <div>
                    <strong>From:</strong><br>
                    John Doe<br>
                    Freelance Designer<br>
                    john@freelance.com
                </div>
                <div>
                    <strong>To:</strong><br>
                    ${client.name}<br>
                    ${client.company || ''}<br>
                    ${client.email}
                </div>
            </div>
            <div style="margin-bottom: 40px;">
                <p><strong>Date:</strong> ${invoice.date}</p>
                <p><strong>Due Date:</strong> ${invoice.dueDate}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="padding: 12px; text-align: left;">Description</th>
                        <th style="padding: 12px; text-align: right;">Qty</th>
                        <th style="padding: 12px; text-align: right;">Rate</th>
                        <th style="padding: 12px; text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.items.map(item => `
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">$${item.rate.toFixed(2)}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">$${item.amount.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="text-align: right;">
                <p><strong>Subtotal:</strong> $${invoice.subtotal.toFixed(2)}</p>
                <p><strong>Tax (10%):</strong> $${invoice.tax.toFixed(2)}</p>
                <p style="font-size: 24px;"><strong>Total:</strong> $${invoice.total.toFixed(2)}</p>
            </div>
            ${invoice.notes ? `<div style="margin-top: 40px; padding: 20px; background: #f9fafb;"><strong>Notes:</strong><br>${invoice.notes}</div>` : ''}
        </div>
    `;
    
    // Create a temporary iframe to print/save as PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Invoice ${invoice.number}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                </style>
            </head>
            <body>${invoiceHTML}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Modal handling
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        closeAllModals();
    });
});

window.onclick = (event) => {
    if (event.target.classList.contains('modal')) {
        closeAllModals();
    }
};

// Form submissions
document.getElementById('client-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const client = {
        id: document.getElementById('client-id').value,
        name: document.getElementById('client-name').value,
        email: document.getElementById('client-email').value,
        phone: document.getElementById('client-phone').value,
        company: document.getElementById('client-company').value,
        address: document.getElementById('client-address').value
    };
    
    if (client.id) {
        db.updateClient(client);
    } else {
        db.addClient(client);
    }
    
    closeAllModals();
    loadClients();
    loadDashboard();
});

document.getElementById('project-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const project = {
        id: document.getElementById('project-id').value,
        name: document.getElementById('project-name').value,
        clientId: document.getElementById('project-client').value,
        hourlyRate: parseFloat(document.getElementById('project-rate').value),
        status: document.getElementById('project-status').value
    };
    
    if (project.id) {
        db.updateProject(project);
    } else {
        db.addProject(project);
    }
    
    closeAllModals();
    loadProjects();
    loadTimeTracker();
    loadDashboard();
});

document.getElementById('dashboard-month').addEventListener('change', () => {
    loadDashboard();
});

// Helper functions
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Initialize
loadDashboard();