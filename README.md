# Freelancer CRM + Invoice Tool

A complete dashboard for freelancers to manage clients, track billable hours, and generate PDF invoices.

## Features

- **Client Management** - Add, edit, and delete clients with contact information
- **Project Management** - Track projects per client with hourly rates
- **Time Tracker** - Log billable hours with timer or manual entry
- **Invoice Generation** - Create professional invoices with line items
- **Dashboard** - View earnings, active projects, and recent activity
- **PDF Export** - Download invoices as PDF files

## Quick Start

1. Save all files in the same directory:
   - `index.html`
   - `styles.css`
   - `db.js`
   - `app.js`

2. Open `index.html` in a modern web browser

No server or database required - all data is stored locally in your browser.

## Usage

### Adding a Client
1. Click "Clients" in sidebar
2. Click "+ Add Client"
3. Fill in client details and save

### Creating a Project
1. Click "Projects" in sidebar
2. Click "+ Add Project"
3. Select client, set hourly rate, and save

### Tracking Time
1. Click "Time Tracker"
2. Select a project
3. Click "Start Timer"
4. Add description when stopping
5. Timer automatically logs hours

### Creating an Invoice
1. Click "Invoices"
2. Click "+ Create Invoice"
3. Select client and add line items
4. Generate invoice
5. Download as PDF

## Technologies

- HTML5
- CSS3 (with Grid/Flexbox)
- JavaScript (ES6+)
- Chart.js for visualizations
- LocalStorage for data persistence

## Browser Support

Works on all modern browsers (Chrome, Firefox, Safari, Edge)

## License

MIT