// ============================================================
// App — fully async, Supabase-backed
// ============================================================

let currentView    = 'dashboard';
let earningsChart  = null;
let timerRunning   = false;
let timerInterval  = null;
let timerSeconds   = 0;
let timerStartTime = null;
let projectFilter  = 'all';
let invoiceFilter  = 'all';

// ── Navigation ────────────────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
});

function switchView(view) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(i =>
        i.classList.toggle('active', i.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${view}-view`).classList.add('active');

    if (view === 'dashboard')    loadDashboard();
    if (view === 'clients')      loadClients();
    if (view === 'projects')     loadProjects();
    if (view === 'time-tracker') loadTimeTracker();
    if (view === 'invoices')     loadInvoices();
    if (view === 'account')      loadAccountStats();
}

// ── Loading indicator ─────────────────────────────────────────

function setLoading(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    if (on) {
        el.dataset.orig = el.innerHTML;
        el.innerHTML = `<div class="skeleton-line"></div>`;
    } else if (el.dataset.orig !== undefined) {
        el.innerHTML = el.dataset.orig;
        delete el.dataset.orig;
    }
}

// ── Dashboard ─────────────────────────────────────────────────

async function loadDashboard() {
    // Show placeholders while loading
    ['total-earnings','total-hours','unpaid-invoices','active-projects'].forEach(id => {
        document.getElementById(id).textContent = '—';
    });

    const [earnings, hours, unpaid, activeCount, activities] = await Promise.all([
        db.getTotalEarnings(),
        db.getTotalHours(),
        db.getUnpaidInvoicesTotal(),
        db.getActiveProjectsCount(),
        db.getRecentActivity()
    ]);

    document.getElementById('total-earnings').textContent  = `$${earnings.toFixed(2)}`;
    document.getElementById('total-hours').textContent     = `${hours}h`;
    document.getElementById('unpaid-invoices').textContent = `$${unpaid.toFixed(2)}`;
    document.getElementById('active-projects').textContent = activeCount;

    const activityList = document.getElementById('recent-activity');
    if (activities.length === 0) {
        activityList.innerHTML = `<div class="empty-state-small">No recent activity yet.</div>`;
    } else {
        activityList.innerHTML = activities.map(a => `
            <div class="activity-item">
                <div class="activity-icon ${a.type === 'time' ? 'activity-time' : 'activity-invoice'}">
                    ${a.type === 'time'
                        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
                        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`}
                </div>
                <div class="activity-body">
                    <div class="activity-desc">${escapeHtml(a.description)}</div>
                    <div class="activity-date">${formatDate(a.date)}</div>
                </div>
            </div>`).join('');
    }

    const mp = document.getElementById('dashboard-month');
    if (!mp.value) mp.value = new Date().toISOString().substring(0, 7);

    await updateEarningsChart();
}

async function updateEarningsChart() {
    const earnings = await db.getEarningsByMonth();
    const months   = Object.keys(earnings).sort();
    const values   = months.map(m => earnings[m]);

    const ctx = document.getElementById('earnings-chart').getContext('2d');
    if (earningsChart) earningsChart.destroy();

    const labels = months.length
        ? months.map(m => {
            const [y, mo] = m.split('-');
            return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          })
        : ['No data'];
    const dataset = months.length ? values : [0];

    earningsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Earnings ($)',
                data: dataset,
                borderColor: '#4F46E5',
                backgroundColor: 'rgba(79,70,229,0.08)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#4F46E5',
                pointRadius: months.length ? 4 : 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => `$${v}` } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ── Clients ───────────────────────────────────────────────────

async function loadClients() {
    const list  = document.getElementById('clients-list');
    list.innerHTML = `<div class="loading-state">Loading clients…</div>`;

    const query   = (document.getElementById('client-search')?.value || '').toLowerCase();
    let clients   = await db.getClients();
    const projects = await db.getProjects();

    if (query) clients = clients.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        (c.company || '').toLowerCase().includes(query)
    );

    if (clients.length === 0) {
        list.innerHTML = `<div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p>No clients yet</p>
            <button class="btn-primary" onclick="openClientModal()">Add your first client</button>
        </div>`;
        return;
    }

    list.innerHTML = clients.map(client => {
        const initials   = client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const projCount  = projects.filter(p => p.client_id === client.id).length;
        return `
            <div class="client-card">
                <div class="client-header">
                    <div class="client-avatar">${initials}</div>
                    <div class="client-meta">
                        <div class="client-name">${escapeHtml(client.name)}</div>
                        ${client.company ? `<div class="client-company">${escapeHtml(client.company)}</div>` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="icon-btn" onclick="editClient('${client.id}')" title="Edit">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="icon-btn icon-btn-danger" onclick="deleteClient('${client.id}')" title="Delete">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                    </div>
                </div>
                <div class="client-details">
                    <div class="client-detail-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        ${escapeHtml(client.email)}
                    </div>
                    ${client.phone ? `<div class="client-detail-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        ${escapeHtml(client.phone)}</div>` : ''}
                </div>
                <div class="client-footer">
                    <span class="client-projects-badge">${projCount} project${projCount !== 1 ? 's' : ''}</span>
                </div>
            </div>`;
    }).join('');
}

async function openClientModal(clientId = null) {
    const form = document.getElementById('client-form');
    form.reset();
    document.getElementById('client-id').value = '';
    document.getElementById('client-modal-title').textContent = clientId ? 'Edit Client' : 'New Client';

    if (clientId) {
        const c = await db.getClientById(clientId);
        if (c) {
            document.getElementById('client-id').value      = c.id;
            document.getElementById('client-name').value    = c.name;
            document.getElementById('client-email').value   = c.email;
            document.getElementById('client-phone').value   = c.phone    || '';
            document.getElementById('client-company').value = c.company  || '';
            document.getElementById('client-address').value = c.address  || '';
        }
    }
    document.getElementById('client-modal').style.display = 'flex';
}

function editClient(id) { openClientModal(id); }

async function deleteClient(id) {
    if (!confirm('Delete this client? This cannot be undone.')) return;
    try {
        await db.deleteClient(id);
        showToast('Client deleted.');
        loadClients();
        loadDashboard();
    } catch (e) { showToast('Failed to delete client.', 'error'); }
}

// ── Projects ──────────────────────────────────────────────────

function filterProjects(btn) {
    document.querySelectorAll('#projects-view .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    projectFilter = btn.dataset.status;
    loadProjects();
}

async function loadProjects() {
    const list = document.getElementById('projects-list');
    list.innerHTML = `<div class="loading-state">Loading projects…</div>`;

    let [projects, clients] = await Promise.all([db.getProjects(), db.getClients()]);
    if (projectFilter !== 'all') projects = projects.filter(p => p.status === projectFilter);

    if (projects.length === 0) {
        list.innerHTML = `<div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <p>No projects found</p>
            <button class="btn-primary" onclick="openProjectModal()">Add a project</button>
        </div>`;
        return;
    }

    // Fetch hours/earnings for all projects in parallel
    const stats = await Promise.all(projects.map(async p => ({
        hours:    await db.getProjectHours(p.id),
        earnings: await db.getProjectEarnings(p.id)
    })));

    list.innerHTML = projects.map((project, i) => {
        const client = clients.find(c => c.id === project.client_id);
        return `
            <div class="project-card">
                <div class="project-left">
                    <div class="project-name">${escapeHtml(project.name)}</div>
                    <div class="project-meta">
                        <span class="project-client">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            ${client ? escapeHtml(client.name) : 'Unknown client'}
                        </span>
                        <span class="project-rate">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            $${project.hourly_rate}/hr
                        </span>
                        <span class="project-hours">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            ${stats[i].hours}h logged — $${stats[i].earnings.toFixed(2)}
                        </span>
                    </div>
                </div>
                <div class="project-right">
                    <span class="status-badge status-${project.status}">${statusLabel(project.status)}</span>
                    <div class="card-actions">
                        <button class="icon-btn" onclick="editProject('${project.id}')" title="Edit">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="icon-btn icon-btn-danger" onclick="deleteProject('${project.id}')" title="Delete">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

async function openProjectModal(projectId = null) {
    const clients      = await db.getClients();
    const clientSelect = document.getElementById('project-client');
    clientSelect.innerHTML = '<option value="">Select a client</option>' +
        clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    document.getElementById('project-form').reset();
    document.getElementById('project-id').value = '';
    document.getElementById('project-modal-title').textContent = projectId ? 'Edit Project' : 'New Project';

    if (projectId) {
        const projects = await db.getProjects();
        const p = projects.find(p => p.id === projectId);
        if (p) {
            document.getElementById('project-id').value     = p.id;
            document.getElementById('project-name').value   = p.name;
            document.getElementById('project-client').value = p.client_id   || '';
            document.getElementById('project-rate').value   = p.hourly_rate;
            document.getElementById('project-status').value = p.status;
        }
    }
    document.getElementById('project-modal').style.display = 'flex';
}

function editProject(id) { openProjectModal(id); }

async function deleteProject(id) {
    if (!confirm('Delete this project? All time entries will also be removed.')) return;
    try {
        await db.deleteProject(id);
        showToast('Project deleted.');
        loadProjects();
        loadTimeTracker();
        loadDashboard();
    } catch (e) { showToast('Failed to delete project.', 'error'); }
}

// ── Time Tracker ──────────────────────────────────────────────

async function loadTimeTracker() {
    const projects = await db.getProjects();

    const timerSel    = document.getElementById('timer-project');
    const manualSel   = document.getElementById('manual-project');
    const currentVal  = timerSel.value;

    const options = '<option value="">Select project</option>' +
        projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

    timerSel.innerHTML  = options;
    manualSel.innerHTML = options;
    if (currentVal) timerSel.value = currentVal;

    const dateInput = document.getElementById('manual-date');
    if (!dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];

    await renderEntries();
}

async function renderEntries() {
    const [entries, projects] = await Promise.all([db.getTimeEntries(), db.getProjects()]);
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalHours    = entries.reduce((s, e) => s + Number(e.duration), 0);
    const totalEarnings = entries.reduce((s, e) => {
        const p = projects.find(p => p.id === e.project_id);
        return s + (p ? Number(e.duration) * Number(p.hourly_rate) : 0);
    }, 0);

    const summary = document.getElementById('entries-summary');
    if (entries.length > 0) {
        summary.innerHTML = `
            <span class="summary-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${totalHours.toFixed(2)}h total
            </span>
            <span class="summary-chip summary-chip-green">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                $${totalEarnings.toFixed(2)} earned
            </span>
            <span class="summary-chip">${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}</span>`;
    } else {
        summary.innerHTML = '';
    }

    const list = document.getElementById('entries-list');
    if (entries.length === 0) {
        list.innerHTML = `<div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p>No time entries yet.</p>
            <p style="font-size:12px;color:#9ca3af;">Use the timer or log time manually.</p>
        </div>`;
        return;
    }

    // Group by date
    const grouped = {};
    entries.forEach(e => {
        if (!grouped[e.date]) grouped[e.date] = [];
        grouped[e.date].push(e);
    });

    list.innerHTML = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).map(date => {
        const dayEntries  = grouped[date];
        const dayHours    = dayEntries.reduce((s, e) => s + Number(e.duration), 0);
        const dayEarnings = dayEntries.reduce((s, e) => {
            const p = projects.find(p => p.id === e.project_id);
            return s + (p ? Number(e.duration) * Number(p.hourly_rate) : 0);
        }, 0);

        return `
            <div class="entry-group">
                <div class="entry-group-header">
                    <span class="entry-group-date">${formatDate(date)}</span>
                    <span class="entry-group-totals">${dayHours.toFixed(2)}h &nbsp;·&nbsp; $${dayEarnings.toFixed(2)}</span>
                </div>
                ${dayEntries.map(entry => {
                    const project  = projects.find(p => p.id === entry.project_id);
                    const earnings = project
                        ? (Number(entry.duration) * Number(project.hourly_rate)).toFixed(2)
                        : '0.00';
                    return `
                        <div class="entry-item" id="entry-${entry.id}">
                            <div class="entry-left">
                                <div class="entry-project-dot" style="background:${projectColor(entry.project_id)}"></div>
                                <div>
                                    <div class="entry-project">${project ? escapeHtml(project.name) : '<span style="color:#9ca3af">Unknown</span>'}</div>
                                    <div class="entry-desc">${escapeHtml(entry.description)}</div>
                                </div>
                            </div>
                            <div class="entry-right">
                                <div class="entry-duration">${entry.duration}h</div>
                                <div class="entry-earnings">$${earnings}</div>
                                <button class="icon-btn" onclick="editTimeEntry('${entry.id}')" title="Edit">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button class="icon-btn icon-btn-danger" onclick="deleteTimeEntry('${entry.id}')" title="Delete">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                </button>
                            </div>
                        </div>`;
                }).join('')}
            </div>`;
    }).join('');
}

function projectColor(id) {
    const colors = ['#4F46E5','#10B981','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#EC4899','#14B8A6'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

// ── Timer controls ────────────────────────────────────────────

document.getElementById('start-timer-btn').addEventListener('click', async () => {
    if (timerRunning) { showToast('A timer is already running.', 'warn'); return; }

    const sel = document.getElementById('timer-project');
    if (sel.options.length <= 1) {
        const projects = await db.getProjects();
        sel.innerHTML = '<option value="">Select project</option>' +
            projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    }
    document.getElementById('active-timer').style.display    = 'block';
    document.getElementById('start-timer-btn').style.display = 'none';
    sel.focus();
});

document.getElementById('stop-timer').addEventListener('click', async () => {
    if (!timerRunning) {
        document.getElementById('active-timer').style.display    = 'none';
        document.getElementById('start-timer-btn').style.display = 'block';
        return;
    }
    const projectId   = document.getElementById('timer-project').value;
    const description = document.getElementById('timer-description').value.trim();
    if (!projectId)   { showToast('Please select a project.', 'warn'); return; }
    if (!description) { showToast('Add a description before saving.', 'warn'); return; }

    const hours = parseFloat((timerSeconds / 3600).toFixed(2));
    try {
        await db.addTimeEntry({ projectId, description, duration: Math.max(hours, 0.01) });
        stopTimer();
        await Promise.all([loadTimeTracker(), loadDashboard()]);
        showToast('Time entry saved.');
    } catch (e) { showToast('Failed to save entry.', 'error'); }
});

document.getElementById('timer-description').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (!timerRunning) {
            const pid = document.getElementById('timer-project').value;
            if (!pid) { showToast('Select a project first.', 'warn'); return; }
            startTimer();
        }
    }
});

document.getElementById('timer-project').addEventListener('change', () => {
    if (document.getElementById('timer-project').value && !timerRunning) startTimer();
});

function startTimer() {
    timerRunning   = true;
    timerStartTime = Date.now();
    timerSeconds   = 0;
    timerInterval  = setInterval(() => {
        timerSeconds = Math.floor((Date.now() - timerStartTime) / 1000);
        const h = Math.floor(timerSeconds / 3600);
        const m = Math.floor((timerSeconds % 3600) / 60);
        const s = timerSeconds % 60;
        document.getElementById('timer-time').textContent =
            `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
}

function stopTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    timerSeconds  = 0;
    document.getElementById('active-timer').style.display    = 'none';
    document.getElementById('start-timer-btn').style.display = 'block';
    document.getElementById('timer-project').value           = '';
    document.getElementById('timer-description').value       = '';
    document.getElementById('timer-time').textContent        = '00:00:00';
}

// ── Manual entry form ─────────────────────────────────────────

document.getElementById('manual-entry-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id          = document.getElementById('manual-entry-id').value;
    const projectId   = document.getElementById('manual-project').value;
    const description = document.getElementById('manual-description').value.trim();
    const duration    = parseFloat(document.getElementById('manual-hours').value);
    const date        = document.getElementById('manual-date').value;

    if (!projectId)          { showToast('Select a project.', 'warn'); return; }
    if (!description)        { showToast('Add a description.', 'warn'); return; }
    if (!duration || duration <= 0) { showToast('Hours must be > 0.', 'warn'); return; }
    if (!date)               { showToast('Select a date.', 'warn'); return; }

    try {
        if (id) {
            await db.updateTimeEntry({ id, projectId, description, duration, date });
            showToast('Entry updated.');
            cancelEditEntry();
        } else {
            await db.addTimeEntry({ projectId, description, duration, date });
            showToast('Entry added.');
            document.getElementById('manual-entry-form').reset();
            document.getElementById('manual-date').value = new Date().toISOString().split('T')[0];
        }
        await Promise.all([loadTimeTracker(), loadDashboard()]);
    } catch (err) { showToast('Failed to save entry.', 'error'); }
});

async function editTimeEntry(id) {
    const entries = await db.getTimeEntries();
    const entry   = entries.find(e => e.id === id);
    if (!entry) return;

    document.getElementById('manual-entry-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('manual-entry-id').value    = entry.id;
    document.getElementById('manual-project').value     = entry.project_id;
    document.getElementById('manual-description').value = entry.description;
    document.getElementById('manual-hours').value       = entry.duration;
    document.getElementById('manual-date').value        = entry.date;

    document.getElementById('manual-submit-btn').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Update Entry`;
    document.getElementById('manual-cancel-btn').style.display = 'inline-flex';
    document.getElementById('manual-entry-card').classList.add('editing');
}

function cancelEditEntry() {
    document.getElementById('manual-entry-id').value    = '';
    document.getElementById('manual-entry-form').reset();
    document.getElementById('manual-date').value        = new Date().toISOString().split('T')[0];
    document.getElementById('manual-submit-btn').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Entry`;
    document.getElementById('manual-cancel-btn').style.display = 'none';
    document.getElementById('manual-entry-card').classList.remove('editing');
}

async function deleteTimeEntry(id) {
    if (!confirm('Delete this time entry?')) return;
    try {
        await db.deleteTimeEntry(id);
        showToast('Entry deleted.');
        await Promise.all([loadTimeTracker(), loadDashboard()]);
    } catch (e) { showToast('Failed to delete entry.', 'error'); }
}

// ── Invoices ──────────────────────────────────────────────────

function filterInvoices(btn) {
    document.querySelectorAll('#invoices-view .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    invoiceFilter = btn.dataset.status;
    loadInvoices();
}

async function loadInvoices() {
    const list = document.getElementById('invoices-list');
    list.innerHTML = `<div class="loading-state">Loading invoices…</div>`;

    let [invoices, clients] = await Promise.all([db.getInvoices(), db.getClients()]);
    invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (invoiceFilter === 'paid')    invoices = invoices.filter(i => i.status === 'paid');
    if (invoiceFilter === 'unpaid')  invoices = invoices.filter(i => i.status === 'unpaid');
    if (invoiceFilter === 'overdue') invoices = invoices.filter(i =>
        i.status === 'unpaid' && new Date(i.due_date) < new Date());

    if (invoices.length === 0) {
        list.innerHTML = `<div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p>No invoices found</p>
            <button class="btn-primary" onclick="openInvoiceModal()">Create an invoice</button>
        </div>`;
        return;
    }

    list.innerHTML = invoices.map(invoice => {
        const client    = clients.find(c => c.id === invoice.client_id);
        const isOverdue = invoice.status === 'unpaid' && new Date(invoice.due_date) < new Date();
        const statusClass = isOverdue ? 'overdue' : invoice.status;
        const statusText  = isOverdue ? 'Overdue' : invoice.status === 'paid' ? 'Paid' : 'Unpaid';

        return `
            <div class="invoice-card">
                <div class="invoice-left">
                    <div class="invoice-number">Invoice #${escapeHtml(invoice.number)}</div>
                    <div class="invoice-client">${client ? escapeHtml(client.name) : 'Unknown client'}</div>
                    <div class="invoice-dates">
                        Issued ${formatDate(invoice.date)}
                        <span class="date-sep">·</span>
                        Due ${formatDate(invoice.due_date)}
                    </div>
                </div>
                <div class="invoice-right">
                    <div class="invoice-amount">$${Number(invoice.total).toFixed(2)}</div>
                    <span class="status-badge status-${statusClass}">${statusText}</span>
                    <div class="invoice-actions">
                        ${invoice.status === 'unpaid'
                            ? `<button class="btn-sm btn-green" onclick="markAsPaid('${invoice.id}')">Mark Paid</button>`
                            : ''}
                        <button class="btn-sm btn-blue" onclick="downloadInvoice('${invoice.id}')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            PDF
                        </button>
                        <button class="btn-sm btn-ghost-danger" onclick="deleteInvoice('${invoice.id}')">Delete</button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

async function openInvoiceModal() {
    const clients      = await db.getClients();
    const clientSelect = document.getElementById('invoice-client');
    clientSelect.innerHTML = '<option value="">Select a client</option>' +
        clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    const today   = new Date().toISOString().split('T')[0];
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);

    document.getElementById('invoice-date').value     = today;
    document.getElementById('invoice-due-date').value = dueDate.toISOString().split('T')[0];
    document.getElementById('invoice-number').value   = `INV-${Date.now().toString().slice(-6)}`;
    document.getElementById('invoice-notes').value    = '';

    document.getElementById('invoice-items-list').innerHTML = `
        <div class="invoice-item-row">
            <input type="text" placeholder="Service description" class="item-desc">
            <input type="number" placeholder="1" class="item-qty" value="1" min="0">
            <input type="number" placeholder="0.00" class="item-rate" min="0">
            <input type="number" placeholder="0.00" class="item-amount" readonly>
            <button type="button" class="remove-item-btn" onclick="removeInvoiceItem(this)" title="Remove">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>`;

    ['invoice-subtotal','invoice-tax','invoice-total'].forEach(id =>
        document.getElementById(id).textContent = '$0.00');

    document.getElementById('invoice-modal').style.display = 'flex';
}

function addInvoiceItem() {
    const container = document.getElementById('invoice-items-list');
    const row = document.createElement('div');
    row.className = 'invoice-item-row';
    row.innerHTML = `
        <input type="text" placeholder="Service description" class="item-desc">
        <input type="number" placeholder="1" class="item-qty" value="1" min="0">
        <input type="number" placeholder="0.00" class="item-rate" min="0">
        <input type="number" placeholder="0.00" class="item-amount" readonly>
        <button type="button" class="remove-item-btn" onclick="removeInvoiceItem(this)" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>`;
    container.appendChild(row);
}

function removeInvoiceItem(btn) {
    const container = document.getElementById('invoice-items-list');
    if (container.children.length > 1) btn.closest('.invoice-item-row').remove();
    calculateInvoiceTotals();
}

document.addEventListener('input', e => {
    if (e.target.classList.contains('item-qty') || e.target.classList.contains('item-rate'))
        calculateInvoiceTotals();
});

function calculateInvoiceTotals() {
    let subtotal = 0;
    document.querySelectorAll('.invoice-item-row').forEach(row => {
        const qty  = parseFloat(row.querySelector('.item-qty').value)  || 0;
        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
        const amt  = qty * rate;
        row.querySelector('.item-amount').value = amt.toFixed(2);
        subtotal += amt;
    });
    const tax = subtotal * 0.10;
    document.getElementById('invoice-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('invoice-tax').textContent      = `$${tax.toFixed(2)}`;
    document.getElementById('invoice-total').textContent    = `$${(subtotal + tax).toFixed(2)}`;
}

document.getElementById('invoice-form').addEventListener('submit', async e => {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('.invoice-item-row').forEach(row => {
        const desc = row.querySelector('.item-desc').value.trim();
        const qty  = parseFloat(row.querySelector('.item-qty').value)  || 0;
        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
        if (desc && qty > 0 && rate > 0) items.push({ description: desc, quantity: qty, rate, amount: qty * rate });
    });
    if (items.length === 0) { showToast('Add at least one line item.', 'warn'); return; }

    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const tax      = subtotal * 0.10;

    try {
        await db.addInvoice({
            clientId: document.getElementById('invoice-client').value,
            number:   document.getElementById('invoice-number').value,
            date:     document.getElementById('invoice-date').value,
            dueDate:  document.getElementById('invoice-due-date').value,
            notes:    document.getElementById('invoice-notes').value,
            items, subtotal, tax, total: subtotal + tax
        });
        closeAllModals();
        await Promise.all([loadInvoices(), loadDashboard()]);
        showToast('Invoice created.');
    } catch (err) { showToast('Failed to create invoice.', 'error'); }
});

async function markAsPaid(id) {
    if (!confirm('Mark this invoice as paid?')) return;
    try {
        await db.markInvoiceAsPaid(id);
        await Promise.all([loadInvoices(), loadDashboard()]);
        showToast('Invoice marked as paid.');
    } catch (e) { showToast('Failed to update invoice.', 'error'); }
}

async function deleteInvoice(id) {
    if (!confirm('Delete this invoice?')) return;
    try {
        await db.deleteInvoice(id);
        await Promise.all([loadInvoices(), loadDashboard()]);
        showToast('Invoice deleted.');
    } catch (e) { showToast('Failed to delete invoice.', 'error'); }
}

async function downloadInvoice(id) {
    const invoices = await db.getInvoices();
    const invoice  = invoices.find(i => i.id === id);
    if (!invoice) return;
    const client  = await db.getClientById(invoice.client_id);
    const user    = getCurrentUser();
    const logoUrl = getLogoDataUrl(user?.id);

    const brandBlock = logoUrl
        ? `<img src="${logoUrl}" alt="Logo" style="max-height:64px;max-width:180px;object-fit:contain;display:block;margin-bottom:6px;">
           ${user?.business ? `<div style="font-size:13px;color:#6b7280;">${escapeHtml(user.business)}</div>` : ''}`
        : `<div class="brand">${escapeHtml(user?.business || (user ? `${user.firstName} ${user.lastName}` : 'FreelanceCRM'))}</div>`;

    const fromName    = user ? `${user.firstName} ${user.lastName}`.trim() : 'Freelancer';
    const fromDetails = [user?.email, user?.phone, user?.address ? user.address.replace(/\n/g, '<br>') : '']
        .filter(Boolean).join('<br>');

    const isOverdue  = invoice.status === 'unpaid' && new Date(invoice.due_date) < new Date();
    const badgeStyle = invoice.status === 'paid'
        ? 'background:#d1fae5;color:#065f46;'
        : isOverdue ? 'background:#fef3c7;color:#92400e;' : 'background:#fee2e2;color:#991b1b;';
    const badgeText  = invoice.status === 'paid' ? 'PAID' : isOverdue ? 'OVERDUE' : 'UNPAID';

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Invoice ${escapeHtml(invoice.number)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;color:#111827;background:#fff}
        .page{max-width:760px;margin:0 auto;padding:56px 60px}
        .inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px}
        .brand{font-size:22px;font-weight:700;color:#4F46E5}
        .inv-right{text-align:right}
        .inv-label{font-size:30px;font-weight:700}
        .inv-num{font-size:14px;color:#6b7280;margin:4px 0 10px}
        .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700}
        hr{border:none;border-top:1px solid #e5e7eb;margin:0 0 36px}
        .parties{display:flex;justify-content:space-between;gap:40px;margin-bottom:36px}
        .party h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:10px}
        .party p{font-size:13px;color:#374151;line-height:1.7}
        .party strong{color:#111827;font-size:14px}
        .dates-bar{display:flex;margin-bottom:36px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
        .date-cell{flex:1;padding:14px 20px;border-right:1px solid #e5e7eb}
        .date-cell:last-child{border-right:none}
        .date-cell span{display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:5px}
        .date-cell strong{font-size:13px;color:#111827}
        table{width:100%;border-collapse:collapse;margin-bottom:8px}
        thead tr{background:#f9fafb}
        th{padding:11px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;border-bottom:1px solid #e5e7eb}
        td{padding:13px 16px;font-size:13px;border-bottom:1px solid #f3f4f6;color:#374151}
        th:not(:first-child),td:not(:first-child){text-align:right}
        .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:36px}
        .totals{width:260px}
        .totals-row{display:flex;justify-content:space-between;padding:7px 0;font-size:13px;color:#374151}
        .totals-sep{border:none;border-top:1px solid #e5e7eb;margin:6px 0}
        .totals-final{font-size:16px;font-weight:700;color:#111827;padding-top:10px}
        .totals-final span:last-child{color:#4F46E5}
        .notes{padding:18px 20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px}
        .notes h4{font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:8px}
        .notes p{font-size:13px;color:#374151;line-height:1.6;white-space:pre-wrap}
        .inv-footer{margin-top:48px;padding-top:20px;border-top:1px solid #f3f4f6;text-align:center;font-size:11px;color:#d1d5db}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:40px 44px}}
    </style></head><body><div class="page">
    <div class="inv-header">
        <div>${brandBlock}</div>
        <div class="inv-right">
            <div class="inv-label">Invoice</div>
            <div class="inv-num">#${escapeHtml(invoice.number)}</div>
            <span class="badge" style="${badgeStyle}">${badgeText}</span>
        </div>
    </div>
    <hr>
    <div class="parties">
        <div class="party"><h4>From</h4><p><strong>${escapeHtml(fromName)}</strong><br>${fromDetails}</p></div>
        <div class="party"><h4>Bill To</h4><p>
            <strong>${escapeHtml(client?.name || '—')}</strong><br>
            ${client?.company ? escapeHtml(client.company)+'<br>' : ''}
            ${escapeHtml(client?.email || '')}
            ${client?.phone ? '<br>'+escapeHtml(client.phone) : ''}
            ${client?.address ? '<br>'+escapeHtml(client.address).replace(/\n/g,'<br>') : ''}
        </p></div>
    </div>
    <div class="dates-bar">
        <div class="date-cell"><span>Issue Date</span><strong>${formatDate(invoice.date)}</strong></div>
        <div class="date-cell"><span>Due Date</span><strong>${formatDate(invoice.due_date)}</strong></div>
        ${invoice.paid_date ? `<div class="date-cell"><span>Paid On</span><strong>${formatDate(invoice.paid_date.split('T')[0])}</strong></div>` : ''}
    </div>
    <table><thead><tr><th style="width:45%">Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
    ${invoice.items.map(item => `<tr>
        <td>${escapeHtml(item.description)}</td>
        <td>${item.quantity}</td>
        <td>$${item.rate.toFixed(2)}</td>
        <td>$${item.amount.toFixed(2)}</td>
    </tr>`).join('')}
    </tbody></table>
    <div class="totals-wrap"><div class="totals">
        <div class="totals-row"><span>Subtotal</span><span>$${Number(invoice.subtotal).toFixed(2)}</span></div>
        <div class="totals-row"><span>Tax (10%)</span><span>$${Number(invoice.tax).toFixed(2)}</span></div>
        <hr class="totals-sep">
        <div class="totals-row totals-final"><span>Total Due</span><span>$${Number(invoice.total).toFixed(2)}</span></div>
    </div></div>
    ${invoice.notes ? `<div class="notes"><h4>Notes</h4><p>${escapeHtml(invoice.notes)}</p></div>` : ''}
    <div class="inv-footer">Generated by FreelanceCRM</div>
    </div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
}

// ── Account stats ─────────────────────────────────────────────

async function loadAccountStats() {
    const [clients, projects, invoices, hours, revenue] = await Promise.all([
        db.getClients(),
        db.getProjects(),
        db.getInvoices(),
        db.getTotalHours(),
        db.getTotalEarnings()
    ]);
    document.getElementById('account-clients-count').textContent  = clients.length;
    document.getElementById('account-projects-count').textContent = projects.length;
    document.getElementById('account-invoices-count').textContent = invoices.length;
    document.getElementById('account-hours-count').textContent    = `${hours}h`;
    document.getElementById('account-revenue').textContent        = `$${revenue.toFixed(2)}`;
}

// ── Form submissions ──────────────────────────────────────────

document.getElementById('client-form').addEventListener('submit', async e => {
    e.preventDefault();
    const client = {
        id:      document.getElementById('client-id').value,
        name:    document.getElementById('client-name').value,
        email:   document.getElementById('client-email').value,
        phone:   document.getElementById('client-phone').value,
        company: document.getElementById('client-company').value,
        address: document.getElementById('client-address').value
    };
    try {
        client.id ? await db.updateClient(client) : await db.addClient(client);
        closeAllModals();
        await Promise.all([loadClients(), loadDashboard()]);
        showToast(client.id ? 'Client updated.' : 'Client added.');
    } catch (err) { showToast('Failed to save client.', 'error'); }
});

document.getElementById('project-form').addEventListener('submit', async e => {
    e.preventDefault();
    const project = {
        id:         document.getElementById('project-id').value,
        name:       document.getElementById('project-name').value,
        clientId:   document.getElementById('project-client').value,
        hourlyRate: parseFloat(document.getElementById('project-rate').value),
        status:     document.getElementById('project-status').value
    };
    try {
        project.id ? await db.updateProject(project) : await db.addProject(project);
        closeAllModals();
        await Promise.all([loadProjects(), loadTimeTracker(), loadDashboard()]);
        showToast(project.id ? 'Project updated.' : 'Project added.');
    } catch (err) { showToast('Failed to save project.', 'error'); }
});

// ── Modals ────────────────────────────────────────────────────

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

window.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) closeAllModals();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
});

// ── Toast ─────────────────────────────────────────────────────

function showToast(message, type = 'success') {
    const toast       = document.getElementById('toast');
    toast.textContent = message;
    toast.className   = `toast toast-${type}`;
    toast.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// ── Helpers ───────────────────────────────────────────────────

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function formatDate(str) {
    if (!str) return '—';
    const d = new Date(str + (str.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(s) {
    return { active: 'Active', completed: 'Completed', 'on-hold': 'On Hold' }[s] || s;
}

// ── Account nav item ──────────────────────────────────────────

(function addAccountNav() {
    const nav = document.querySelector('.nav-menu');
    if (!nav) return;
    const btn        = document.createElement('button');
    btn.className    = 'nav-item';
    btn.dataset.view = 'account';
    btn.innerHTML    = `
        <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>
        <span>Account</span>`;
    btn.addEventListener('click', () => switchView('account'));
    nav.appendChild(btn);
})();
