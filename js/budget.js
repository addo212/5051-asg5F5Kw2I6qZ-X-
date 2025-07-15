// budgets.js

// ============================================================================
// Module Imports
// ============================================================================
import { auth, loadUserData, loadTransactions, saveBudget, deleteBudget } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { formatRupiah } from './utils.js';

// ============================================================================
// Global Variables
// ============================================================================
let userId;

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
        const userData = await loadUserData(userId);
        if (!userData) throw new Error("User data not found.");

        const expenseAccounts = userData.accounts?.expense || [];
        const userBudgets = userData.budgets || {};
        
        populateCategoryDropdown(expenseAccounts);
        
        const allTransactions = await loadTransactions(userId) || {};
        const processedBudgets = processBudgets(userBudgets, allTransactions);
        
        displayBudgets(processedBudgets);

    } catch (error) {
        console.error("Error initializing budgets page:", error);
        document.getElementById('budgetList').innerHTML = `<p class="empty-state">${error.message}</p>`;
    }
}

// ============================================================================
// Data Processing
// ============================================================================
function processBudgets(budgets, transactions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Reset 'spent' amount for all budgets
    for (const category in budgets) {
        budgets[category].spent = 0;
    }

    // Calculate spent amount for each category from this month's transactions
    for (const txId in transactions) {
        const tx = transactions[txId];
        const txDate = new Date(tx.timestamp);

        if (tx.type === 'expense' && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
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

function displayBudgets(budgets) {
    const container = document.getElementById('budgetList');
    if (!container) return;

    if (Object.keys(budgets).length === 0) {
        container.innerHTML = '<p class="empty-state">You have no budgets. Create one above!</p>';
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
                    <button class="delete-btn small" data-category="${budget.category}"><i class="fas fa-trash"></i></button>
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
document.getElementById('addBudgetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('budgetCategory').value;
    const limit = parseFloat(document.getElementById('budgetLimit').value);

    if (!category || isNaN(limit) || limit <= 0) {
        showError("Please select a category and enter a valid limit.");
        return;
    }

    try {
        await saveBudget(userId, category, limit);
        showSuccessMessage("Budget created successfully!");
        e.target.reset();
        initializeBudgetsPage(); // Reload the page data
    } catch (error) {
        console.error("Error saving budget:", error);
        showError("Failed to save budget.");
    }
});

function attachDeleteListeners() {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const category = button.dataset.category;
            if (confirm(`Are you sure you want to delete the budget for "${category}"?`)) {
                try {
                    await deleteBudget(userId, category);
                    showSuccessMessage("Budget deleted successfully!");
                    initializeBudgetsPage(); // Reload the page data
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
    // Menggunakan alert untuk sementara, bisa diganti dengan notifikasi yang lebih baik
    alert(message);
}
