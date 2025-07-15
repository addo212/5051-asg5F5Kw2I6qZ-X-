// budgets.js

// ============================================================================
// Module Imports
// ============================================================================
import { auth, loadUserData, loadTransactions, saveBudget, deleteBudget, loadBudgetPeriods } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { formatRupiah } from './utils.js';

// ============================================================================
// Global Variables
// ============================================================================
let userId;
let currentPeriod = ''; // Format: "YYYY-MM"
let availablePeriods = [];
// Variabel global untuk menyimpan instance chart
let budgetPieChart = null;
let budgetBarChart = null;

// ============================================================================
// Main Initialization
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeBudgetsPage();
    } else {
        window.location.href = "index.html";
    }
});

async function initializeBudgetsPage() {
    try {
        const now = new Date();
        currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        populateYearDropdowns();
        
        document.getElementById('budgetPeriodMonth').value = currentPeriod.split('-')[1];
        document.getElementById('budgetPeriodYear').value = currentPeriod.split('-')[0];
        
        const userData = await loadUserData(userId);
        if (!userData) throw new Error("User data not found.");

        const expenseAccounts = userData.accounts?.expense || [];
        populateCategoryDropdown(expenseAccounts);
        
        availablePeriods = await loadBudgetPeriods(userId);
        
        await loadAndDisplayBudgetsForPeriod(currentPeriod);
        
        updateCurrentPeriodDisplay(currentPeriod);
        
        setupEventListeners();

    } catch (error) {
        console.error("Error initializing budgets page:", error);
        document.getElementById('budgetTableBody').innerHTML = `<tr><td colspan="6" class="empty-state">${error.message}</td></tr>`;
    }
}

// ============================================================================
// Period Management
// ============================================================================
function populateYearDropdowns() {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    const endYear = currentYear + 1;
    
    const yearDropdowns = ['budgetPeriodYear', 'customBudgetYear'];
    
    yearDropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        
        dropdown.innerHTML = '';
        for (let year = startYear; year <= endYear; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.text = year;
            if (year === currentYear) {
                option.selected = true;
            }
            dropdown.appendChild(option);
        }
    });
}

function updateCurrentPeriodDisplay(period) {
    const [year, month] = period.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(month) - 1];
    document.getElementById('currentPeriodDisplay').textContent = `${monthName} ${year}`;
}

async function loadAndDisplayBudgetsForPeriod(period) {
    try {
        const userData = await loadUserData(userId);
        const periodBudgets = userData?.budgets?.[period] || {};
        const allTransactions = await loadTransactions(userId) || {};
        
        const processedBudgets = processBudgets(periodBudgets, allTransactions, period);
        
        displayBudgets(processedBudgets, period);
    } catch (error) {
        console.error("Error loading budgets for period:", error);
        document.getElementById('budgetTableBody').innerHTML = `<tr><td colspan="6" class="empty-state">Error loading budgets: ${error.message}</td></tr>`;
    }
}

// ============================================================================
// Data Processing
// ============================================================================
function processBudgets(budgets, transactions, period) {
    const [year, month] = period.split('-').map(Number);
    
    for (const category in budgets) {
        budgets[category].spent = 0;
    }
    
    for (const txId in transactions) {
        const tx = transactions[txId];
        const txDate = new Date(tx.timestamp);
        
        if (tx.type === 'expense' && txDate.getFullYear() === year && txDate.getMonth() + 1 === month) {
            if (budgets[tx.account]) {
                budgets[tx.account].spent += tx.amount;
            }
        }
    }
    
    return budgets;
}

// ============================================================================
// UI Display Functions (PERUBAHAN UTAMA DI SINI)
// ============================================================================
function populateCategoryDropdown(expenseAccounts) {
    const select = document.getElementById('budgetCategory');
    if (!select) return;
    select.innerHTML = '<option value="">Select a category...</option>';
    expenseAccounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        select.appendChild(option);
    });
}

/**
 * Fungsi utama untuk menampilkan semua visualisasi budget.
 */
function displayBudgets(budgets, period) {
    displayBudgetTable(budgets, period);
    displayBudgetCharts(budgets);
}

/**
 * Fungsi untuk merender data budget ke dalam tabel.
 */
function displayBudgetTable(budgets, period) {
    const tableBody = document.getElementById('budgetTableBody');
    if (!tableBody) return;

    if (Object.keys(budgets).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No budgets found for this period.</td></tr>';
        return;
    }

    const sortedBudgets = Object.values(budgets).sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit));

    let html = '';
    sortedBudgets.forEach(budget => {
        const percentage = budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0;
        const remaining = budget.limit - budget.spent;

        let progressBarClass = 'safe';
        if (percentage > 75) progressBarClass = 'warning';
        if (percentage >= 100) progressBarClass = 'danger';

        html += `
            <tr>
                <td>${budget.category}</td>
                <td>${formatRupiah(budget.limit)}</td>
                <td>${formatRupiah(budget.spent)}</td>
                <td>${formatRupiah(remaining)}</td>
                <td>
                    <div class="table-progress-bar">
                        <div class="table-progress-fill ${progressBarClass}" style="width: ${Math.min(percentage, 100)}%;"></div>
                    </div>
                    <small>${percentage.toFixed(1)}%</small>
                </td>
                <td class="table-actions">
                    <button class="delete-btn" data-period="${period}" data-category="${budget.category}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
    attachDeleteListeners();
}

/**
 * Fungsi untuk merender data budget ke dalam chart.
 */
function displayBudgetCharts(budgets) {
    const categories = Object.keys(budgets);
    const spentData = categories.map(cat => budgets[cat].spent);
    const limitData = categories.map(cat => budgets[cat].limit);

    const pieCtx = document.getElementById('budgetPieChart').getContext('2d');
    const barCtx = document.getElementById('budgetBarChart').getContext('2d');

    const chartColors = ['#3498db', '#e74c3c', '#9b59b6', '#2ecc71', '#f1c40f', '#1abc9c', '#e67e22', '#34495e'];

    // Hancurkan chart lama sebelum membuat yang baru
    if (budgetPieChart) budgetPieChart.destroy();
    if (budgetBarChart) budgetBarChart.destroy();

    // Pie Chart untuk distribusi pengeluaran
    budgetPieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: spentData,
                backgroundColor: chartColors,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Spending Distribution' }
            }
        }
    });

    // Bar Chart untuk perbandingan limit vs pengeluaran
    budgetBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [
                {
                    label: 'Spent',
                    data: spentData,
                    backgroundColor: 'rgba(231, 76, 60, 0.7)',
                },
                {
                    label: 'Limit',
                    data: limitData,
                    backgroundColor: 'rgba(52, 152, 219, 0.7)',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Budget vs. Actual Spending' }
            }
        }
    });
}

// ============================================================================
// Event Listeners
// ============================================================================
function setupEventListeners() {
    document.getElementById('viewBudgetPeriodBtn')?.addEventListener('click', () => {
        const month = document.getElementById('budgetPeriodMonth').value;
        const year = document.getElementById('budgetPeriodYear').value;
        currentPeriod = `${year}-${month}`;
        updateCurrentPeriodDisplay(currentPeriod);
        loadAndDisplayBudgetsForPeriod(currentPeriod);
    });
    
    document.getElementById('newBudgetPeriod')?.addEventListener('change', (e) => {
        document.getElementById('customPeriodFields').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
    
    document.getElementById('addBudgetForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let period = currentPeriod;
        if (document.getElementById('newBudgetPeriod').value === 'custom') {
            const month = document.getElementById('customBudgetMonth').value;
            const year = document.getElementById('customBudgetYear').value;
            period = `${year}-${month}`;
        }
        
        const category = document.getElementById('budgetCategory').value;
        const limit = parseFloat(document.getElementById('budgetLimit').value);

        if (!category || isNaN(limit) || limit <= 0) {
            showError("Please select a category and enter a valid limit.");
            return;
        }

        try {
            await saveBudget(userId, period, category, limit);
            showSuccessMessage("Budget created successfully!");
            e.target.reset();
            if (!availablePeriods.includes(period)) availablePeriods.push(period);
            if (period === currentPeriod) await loadAndDisplayBudgetsForPeriod(currentPeriod);
        } catch (error) {
            console.error("Error saving budget:", error);
            showError("Failed to save budget.");
        }
    });
}

function attachDeleteListeners() {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const period = button.dataset.period;
            const category = button.dataset.category;
            
            if (confirm(`Are you sure you want to delete the budget for "${category}"?`)) {
                try {
                    await deleteBudget(userId, period, category);
                    showSuccessMessage("Budget deleted successfully!");
                    await loadAndDisplayBudgetsForPeriod(currentPeriod);
                } catch (error) {
                    console.error("Error deleting budget:", error);
                    showError("Failed to delete budget.");
                }
            }
        });
    });
}

// ============================================================================
// UI Helper Functions
// ============================================================================
function showError(message) {
    const errorEl = document.getElementById('budgetError');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
    }
}

function showSuccessMessage(message) {
    alert(message);
}
