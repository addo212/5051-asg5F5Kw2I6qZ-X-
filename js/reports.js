// js/reports.js

// ============================================================================
// MODULE IMPORTS
// ============================================================================
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { formatRupiah } from './utils.js';

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// ============================================================================
// GLOBAL STATE
// ============================================================================
let userId;
let allTransactions = [];
let mainChartInstance = null;
let secondaryChartInstance = null;

// ============================================================================
// AUTHENTICATION & INITIALIZATION
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeReportsPage();
    } else {
        window.location.href = "index.html";
    }
});

async function initializeReportsPage() {
    setupEventListeners();
    try {
        const transactionsData = (await get(ref(database, `users/${userId}/transactions`))).val() || {};
        allTransactions = Object.values(transactionsData);
        // Generate default report for "This Month"
        generateReport();
    } catch (error) {
        console.error("Error initializing reports page:", error);
        document.getElementById('reportsContainer').innerHTML = `<p class="empty-state">Failed to load data. Please refresh.</p>`;
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
    document.getElementById('printReportBtn').addEventListener('click', () => window.print());
    document.getElementById('dateRange').addEventListener('change', (e) => {
        const customDateRange = document.getElementById('customDateRange');
        customDateRange.style.display = e.target.value === 'custom' ? 'flex' : 'none';
    });
}

// ============================================================================
// CORE REPORT GENERATION LOGIC
// ============================================================================
function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const dateRange = getDateRange();
    
    if (!dateRange) {
        alert("Please select a valid date range.");
        return;
    }

    const filteredTransactions = allTransactions.filter(tx => {
        return tx.timestamp >= dateRange.start && tx.timestamp <= dateRange.end;
    });

    let reportData;
    switch (reportType) {
        case 'income_vs_expense':
            reportData = processIncomeVsExpense(filteredTransactions);
            break;
        case 'expense_by_category':
            reportData = processByCategory(filteredTransactions, 'expense');
            break;
        case 'income_by_category':
            reportData = processByCategory(filteredTransactions, 'income');
            break;
        case 'cash_flow':
            reportData = processCashFlow(filteredTransactions);
            break;
        default:
            console.error("Unknown report type:", reportType);
            return;
    }

    displayReport(reportData);
}

// ============================================================================
// DATA PROCESSING FUNCTIONS
// ============================================================================
function processIncomeVsExpense(transactions) {
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(tx => {
        if (tx.type === 'income') totalIncome += tx.amount;
        if (tx.type === 'expense') totalExpense += tx.amount;
    });

    const netIncome = totalIncome - totalExpense;

    return {
        title: "Income vs. Expense",
        summary: [
            { label: 'Total Income', value: formatRupiah(totalIncome), class: 'income' },
            { label: 'Total Expense', value: formatRupiah(totalExpense), class: 'expense' },
            { label: 'Net Income', value: formatRupiah(netIncome), class: 'net' }
        ],
        charts: [
            {
                id: 'mainChart',
                title: 'Income vs. Expense Breakdown',
                type: 'doughnut',
                data: {
                    labels: ['Income', 'Expense'],
                    datasets: [{
                        data: [totalIncome, totalExpense],
                        backgroundColor: ['var(--income-color)', 'var(--expense-color)']
                    }]
                }
            }
        ],
        table: {
            headers: ['Date', 'Description', 'Type', 'Amount'],
            rows: transactions.map(tx => [
                tx.date,
                tx.description,
                tx.type,
                formatRupiah(tx.amount)
            ])
        }
    };
}

function processByCategory(transactions, type) {
    const categoryMap = new Map();
    let totalAmount = 0;

    transactions.filter(tx => tx.type === type).forEach(tx => {
        const currentAmount = categoryMap.get(tx.account) || 0;
        categoryMap.set(tx.account, currentAmount + tx.amount);
        totalAmount += tx.amount;
    });

    const sortedCategories = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]);
    const labels = sortedCategories.map(entry => entry[0]);
    const data = sortedCategories.map(entry => entry[1]);

    return {
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} by Category`,
        summary: [
            { label: `Total ${type}`, value: formatRupiah(totalAmount), class: type }
        ],
        charts: [
            {
                id: 'mainChart',
                title: 'Breakdown by Category',
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: generateColors(labels.length)
                    }]
                }
            },
            {
                id: 'secondaryChart',
                title: 'Top Categories',
                type: 'bar',
                data: {
                    labels: labels.slice(0, 10), // Top 10
                    datasets: [{
                        label: 'Amount',
                        data: data.slice(0, 10),
                        backgroundColor: 'rgba(var(--accent-color-rgb), 0.7)'
                    }]
                }
            }
        ],
        table: {
            headers: ['Category', 'Amount', 'Percentage'],
            rows: sortedCategories.map(([category, amount]) => [
                category,
                formatRupiah(amount),
                `${((amount / totalAmount) * 100).toFixed(2)}%`
            ])
        }
    };
}

function processCashFlow(transactions) {
    const flowMap = new Map();

    transactions.forEach(tx => {
        const date = tx.date;
        if (!flowMap.has(date)) {
            flowMap.set(date, { income: 0, expense: 0 });
        }
        const dayData = flowMap.get(date);
        if (tx.type === 'income') {
            dayData.income += tx.amount;
        } else {
            dayData.expense += tx.amount;
        }
    });

    const sortedFlow = [...flowMap.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]));
    const labels = sortedFlow.map(entry => entry[0]);
    const incomeData = sortedFlow.map(entry => entry[1].income);
    const expenseData = sortedFlow.map(entry => entry[1].expense);

    return {
        title: "Cash Flow Over Time",
        summary: [],
        charts: [
            {
                id: 'mainChart',
                title: 'Daily Cash Flow',
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Income', data: incomeData, backgroundColor: 'var(--income-color)' },
                        { label: 'Expense', data: expenseData, backgroundColor: 'var(--expense-color)' }
                    ]
                },
                options: { scales: { x: { stacked: true }, y: { stacked: true } } }
            }
        ],
        table: {
            headers: ['Date', 'Income', 'Expense', 'Net'],
            rows: sortedFlow.map(([date, { income, expense }]) => [
                date,
                formatRupiah(income),
                formatRupiah(expense),
                formatRupiah(income - expense)
            ])
        }
    };
}

// ============================================================================
// UI RENDERING FUNCTIONS
// ============================================================================
function displayReport(reportData) {
    displayReportSummary(reportData.summary);
    displayCharts(reportData.charts);
    displayReportTable(reportData.table);
}

function displayReportSummary(summaryData) {
    const summaryContainer = document.getElementById('reportSummary');
    if (!summaryData || summaryData.length === 0) {
        summaryContainer.innerHTML = '';
        return;
    }
    summaryContainer.innerHTML = summaryData.map(item => `
        <div class="report-card ${item.class}">
            <h4>${item.label}</h4>
            <p>${item.value}</p>
        </div>
    `).join('');
}

function displayCharts(chartsData = []) {
    if (mainChartInstance) mainChartInstance.destroy();
    if (secondaryChartInstance) secondaryChartInstance.destroy();
    
    const chart1Container = document.getElementById('mainChart').parentElement;
    const chart2Container = document.getElementById('secondaryChart').parentElement;
    
    chart1Container.style.display = 'none';
    chart2Container.style.display = 'none';

    if (chartsData[0]) {
        chart1Container.style.display = 'block';
        document.getElementById('chart1Title').textContent = chartsData[0].title;
        mainChartInstance = new Chart(document.getElementById('mainChart'), {
            type: chartsData[0].type,
            data: chartsData[0].data,
            options: { responsive: true, maintainAspectRatio: false, ...chartsData[0].options }
        });
    }

    if (chartsData[1]) {
        chart2Container.style.display = 'block';
        document.getElementById('chart2Title').textContent = chartsData[1].title;
        secondaryChartInstance = new Chart(document.getElementById('secondaryChart'), {
            type: chartsData[1].type,
            data: chartsData[1].data,
            options: { responsive: true, maintainAspectRatio: false, ...chartsData[1].options }
        });
    }
}

function displayReportTable(tableData) {
    const head = document.getElementById('reportTableHead');
    const body = document.getElementById('reportTableBody');
    
    head.innerHTML = `<tr>${tableData.headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    
    if (tableData.rows.length === 0) {
        body.innerHTML = `<tr><td colspan="${tableData.headers.length}" class="empty-state">No data for this report.</td></tr>`;
    } else {
        body.innerHTML = tableData.rows.map(row => 
            `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
        ).join('');
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function getDateRange() {
    const rangeType = document.getElementById('dateRange').value;
    const now = new Date();
    let start, end;

    switch (rangeType) {
        case 'this_month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'last_month':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;
        case 'this_year':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
        case 'all_time':
            start = new Date(0); // Epoch time
            end = new Date();
            break;
        case 'custom':
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            if (!startDate || !endDate) return null;
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59); // Include the whole end day
            break;
    }
    return { start: start.getTime(), end: end.getTime() };
}

function generateColors(numColors) {
    const colors = [];
    const baseColors = [
        '#4ecca3', '#ff6b6b', '#3498db', '#9b59b6', '#f1c40f', 
        '#e67e22', '#1abc9c', '#34495e', '#e74c3c', '#2ecc71'
    ];
    for (let i = 0; i < numColors; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
}
