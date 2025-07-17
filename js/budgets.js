// js/budgets.js

// ============================================================================
// MODULE IMPORTS
// ============================================================================
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    get, 
    set, 
    update, 
    remove 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
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
let expenseAccounts = {};
let doughnutChartInstance = null;
let barChartInstance = null;

// ============================================================================
// AUTHENTICATION & INITIALIZATION
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
    setupEventListeners();
    populatePeriodFilters();
    try {
        const userData = await loadInitialData();
        expenseAccounts = userData.expenseAccounts || {};
        populateCategoryDropdown(expenseAccounts);
        await loadAndDisplayBudgetsForCurrentPeriod();
    } catch (error) {
        console.error("Error initializing budgets page:", error);
        displayError("Failed to load initial data. Please refresh.");
    }
}

async function loadInitialData() {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    return snapshot.val() || {};
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
    // Filter
    document.getElementById('applyPeriodFilterBtn').addEventListener('click', loadAndDisplayBudgetsForCurrentPeriod);

    // Add/Edit Budget Modal
    document.getElementById('addBudgetBtn').addEventListener('click', openAddBudgetModal);
    document.querySelector('#addBudgetModal .close-modal').addEventListener('click', () => {
        document.getElementById('addBudgetModal').classList.remove('show');
    });
    document.getElementById('addBudgetForm').addEventListener('submit', handleSaveBudget);

    // Table Actions (Edit/Delete) using Event Delegation
    document.getElementById('budgetTableBody').addEventListener('click', handleTableActions);
}

// ============================================================================
// DATA LOADING AND PROCESSING
// ============================================================================
async function loadAndDisplayBudgetsForCurrentPeriod() {
    const month = document.getElementById('periodMonth').value;
    const year = document.getElementById('periodYear').value;
    const period = `${year}-${month}`;

    try {
        const [budgetsData, transactionsData] = await Promise.all([
            get(ref(database, `users/${userId}/budgets/${period}`)),
            get(ref(database, `users/${userId}/transactions`))
        ]);

        let budgets = budgetsData.val() || {};
        const transactions = transactionsData.val() || {};

        // Recalculate spending for accuracy
        budgets = calculateSpending(budgets, transactions, period);

        displayBudgets(budgets, period);

    } catch (error) {
        console.error(`Error loading budgets for period ${period}:`, error);
        displayError(`Could not load budgets for ${period}.`);
    }
}

function calculateSpending(budgets, transactions, period) {
    const [year, month] = period.split('-').map(Number);

    // 1. Reset all 'spent' values for the current period's budgets
    const calculatedBudgets = { ...budgets };
    for (const category in calculatedBudgets) {
        calculatedBudgets[category].spent = 0;
    }

    // 2. Iterate through all transactions
    for (const txId in transactions) {
        const tx = transactions[txId];
        if (tx.type === 'expense') {
            const txDate = new Date(tx.timestamp);
            // 3. Check if the transaction belongs to the selected period
            if (txDate.getFullYear() === year && (txDate.getMonth() + 1) === month) {
                // 4. If a budget exists for the transaction's category, add the amount
                if (calculatedBudgets[tx.account]) {
                    calculatedBudgets[tx.account].spent += tx.amount;
                }
            }
        }
    }
    return calculatedBudgets;
}

// ============================================================================
// CRUD HANDLERS
// ============================================================================
async function handleSaveBudget(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('#budgetSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const period = `${document.getElementById('periodYear').value}-${document.getElementById('periodMonth').value}`;
    const category = form.budgetCategory.value;
    const limit = parseFloat(form.budgetLimit.value);

    try {
        const budgetRef = ref(database, `users/${userId}/budgets/${period}/${category}`);
        
        // Check if budget already exists to preserve spent amount
        const snapshot = await get(budgetRef);
        const existingBudget = snapshot.val();
        const spent = existingBudget ? existingBudget.spent : 0;

        const newBudget = {
            limit: limit,
            spent: spent // Preserve spent amount if editing
        };

        await set(budgetRef, newBudget);
        
        alert('Budget saved successfully!');
        document.getElementById('addBudgetModal').classList.remove('show');
        await loadAndDisplayBudgetsForCurrentPeriod();

    } catch (error) {
        console.error("Error saving budget:", error);
        alert(`Failed to save budget: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Budget';
    }
}

async function handleDeleteBudget(period, category) {
    if (!confirm(`Are you sure you want to delete the budget for "${category}"?`)) return;

    try {
        const budgetRef = ref(database, `users/${userId}/budgets/${period}/${category}`);
        await remove(budgetRef);
        alert('Budget deleted successfully!');
        await loadAndDisplayBudgetsForCurrentPeriod();
    } catch (error) {
        console.error("Error deleting budget:", error);
        alert(`Failed to delete budget: ${error.message}`);
    }
}

// ============================================================================
// UI RENDERING & MANIPULATION
// ============================================================================
function displayBudgets(budgets, period) {
    let totalLimit = 0;
    let totalSpent = 0;
    
    Object.values(budgets).forEach(budget => {
        totalLimit += budget.limit || 0;
        totalSpent += budget.spent || 0;
    });
    
    displayBudgetSummary(totalLimit, totalSpent);
    displayBudgetTable(budgets, period);
    displayBudgetCharts(budgets);
}

function displayBudgetSummary(totalLimit, totalSpent) {
    const summaryElement = document.getElementById('budgetSummary');
    if (!summaryElement) return;

    const remaining = totalLimit - totalSpent;
    const percentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
    
    let statusClass = 'safe';
    if (percentage > 75) statusClass = 'warning';
    if (percentage >= 90) statusClass = 'danger';
    
    summaryElement.innerHTML = `
        <div class="summary-item">
            <h3>Total Budget</h3>
            <p>${formatRupiah(totalLimit)}</p>
        </div>
        <div class="summary-item">
            <h3>Total Spent</h3>
            <p>${formatRupiah(totalSpent)}</p>
        </div>
        <div class="summary-item">
            <h3>Remaining</h3>
            <p class="${statusClass}">${formatRupiah(remaining)}</p>
        </div>
        <div class="summary-item">
            <h3>Progress</h3>
            <div class="summary-progress">
                <div class="table-progress-bar">
                    <div class="table-progress-fill ${statusClass}" style="width: ${Math.min(percentage, 100)}%;"></div>
                </div>
                <span>${percentage.toFixed(1)}%</span>
            </div>
        </div>
    `;
}

function displayBudgetTable(budgets, period) {
    const tableBody = document.getElementById('budgetTableBody');
    const tableFooter = document.getElementById('budgetTableFooter');
    if (!tableBody || !tableFooter) return;

    if (Object.keys(budgets).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No budgets found for this period. Add one to get started.</td></tr>';
        tableFooter.innerHTML = '';
        return;
    }

    const budgetsArray = Object.entries(budgets).map(([category, budget]) => ({
        category,
        ...budget,
        percentage: (budget.limit > 0) ? ((budget.spent || 0) / budget.limit) * 100 : 0
    }));

    budgetsArray.sort((a, b) => b.percentage - a.percentage);

    tableBody.innerHTML = budgetsArray.map(budget => {
        const percentage = budget.percentage;
        const remaining = (budget.limit || 0) - (budget.spent || 0);
        let progressBarClass = 'safe';
        if (percentage > 75) progressBarClass = 'warning';
        if (percentage >= 90) progressBarClass = 'danger';

        return `
            <tr>
                <td>${budget.category}</td>
                <td>${formatRupiah(budget.limit || 0)}</td>
                <td>${formatRupiah(budget.spent || 0)}</td>
                <td>${formatRupiah(remaining)}</td>
                <td>
                    <div class="table-progress-bar">
                        <div class="table-progress-fill ${progressBarClass}" style="width: ${Math.min(percentage, 100)}%;"></div>
                    </div>
                    <small>${percentage.toFixed(1)}%</small>
                </td>
                <td class="table-actions">
                    <button class="edit-btn" data-period="${period}" data-category="${budget.category}" data-limit="${budget.limit}"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" data-period="${period}" data-category="${budget.category}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    // Render footer total
    const totalLimit = budgetsArray.reduce((sum, b) => sum + (b.limit || 0), 0);
    const totalSpent = budgetsArray.reduce((sum, b) => sum + (b.spent || 0), 0);
    const totalRemaining = totalLimit - totalSpent;
    tableFooter.innerHTML = `
        <tr class="budget-total-row">
            <td><strong>Total</strong></td>
            <td><strong>${formatRupiah(totalLimit)}</strong></td>
            <td><strong>${formatRupiah(totalSpent)}</strong></td>
            <td><strong>${formatRupiah(totalRemaining)}</strong></td>
            <td colspan="2"></td>
        </tr>
    `;
}

function displayBudgetCharts(budgets) {
    const labels = Object.keys(budgets);
    const spentData = labels.map(label => budgets[label].spent || 0);
    const limitData = labels.map(label => budgets[label].limit || 0);

    // Doughnut Chart: Spending Composition
    const doughnutCtx = document.getElementById('doughnutChart').getContext('2d');
    if (doughnutChartInstance) doughnutChartInstance.destroy();
    doughnutChartInstance = new Chart(doughnutCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Spent',
                data: spentData,
                backgroundColor: generateColors(labels.length),
                borderColor: 'var(--bg-secondary)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Spending by Category' }
            }
        }
    });

    // Bar Chart: Spent vs. Limit
    const barCtx = document.getElementById('barChart').getContext('2d');
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Spent',
                    data: spentData,
                    backgroundColor: 'rgba(var(--expense-color-rgb), 0.6)',
                    borderColor: 'rgba(var(--expense-color-rgb), 1)',
                    borderWidth: 1
                },
                {
                    label: 'Limit',
                    data: limitData,
                    backgroundColor: 'rgba(var(--income-color-rgb), 0.6)',
                    borderColor: 'rgba(var(--income-color-rgb), 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Budget vs. Spending' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function displayError(message) {
    document.getElementById('budgetTableBody').innerHTML = `<tr><td colspan="6" class="empty-state">${message}</td></tr>`;
    document.getElementById('budgetSummary').innerHTML = '';
    if (doughnutChartInstance) doughnutChartInstance.destroy();
    if (barChartInstance) barChartInstance.destroy();
}

// ============================================================================
// MODAL & UI HELPERS
// ============================================================================
function openAddBudgetModal() {
    document.getElementById('budgetModalTitle').textContent = 'Add New Budget';
    document.getElementById('addBudgetForm').reset();
    document.getElementById('budgetCategory').disabled = false;
    document.getElementById('addBudgetModal').classList.add('show');
}

function openEditBudgetModal(category, limit) {
    document.getElementById('budgetModalTitle').textContent = `Edit Budget for ${category}`;
    const form = document.getElementById('addBudgetForm');
    form.reset();
    form.budgetCategory.value = category;
    form.budgetCategory.disabled = true; // Cannot change category when editing
    form.budgetLimit.value = limit;
    document.getElementById('addBudgetModal').classList.add('show');
}

function handleTableActions(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const { period, category, limit } = target.dataset;
    if (target.classList.contains('edit-btn')) {
        openEditBudgetModal(category, parseFloat(limit));
    } else if (target.classList.contains('delete-btn')) {
        handleDeleteBudget(period, category);
    }
}

function populatePeriodFilters() {
    const monthSelect = document.getElementById('periodMonth');
    const yearSelect = document.getElementById('periodYear');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Populate months
    for (let i = 1; i <= 12; i++) {
        const monthName = new Date(0, i - 1).toLocaleString('default', { month: 'long' });
        monthSelect.innerHTML += `<option value="${String(i).padStart(2, '0')}">${monthName}</option>`;
    }

    // Populate years (current year +/- 5 years)
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
        yearSelect.innerHTML += `<option value="${i}">${i}</option>`;
    }

    // Set to current period by default
    monthSelect.value = String(currentMonth).padStart(2, '0');
    yearSelect.value = currentYear;
}

function populateCategoryDropdown(accounts) {
    const categorySelect = document.getElementById('budgetCategory');
    categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';
    Object.keys(accounts).sort().forEach(acc => {
        categorySelect.innerHTML += `<option value="${acc}">${acc}</option>`;
    });
}

function generateColors(numColors) {
    const colors = [];
    for (let i = 0; i < numColors; i++) {
        const hue = (i * (360 / numColors)) % 360;
        colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    return colors;
}
