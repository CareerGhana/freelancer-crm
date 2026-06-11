// ============================================================
// Database — Supabase backend
// All methods are async and return data directly.
// ============================================================

class Database {
    constructor() {
        this.userId = null;
        // In-memory cache so aggregate functions (used by the chart
        // and dashboard cards) don't need an extra round-trip.
        this._cache = {};
    }

    setUser(user) {
        this.userId = user.id;
        this._cache = {};
    }

    _bust() { this._cache = {}; }

    // ── internal helpers ─────────────────────────────────────

    async _all(table) {
        if (this._cache[table]) return this._cache[table];
        const { data, error } = await sb
            .from(table)
            .select('*')
            .eq('user_id', this.userId)
            .order('created_at', { ascending: false });
        if (error) { console.error(`db._all(${table})`, error); return []; }
        this._cache[table] = data;
        return data;
    }

    // ── Clients ──────────────────────────────────────────────

    async getClients() {
        return this._all('clients');
    }

    async getClientById(id) {
        const list = await this.getClients();
        return list.find(c => c.id === id) || null;
    }

    async addClient(client) {
        const { data, error } = await sb.from('clients').insert({
            user_id: this.userId,
            name:    client.name,
            email:   client.email    || '',
            phone:   client.phone    || '',
            company: client.company  || '',
            address: client.address  || ''
        }).select().single();
        if (error) throw error;
        this._bust();
        return data;
    }

    async updateClient(client) {
        const { error } = await sb.from('clients').update({
            name:    client.name,
            email:   client.email    || '',
            phone:   client.phone    || '',
            company: client.company  || '',
            address: client.address  || ''
        }).eq('id', client.id).eq('user_id', this.userId);
        if (error) throw error;
        this._bust();
    }

    async deleteClient(id) {
        const { error } = await sb.from('clients')
            .delete().eq('id', id).eq('user_id', this.userId);
        if (error) throw error;
        this._bust();
    }

    // ── Projects ─────────────────────────────────────────────

    async getProjects() {
        return this._all('projects');
    }

    async getProjectById(id) {
        const list = await this.getProjects();
        return list.find(p => p.id === id) || null;
    }

    async getProjectsByClient(clientId) {
        const list = await this.getProjects();
        return list.filter(p => p.client_id === clientId);
    }

    async addProject(project) {
        const { data, error } = await sb.from('projects').insert({
            user_id:     this.userId,
            client_id:   project.clientId   || null,
            name:        project.name,
            hourly_rate: project.hourlyRate  || 0,
            status:      project.status      || 'active'
        }).select().single();
        if (error) throw error;
        this._bust();
        return data;
    }

    async updateProject(project) {
        const { error } = await sb.from('projects').update({
            client_id:   project.clientId   || null,
            name:        project.name,
            hourly_rate: project.hourlyRate  || 0,
            status:      project.status
        }).eq('id', project.id).eq('user_id', this.userId);
        if (error) throw error;
        this._bust();
    }

    async deleteProject(id) {
        const { error } = await sb.from('projects')
            .delete().eq('id', id).eq('user_id', this.userId);
        if (error) throw error;
        this._bust();
    }

    // ── Time Entries ─────────────────────────────────────────

    async getTimeEntries() {
        return this._all('time_entries');
    }

    async getTimeEntriesByProject(projectId) {
        const list = await this.getTimeEntries();
        return list.filter(e => e.project_id === projectId);
    }

    async addTimeEntry(entry) {
        const { data, error } = await sb.from('time_entries').insert({
            user_id:     this.userId,
            project_id:  entry.projectId,
            description: entry.description || '',
            duration:    entry.duration    || 0,
            date:        entry.date        || new Date().toISOString().split('T')[0]
        }).select().single();
        if (error) throw error;
        this._bust();
        return data;
    }

    async updateTimeEntry(entry) {
        const { error } = await sb.from('time_entries').update({
            project_id:  entry.projectId,
            description: entry.description || '',
            duration:    entry.duration    || 0,
            date:        entry.date
        }).eq('id', entry.id).eq('user_id', this.userId);
        if (error) throw error;
        this._bust();
    }

    async deleteTimeEntry(id) {
        const { error } = await sb.from('time_entries')
            .delete().eq('id', id).eq('user_id', this.userId);
        if (error) throw error;
        this._bust();
    }

    // ── Invoices ─────────────────────────────────────────────

    async getInvoices() {
        return this._all('invoices');
    }

    async addInvoice(invoice) {
        const { data, error } = await sb.from('invoices').insert({
            user_id:   this.userId,
            client_id: invoice.clientId || null,
            number:    invoice.number,
            date:      invoice.date,
            due_date:  invoice.dueDate,
            notes:     invoice.notes    || '',
            items:     invoice.items    || [],
            subtotal:  invoice.subtotal || 0,
            tax:       invoice.tax      || 0,
            total:     invoice.total    || 0,
            status:    'unpaid'
        }).select().single();
        if (error) throw error;
        this._bust();
        return data;
    }

    async markInvoiceAsPaid(id) {
        const { error } = await sb.from('invoices').update({
            status:    'paid',
            paid_date: new Date().toISOString()
        }).eq('id', id).eq('user_id', this.userId);
        if (error) throw error;
        this._bust();
    }

    async deleteInvoice(id) {
        const { error } = await sb.from('invoices')
            .delete().eq('id', id).eq('user_id', this.userId);
        if (error) throw error;
        this._bust();
    }

    // ── Aggregates (all async) ────────────────────────────────

    async getProjectHours(projectId) {
        const entries = await this.getTimeEntriesByProject(projectId);
        return entries.reduce((s, e) => s + Number(e.duration), 0);
    }

    async getProjectEarnings(projectId) {
        const project = await this.getProjectById(projectId);
        if (!project) return 0;
        const hours = await this.getProjectHours(projectId);
        return hours * Number(project.hourly_rate);
    }

    async getTotalEarnings() {
        const projects = await this.getProjects();
        let total = 0;
        for (const p of projects) total += await this.getProjectEarnings(p.id);
        return total;
    }

    async getTotalHours() {
        const entries = await this.getTimeEntries();
        return entries.reduce((s, e) => s + Number(e.duration), 0);
    }

    async getUnpaidInvoicesTotal() {
        const invoices = await this.getInvoices();
        return invoices
            .filter(i => i.status === 'unpaid')
            .reduce((s, i) => s + Number(i.total), 0);
    }

    async getActiveProjectsCount() {
        const projects = await this.getProjects();
        return projects.filter(p => p.status === 'active').length;
    }

    async getEarningsByMonth() {
        const invoices = await this.getInvoices();
        const earnings = {};
        invoices.forEach(inv => {
            if (inv.status === 'paid' && inv.paid_date) {
                const m = inv.paid_date.substring(0, 7);
                earnings[m] = (earnings[m] || 0) + Number(inv.total);
            }
        });
        return earnings;
    }

    async getRecentActivity(limit = 6) {
        const activities = [];

        const entries  = await this.getTimeEntries();
        const projects = await this.getProjects();
        const invoices = await this.getInvoices();
        const clients  = await this.getClients();

        entries
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 3)
            .forEach(entry => {
                const project = projects.find(p => p.id === entry.project_id);
                activities.push({
                    type:        'time',
                    description: `Logged ${entry.duration}h on "${project?.name || 'Unknown'}"`,
                    date:        entry.date
                });
            });

        invoices
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 3)
            .forEach(inv => {
                const client = clients.find(c => c.id === inv.client_id);
                activities.push({
                    type:        'invoice',
                    description: `Invoice #${inv.number} created for ${client?.name || 'Unknown'}`,
                    date:        inv.created_at.split('T')[0]
                });
            });

        return activities
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
    }
}

const db = new Database();
