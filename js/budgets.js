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
        // Set current period to current month
        const now = new Date();
        currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // Populate year dropdowns with reasonable range
        populateYearDropdowns();
        
        // Set current month and year in filter
        document.getElementById('budgetPeriodMonth').value = currentPeriod.split('-')[1];
        document.getElementById('budgetPeriodYear').value = currentPeriod.split('-')[0];
        
        // Load user data
        const userData = await loadUserData(userId);
        if (!userData) throw new Error("User data not found.");

        // Load expense accounts for category dropdown
        const expenseAccounts = userData.accounts?.expense || [];
        populateCategoryDropdown(expenseAccounts);
        
        // Load available budget periods
        availablePeriods = await loadBudgetPeriods(userId);
        
        // Load transactions and budgets for current period
        await loadAndDisplayBudgetsForPeriod(currentPeriod);
        
        // Update period display
        updateCurrentPeriodDisplay(currentPeriod);
        
        // Setup event listeners
        setupEventListeners();

    } catch (error) {
        console.error("Error initializing budgets page:", error);
        document.getElementById('budgetList').innerHTML = `<p class="empty-state">${error.message}</p>`;
    }
}

// ============================================================================
// Period Management
// ============================================================================
function populateYearDropdowns() {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5; // 5 years back
    const endYear = currentYear + 1;   // 1 year ahead
    
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
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthName = monthNames[parseInt(month) - 1];
    document.getElementById('currentPeriodDisplay').textContent = `${monthName} ${year}`;
}

async function loadAndDisplayBudgetsForPeriod(period) {
    try {
        const userData = await loadUserData(userId);
        if (!userData || !userData.budgets) {
            document.getElementById('budgetList').innerHTML = '<p class="empty-state">No budgets found for this period.</p>';
            return;
        }
        
        const periodBudgets = userData.budgets[period] || {};
        
        // Load transactions for this period
        const allTransactions = await loadTransactions(userId) || {};
        
        // Process budgets with transactions
        const processedBudgets = processBudgets(periodBudgets, allTransactions, period);
        
        // Display budgets
        displayBudgets(processedBudgets, period);
    } catch (error) {
        console.error("Error loading budgets for period:", error);
        document.getElementById('budgetList').innerHTML = `<p class="empty-state">Error loading budgets: ${error.message}</p>`;
    }
}

// ============================================================================
// Data Processing
// ============================================================================
function processBudgets(budgets, transactions, period) {
    // Extract year and month from period
    const [year, month] = period.split('-').map(Number);
    
    // Reset 'spent' amount for all budgets
    for (const category in budgets) {
        budgets[category].spent = 0;
    }
    
    // Calculate spent amount for each category from transactions in this period
    for (const txId in transactions) {
        const tx = transactions[txId];
        const txDate = new Date(tx.timestamp);
        
        // Check if transaction is in the selected period
        if (tx.type === 'expense' && 
            txDate.getFullYear() === year && 
            txDate.getMonth() + 1 === month) {
            
            if (budgets[tx.account]) {
                budgets[tx.account].spent += tx.amount;
            }
        }
    }
    
    return budgets;
}

// ============================================================================
// UI Display Functions
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

function displayBudgets(budgets, period) {
    const container = document.getElementById('budgetList');
    if (!container) return;

    if (Object.keys(budgets).length === 0) {
        container.innerHTML = '<p class="empty-state">No budgets found for this period.</p>';
        return;
    }

    let html = '';
    for (const category in budgets) {
        const budget = budgets[category];
        const percentage = (budget.spent / budget.limit) * 100;
        const remaining = budget.limit - budget.spent;

        let progressBarClass = 'safe';
        if (percentage > 75) progressBarClass = 'warning';
        if (percentage >= 100) progressBarClass = 'danger';

        html += `
            <div class="budget-card">
                <div class="budget-card-header">
                    <h3>${budget.category}</h3>
                    <button class="delete-btn small" data-period="${period}" data-category="${budget.category}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="progress-bar">
                    <div class="progress-bar-fill ${progressBarClass}" style="width: ${Math.min(percentage, 100)}%;"></div>
                </div>
                <div class="budget-details">
                    <p><span>Spent:</span> ${formatRupiah(budget.spent)}</p>
                    <p><span>Limit:</span> ${formatRupiah(budget.limit)}</p>
                    <p><span>Remaining:</span> ${formatRupiah(remaining)}</p>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
    attachDeleteListeners();
}

// ============================================================================
// Event Listeners
// ============================================================================
function setupEventListeners() {
    // View budget for selected period
    document.getElementById('viewBudgetPeriodBtn')?.addEventListener('click', () => {
        const month = document.getElementById('budgetPeriodMonth').value;
        const year = document.getElementById('budgetPeriodYear').value;
        const period = `${year}-${month}`;
        
        currentPeriod = period;
        updateCurrentPeriodDisplay(period);
        loadAndDisplayBudgetsForPeriod(period);
    });
    
    // Toggle custom period fields
    document.getElementById('newBudgetPeriod')?.addEventListener('change', (e) => {
        const customFields = document.getElementById('customPeriodFields');
        if (e.target.value === 'custom') {
            customFields.style.display = 'block';
        } else {
            customFields.style.display = 'none';
        }
    });
    
    // Add budget form submission
    document.getElementById('addBudgetForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get period
        let period = currentPeriod;
        const periodType = document.getElementById('newBudgetPeriod').value;
        
        if (periodType === 'custom') {
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
            
            // Add period to available periods if it's new
            if (!availablePeriods.includes(period)) {
                availablePeriods.push(period);
            }
            
            // If we're adding to the current displayed period, refresh the view
            if (period === currentPeriod) {
                await loadAndDisplayBudgetsForPeriod(currentPeriod);
            }
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
