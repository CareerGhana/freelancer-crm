// Database operations using localStorage
class Database {
    constructor() {
        this.initDB();
    }

    initDB() {
        if (!localStorage.getItem('clients')) {
            localStorage.setItem('clients', JSON.stringify([]));
        }
        if (!localStorage.getItem('projects')) {
            localStorage.setItem('projects', JSON.stringify([]));
        }
        if (!localStorage.getItem('timeEntries')) {
            localStorage.setItem('timeEntries', JSON.stringify([]));
        }
        if (!localStorage.getItem('invoices')) {
            localStorage.setItem('invoices', JSON.stringify([]));
        }
        // Add sample data
        this.addSampleData();
    }

    addSampleData() {
        const clients = this.getClients();
        if (clients.length === 0) {
            const sampleClients = [
                { id: '1', name: 'Acme Corp', email: 'billing@acme.com', phone: '555-0101', company: 'Acme Corporation', address: '123 Business St, NYC' },
                { id: '2', name: 'TechStart Inc', email: 'accounts@techstart.com', phone: '555-0102', company: 'TechStart', address: '456 Innovation Ave, SF' }
            ];
            localStorage.setItem('clients', JSON.stringify(sampleClients));

            const sampleProjects = [
                { id: '1', name: 'Website Redesign', clientId: '1', hourlyRate: 75, status: 'active' },
                { id: '2', name: 'Mobile App Development', clientId: '2', hourlyRate: 85, status: 'active' }
            ];
            localStorage.setItem('projects', JSON.stringify(sampleProjects));

            const sampleTimeEntries = [
                { id: '1', projectId: '1', description: 'Homepage design', duration: 4, date: '2026-05-28' },
                { id: '2', projectId: '1', description: 'CSS styling', duration: 3, date: '2026-05-29' },
                { id: '3', projectId: '2', description: 'API integration', duration: 6, date: '2026-05-30' }
            ];
            localStorage.setItem('timeEntries', JSON.stringify(sampleTimeEntries));
        }
    }

    // Clients
    getClients() {
        return JSON.parse(localStorage.getItem('clients'));
    }

    addClient(client) {
        const clients = this.getClients();
        client.id = Date.now().toString();
        clients.push(client);
        localStorage.setItem('clients', JSON.stringify(clients));
        return client;
    }

    updateClient(client) {
        const clients = this.getClients();
        const index = clients.findIndex(c => c.id === client.id);
        if (index !== -1) {
            clients[index] = client;
            localStorage.setItem('clients', JSON.stringify(clients));
        }
    }

    deleteClient(id) {
        const clients = this.getClients();
        const filtered = clients.filter(c => c.id !== id);
        localStorage.setItem('clients', JSON.stringify(filtered));
    }

    // Projects
    getProjects() {
        return JSON.parse(localStorage.getItem('projects'));
    }

    addProject(project) {
        const projects = this.getProjects();
        project.id = Date.now().toString();
        projects.push(project);
        localStorage.setItem('projects', JSON.stringify(projects));
        return project;
    }

    updateProject(project) {
        const projects = this.getProjects();
        const index = projects.findIndex(p => p.id === project.id);
        if (index !== -1) {
            projects[index] = project;
            localStorage.setItem('projects', JSON.stringify(projects));
        }
    }

    deleteProject(id) {
        const projects = this.getProjects();
        const filtered = projects.filter(p => p.id !== id);
        localStorage.setItem('projects', JSON.stringify(filtered));
    }

    // Time Entries
    getTimeEntries() {
        return JSON.parse(localStorage.getItem('timeEntries'));
    }

    addTimeEntry(entry) {
        const entries = this.getTimeEntries();
        entry.id = Date.now().toString();
        entry.date = new Date().toISOString().split('T')[0];
        entries.push(entry);
        localStorage.setItem('timeEntries', JSON.stringify(entries));
        return entry;
    }

    deleteTimeEntry(id) {
        const entries = this.getTimeEntries();
        const filtered = entries.filter(e => e.id !== id);
        localStorage.setItem('timeEntries', JSON.stringify(filtered));
    }

    // Invoices
    getInvoices() {
        return JSON.parse(localStorage.getItem('invoices'));
    }

    addInvoice(invoice) {
        const invoices = this.getInvoices();
        invoice.id = Date.now().toString();
        invoice.status = 'unpaid';
        invoice.createdAt = new Date().toISOString();
        invoices.push(invoice);
        localStorage.setItem('invoices', JSON.stringify(invoices));
        return invoice;
    }

    updateInvoice(invoice) {
        const invoices = this.getInvoices();
        const index = invoices.findIndex(i => i.id === invoice.id);
        if (index !== -1) {
            invoices[index] = invoice;
            localStorage.setItem('invoices', JSON.stringify(invoices));
        }
    }

    deleteInvoice(id) {
        const invoices = this.getInvoices();
        const filtered = invoices.filter(i => i.id !== id);
        localStorage.setItem('invoices', JSON.stringify(filtered));
    }

    markInvoiceAsPaid(id) {
        const invoices = this.getInvoices();
        const invoice = invoices.find(i => i.id === id);
        if (invoice) {
            invoice.status = 'paid';
            invoice.paidDate = new Date().toISOString();
            localStorage.setItem('invoices', JSON.stringify(invoices));
        }
    }

    // Helper methods
    getClientById(id) {
        return this.getClients().find(c => c.id === id);
    }

    getProjectById(id) {
        return this.getProjects().find(p => p.id === id);
    }

    getProjectsByClient(clientId) {
        return this.getProjects().filter(p => p.clientId === clientId);
    }

    getTimeEntriesByProject(projectId) {
        return this.getTimeEntries().filter(e => e.projectId === projectId);
    }

    getProjectHours(projectId) {
        const entries = this.getTimeEntriesByProject(projectId);
        return entries.reduce((sum, e) => sum + e.duration, 0);
    }

    getProjectEarnings(projectId) {
        const project = this.getProjectById(projectId);
        if (!project) return 0;
        const hours = this.getProjectHours(projectId);
        return hours * project.hourlyRate;
    }

    getTotalEarnings() {
        const projects = this.getProjects();
        let total = 0;
        projects.forEach(project => {
            total += this.getProjectEarnings(project.id);
        });
        return total;
    }

    getTotalHours() {
        const entries = this.getTimeEntries();
        return entries.reduce((sum, e) => sum + e.duration, 0);
    }

    getUnpaidInvoicesTotal() {
        const invoices = this.getInvoices();
        const unpaid = invoices.filter(i => i.status === 'unpaid');
        return unpaid.reduce((sum, i) => sum + i.total, 0);
    }

    getActiveProjectsCount() {
        return this.getProjects().filter(p => p.status === 'active').length;
    }

    getEarningsByMonth() {
        const earnings = {};
        const invoices = this.getInvoices();
        invoices.forEach(invoice => {
            if (invoice.status === 'paid' && invoice.paidDate) {
                const month = invoice.paidDate.substring(0, 7);
                earnings[month] = (earnings[month] || 0) + invoice.total;
            }
        });
        return earnings;
    }

    getRecentActivity(limit = 5) {
        const activities = [];
        
        // Add recent time entries
        const timeEntries = this.getTimeEntries();
        timeEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
        timeEntries.slice(0, 3).forEach(entry => {
            const project = this.getProjectById(entry.projectId);
            activities.push({
                type: 'time',
                description: `Logged ${entry.duration}h on "${project?.name}"`,
                date: entry.date
            });
        });
        
        // Add recent invoices
        const invoices = this.getInvoices();
        invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        invoices.slice(0, 2).forEach(invoice => {
            const client = this.getClientById(invoice.clientId);
            activities.push({
                type: 'invoice',
                description: `Created invoice #${invoice.number} for ${client?.name}`,
                date: invoice.createdAt.split('T')[0]
            });
        });
        
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        return activities.slice(0, limit);
    }
}

const db = new Database();