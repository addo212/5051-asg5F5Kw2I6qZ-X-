// reports.js

// ============================================================================
// Module Imports
// ============================================================================
import { auth, loadTransactions } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { formatRupiah } from './utils.js';

// ============================================================================
// Global Variables
// ============================================================================
let userId;
let allTransactions = [];
let expensePieChartInstance = null;
let trendLineChartInstance = null;

// ============================================================================
// Main Initialization
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid;
        try {
            const transactionsData = await loadTransactions(userId) || {};
            allTransactions = Object.values(transactionsData);
            setDefaultDateFilters();
        } catch (error) {
            console.error("Error loading initial data:", error);
        }
    } else {
        window.location.href = "index.html";
    }
});

// ============================================================================
// Event Listeners
// ============================================================================
document.getElementById('generateReportBtn')?.addEventListener('click', generateAndDisplayReport);

// ============================================================================
// Data Processing and Report Generation
// ============================================================================
function generateAndDisplayReport() {
    const startDate = new Date(document.getElementById('reportStartDate').value);
    const endDate = new Date(document.getElementById('reportEndDate').value);
    endDate.setHours(23, 59, 59, 999); // Set ke akhir hari

    if (isNaN(startDate) || isNaN(endDate)) {
        alert("Please select a valid date range.");
        return;
    }

    const filteredTransactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.timestamp);
        return txDate >= startDate && txDate <= endDate;
    });

    const reportData = processTransactionsForReport(filteredTransactions);
    updateReportUI(reportData);
}

function processTransactionsForReport(transactions) {
    let totalIncome = 0;
    let totalExpense = 0;
    const expenseByCategory = {};
    const trendData = {};

    transactions.forEach(tx => {
        const date = new Date(tx.timestamp).toISOString().split('T')[0];
        if (!trendData[date]) {
            trendData[date] = { income: 0, expense: 0 };
        }

        if (tx.type === 'income') {
            totalIncome += tx.amount;
            trendData[date].income += tx.amount;
        } else if (tx.type === 'expense') {
            totalExpense += tx.amount;
            trendData[date].expense += tx.amount;
            expenseByCategory[tx.account] = (expenseByCategory[tx.account] || 0) + tx.amount;
        }
    });

    return {
        totalIncome,
        totalExpense,
        netSavings: totalIncome - totalExpense,
        expenseByCategory,
        trendData
    };
}

// ============================================================================
// UI Update and Chart Rendering
// ============================================================================
function updateReportUI(data) {
    // Tampilkan kontainer laporan dan sembunyikan placeholder
    document.getElementById('reportSummary').style.display = 'grid';
    document.getElementById('chartsContainer').style.display = 'grid';
    document.getElementById('reportTableContainer').style.display = 'block';
    document.getElementById('reportPlaceholder').style.display = 'none';

    // Update kartu ringkasan
    document.getElementById('totalIncomeReport').textContent = formatRupiah(data.totalIncome);
    document.getElementById('totalExpenseReport').textContent = formatRupiah(data.totalExpense);
    document.getElementById('netSavingsReport').textContent = formatRupiah(data.netSavings);

    // Render grafik dan tabel
    renderExpensePieChart(data.expenseByCategory);
    renderTrendLineChart(data.trendData);
    renderReportTable(data.expenseByCategory, data.totalExpense);
}

function renderExpensePieChart(expenseData) {
    const ctx = document.getElementById('expensePieChart').getContext('2d');
    const labels = Object.keys(expenseData);
    const data = Object.values(expenseData);

    if (expensePieChartInstance) {
        expensePieChartInstance.destroy();
    }

    expensePieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expense by Category',
                data: data,
                backgroundColor: generateColors(labels.length),
                borderColor: 'var(--bg-secondary)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${formatRupiah(context.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

function renderTrendLineChart(trendData) {
    const ctx = document.getElementById('trendLineChart').getContext('2d');
    const sortedDates = Object.keys(trendData).sort();
    
    const labels = sortedDates;
    const incomeData = sortedDates.map(date => trendData[date].income);
    const expenseData = sortedDates.map(date => trendData[date].expense);

    if (trendLineChartInstance) {
        trendLineChartInstance.destroy();
    }

    trendLineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    borderColor: 'var(--income-color)',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'Expense',
                    data: expenseData,
                    borderColor: 'var(--expense-color)',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    fill: true,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatRupiah(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatRupiah(context.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

function renderReportTable(expenseData, totalExpense) {
    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = '';

    const sortedCategories = Object.entries(expenseData).sort(([, a], [, b]) => b - a);

    sortedCategories.forEach(([category, amount]) => {
        const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(2) : 0;
        const row = `
            <tr>
                <td>${category}</td>
                <td>${formatRupiah(amount)}</td>
                <td>${percentage}%</td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

// ============================================================================
// Helper Functions
// ============================================================================
function setDefaultDateFilters() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('reportStartDate').valueAsDate = firstDayOfMonth;
    document.getElementById('reportEndDate').valueAsDate = today;
}

function generateColors(count) {
    const colors = [
        '#3498db', '#e74c3c', '#9b59b6', '#2ecc71', '#f1c40f',
        '#1abc9c', '#e67e22', '#34495e', '#7f8c8d', '#d35400'
    ];
    let result = [];
    for (let i = 0; i < count; i++) {
        result.push(colors[i % colors.length]);
    }
    return result;
}
