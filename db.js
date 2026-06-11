// ============================================================
// Database — localStorage, per-user namespace.
// ============================================================

class Database {
    constructor() {
        this.ns = 'default'; // overridden per user after login
    }

    setUserNamespace(userId) {
        this.ns = `user_${userId}`;
        this.initDB();
    }

    key(name) {
        return `${this.ns}_${name}`;
    }

    initDB() {
        if (!localStorage.getItem(this.key('clients')))     localStorage.setItem(this.key('clients'),     JSON.stringify([]));
        if (!localStorage.getItem(this.key('projects')))    localStorage.setItem(this.key('projects'),    JSON.stringify([]));
        if (!localStorage.getItem(this.key('timeEntries'))) localStorage.setItem(this.key('timeEntries'), JSON.stringify([]));
        if (!localStorage.getItem(this.key('invoices')))    localStorage.setItem(this.key('invoices'),    JSON.stringify([]));
        this.addSampleData();
    }

    addSampleData() {
        const clients = this.getClients();
        if (clients.length === 0) {
            const sampleClients = [
                { id: '1', name: 'Acme Corp',     email: 'billing@acme.com',        phone: '555-0101', company: 'Acme Corporation', address: '123 Business St, New York, NY' },
                { id: '2', name: 'TechStart Inc', email: 'accounts@techstart.com',  phone: '555-0102', company: 'TechStart',          address: '456 Innovation Ave, San Francisco, CA' }
            ];
            localStorage.setItem(this.key('clients'), JSON.stringify(sampleClients));

            const sampleProjects = [
                { id: '1', name: 'Website Redesign',       clientId: '1', hourlyRate: 75, status: 'active' },
                { id: '2', name: 'Mobile App Development', clientId: '2', hourlyRate: 85, status: 'active' }
            ];
            localStorage.setItem(this.key('projects'), JSON.stringify(sampleProjects));

            const sampleTimeEntries = [
                { id: '1', projectId: '1', description: 'Homepage design',  duration: 4, date: '2026-05-28' },
                { id: '2', projectId: '1', description: 'CSS styling',       duration: 3, date: '2026-05-29' },
                { id: '3', projectId: '2', description: 'API integration',   duration: 6, date: '2026-05-30' }
            ];
            localStorage.setItem(this.key('timeEntries'), JSON.stringify(sampleTimeEntries));
        }
    }

    // ── Clients ──────────────────────────────────────────────

    getClients() {
        return JSON.parse(localStorage.getItem(this.key('clients')) || '[]');
    }

    addClient(client) {
        const clients = this.getClients();
        client.id = Date.now().toString();
        clients.push(client);
        localStorage.setItem(this.key('clients'), JSON.stringify(clients));
        return client;
    }

    updateClient(client) {
        const clients = this.getClients();
        const idx = clients.findIndex(c => c.id === client.id);
        if (idx !== -1) { clients[idx] = client; localStorage.setItem(this.key('clients'), JSON.stringify(clients)); }
    }

    deleteClient(id) {
        const filtered = this.getClients().filter(c => c.id !== id);
        localStorage.setItem(this.key('clients'), JSON.stringify(filtered));
    }

    getClientById(id) { return this.getClients().find(c => c.id === id); }

    // ── Projects ─────────────────────────────────────────────

    getProjects() {
        return JSON.parse(localStorage.getItem(this.key('projects')) || '[]');
    }

    addProject(project) {
        const projects = this.getProjects();
        project.id = Date.now().toString();
        projects.push(project);
        localStorage.setItem(this.key('projects'), JSON.stringify(projects));
        return project;
    }

    updateProject(project) {
        const projects = this.getProjects();
        const idx = projects.findIndex(p => p.id === project.id);
        if (idx !== -1) { projects[idx] = project; localStorage.setItem(this.key('projects'), JSON.stringify(projects)); }
    }

    deleteProject(id) {
        const filtered = this.getProjects().filter(p => p.id !== id);
        localStorage.setItem(this.key('projects'), JSON.stringify(filtered));
    }

    getProjectById(id) { return this.getProjects().find(p => p.id === id); }
    getProjectsByClient(clientId) { return this.getProjects().filter(p => p.clientId === clientId); }

    // ── Time Entries ─────────────────────────────────────────

    getTimeEntries() {
        return JSON.parse(localStorage.getItem(this.key('timeEntries')) || '[]');
    }

    addTimeEntry(entry) {
        const entries = this.getTimeEntries();
        entry.id   = Date.now().toString();
        entry.date = new Date().toISOString().split('T')[0];
        entries.push(entry);
        localStorage.setItem(this.key('timeEntries'), JSON.stringify(entries));
        return entry;
    }

    deleteTimeEntry(id) {
        const filtered = this.getTimeEntries().filter(e => e.id !== id);
        localStorage.setItem(this.key('timeEntries'), JSON.stringify(filtered));
    }

    getTimeEntriesByProject(projectId) { return this.getTimeEntries().filter(e => e.projectId === projectId); }

    // ── Invoices ─────────────────────────────────────────────

    getInvoices() {
        return JSON.parse(localStorage.getItem(this.key('invoices')) || '[]');
    }

    addInvoice(invoice) {
        const invoices = this.getInvoices();
        invoice.id        = Date.now().toString();
        invoice.status    = 'unpaid';
        invoice.createdAt = new Date().toISOString();
        invoices.push(invoice);
        localStorage.setItem(this.key('invoices'), JSON.stringify(invoices));
        return invoice;
    }

    updateInvoice(invoice) {
        const invoices = this.getInvoices();
        const idx = invoices.findIndex(i => i.id === invoice.id);
        if (idx !== -1) { invoices[idx] = invoice; localStorage.setItem(this.key('invoices'), JSON.stringify(invoices)); }
    }

    deleteInvoice(id) {
        const filtered = this.getInvoices().filter(i => i.id !== id);
        localStorage.setItem(this.key('invoices'), JSON.stringify(filtered));
    }

    markInvoiceAsPaid(id) {
        const invoices = this.getInvoices();
        const invoice   = invoices.find(i => i.id === id);
        if (invoice) {
            invoice.status   = 'paid';
            invoice.paidDate = new Date().toISOString();
            localStorage.setItem(this.key('invoices'), JSON.stringify(invoices));
        }
    }

    // ── Aggregates ───────────────────────────────────────────

    getProjectHours(projectId) {
        return this.getTimeEntriesByProject(projectId).reduce((s, e) => s + e.duration, 0);
    }

    getProjectEarnings(projectId) {
        const project = this.getProjectById(projectId);
        if (!project) return 0;
        return this.getProjectHours(projectId) * project.hourlyRate;
    }

    getTotalEarnings() {
        return this.getProjects().reduce((t, p) => t + this.getProjectEarnings(p.id), 0);
    }

    getTotalHours() {
        return this.getTimeEntries().reduce((s, e) => s + e.duration, 0);
    }

    getUnpaidInvoicesTotal() {
        return this.getInvoices().filter(i => i.status === 'unpaid').reduce((s, i) => s + i.total, 0);
    }

    getActiveProjectsCount() {
        return this.getProjects().filter(p => p.status === 'active').length;
    }

    getEarningsByMonth() {
        const earnings = {};
        this.getInvoices().forEach(inv => {
            if (inv.status === 'paid' && inv.paidDate) {
                const m = inv.paidDate.substring(0, 7);
                earnings[m] = (earnings[m] || 0) + inv.total;
            }
        });
        return earnings;
    }

    getRecentActivity(limit = 6) {
        const activities = [];

        const timeEntries = this.getTimeEntries()
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 3);

        timeEntries.forEach(entry => {
            const project = this.getProjectById(entry.projectId);
            activities.push({
                type: 'time',
                description: `Logged ${entry.duration}h on "${project?.name || 'Unknown'}"`,
                date: entry.date
            });
        });

        const invoices = this.getInvoices()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 3);

        invoices.forEach(inv => {
            const client = this.getClientById(inv.clientId);
            activities.push({
                type: 'invoice',
                description: `Invoice #${inv.number} created for ${client?.name || 'Unknown'}`,
                date: inv.createdAt.split('T')[0]
            });
        });

        return activities
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
    }
}

const db = new Database();
