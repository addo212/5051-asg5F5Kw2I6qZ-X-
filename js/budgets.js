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
    populatePeriodFilters('periodMonth', 'periodYear'); // Mengisi filter utama
    try {
        const userData = await loadInitialData();
        expenseAccounts = userData.expenseAccounts || {};
        
        // Mengisi dropdown di modal dengan data yang sudah dimuat
        populateCategoryDropdown(expenseAccounts);
        populatePeriodFilters('modalPeriodMonth', 'modalPeriodYear'); // Mengisi filter di modal

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
    document.getElementById('applyPeriodFilterBtn').addEventListener('click', loadAndDisplayBudgetsForCurrentPeriod);
    document.getElementById('addBudgetBtn').addEventListener('click', openAddBudgetModal);
    document.querySelector('#addBudgetModal .close-modal').addEventListener('click', () => {
        document.getElementById('addBudgetModal').classList.remove('show');
    });
    document.getElementById('addBudgetForm').addEventListener('submit', handleSaveBudget);
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
        budgets = calculateSpending(budgets, transactions, period);
        displayBudgets(budgets, period);

    } catch (error) {
        console.error(`Error loading budgets for period ${period}:`, error);
        displayError(`Could not load budgets for ${period}.`);
    }
}

function calculateSpending(budgets, transactions, period) {
    const [year, month] = period.split('-').map(Number);
    const calculatedBudgets = { ...budgets };
    for (const category in calculatedBudgets) {
        calculatedBudgets[category].spent = 0;
    }
    for (const txId in transactions) {
        const tx = transactions[txId];
        if (tx.type === 'expense') {
            const txDate = new Date(tx.timestamp);
            if (txDate.getFullYear() === year && (txDate.getMonth() + 1) === month) {
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

    const period = `${form.modalPeriodYear.value}-${form.modalPeriodMonth.value}`;
    const category = form.budgetCategory.value;
    const limit = parseFloat(form.budgetLimit.value);
    const mode = form.budgetMode.value;

    try {
        const budgetRef = ref(database, `users/${userId}/budgets/${period}/${category}`);
        
        let spent = 0;
        if (mode === 'edit') {
            const snapshot = await get(budgetRef);
            const existingBudget = snapshot.val();
            if (existingBudget) {
                spent = existingBudget.spent || 0;
            }
        }

        await set(budgetRef, { limit, spent });
        
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
        await remove(ref(database, `users/${userId}/budgets/${period}/${category}`));
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
    const modal = document.getElementById('addBudgetModal');
    const form = document.getElementById('addBudgetForm');
    
    document.getElementById('budgetModalTitle').textContent = 'Add New Budget';
    form.reset();
    form.budgetMode.value = 'add';
    document.getElementById('budgetCategory').disabled = false;

    // Set default periode di modal sesuai dengan yang sedang ditampilkan di halaman
    document.getElementById('modalPeriodMonth').value = document.getElementById('periodMonth').value;
    document.getElementById('modalPeriodYear').value = document.getElementById('periodYear').value;
    
    modal.classList.add('show');
}

function openEditBudgetModal(category, limit, period) {
    const modal = document.getElementById('addBudgetModal');
    const form = document.getElementById('addBudgetForm');
    const [year, month] = period.split('-');

    document.getElementById('budgetModalTitle').textContent = `Edit Budget for ${category}`;
    form.reset();
    form.budgetMode.value = 'edit';
    
    // Set periode di modal sesuai budget yang diedit
    document.getElementById('modalPeriodMonth').value = month;
    document.getElementById('modalPeriodYear').value = year;
    
    form.budgetCategory.value = category;
    form.budgetCategory.disabled = true; // Kategori tidak bisa diubah saat edit
    form.budgetLimit.value = limit;
    
    modal.classList.add('show');
}

function handleTableActions(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const { period, category, limit } = target.dataset;
    if (target.classList.contains('edit-btn')) {
        openEditBudgetModal(category, parseFloat(limit), period);
    } else if (target.classList.contains('delete-btn')) {
        handleDeleteBudget(period, category);
    }
}

function populatePeriodFilters(monthId, yearId) {
    const monthSelect = document.getElementById(monthId);
    const yearSelect = document.getElementById(yearId);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    monthSelect.innerHTML = '';
    yearSelect.innerHTML = '';

    for (let i = 1; i <= 12; i++) {
        const monthName = new Date(0, i - 1).toLocaleString('default', { month: 'long' });
        monthSelect.innerHTML += `<option value="${String(i).padStart(2, '0')}">${monthName}</option>`;
    }
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
        yearSelect.innerHTML += `<option value="${i}">${i}</option>`;
    }

    monthSelect.value = String(currentMonth).padStart(2, '0');
    yearSelect.value = currentYear;
}

function populateCategoryDropdown(accounts) {
    const categorySelect = document.getElementById('budgetCategory');
    const warningMessage = document.getElementById('categoryWarning');
    const submitButton = document.getElementById('budgetSubmitBtn');

    categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';
    
    if (Object.keys(accounts).length === 0) {
        warningMessage.style.display = 'block';
        categorySelect.disabled = true;
        submitButton.disabled = true;
    } else {
        warningMessage.style.display = 'none';
        categorySelect.disabled = false;
        submitButton.disabled = false;
        Object.keys(accounts).sort().forEach(acc => {
            categorySelect.innerHTML += `<option value="${acc}">${acc}</option>`;
        });
    }
}

function generateColors(numColors) {
    const colors = [];
    for (let i = 0; i < numColors; i++) {
        const hue = (i * (360 / numColors)) % 360;
        colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    return colors;
}
