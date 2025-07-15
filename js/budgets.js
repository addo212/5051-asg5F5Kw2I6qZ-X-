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
        console.log("User authenticated:", userId);
        initializeBudgetsPage();
    } else {
        window.location.href = "index.html";
    }
});

async function initializeBudgetsPage() {
    try {
        console.log("Initializing budgets page...");
        
        // Set current period to current month
        const now = new Date();
        currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        console.log("Current period set to:", currentPeriod);
        
        // Populate year dropdowns with reasonable range
        populateYearDropdowns();
        
        // Set current month and year in filter
        document.getElementById('budgetPeriodMonth').value = currentPeriod.split('-')[1];
        document.getElementById('budgetPeriodYear').value = currentPeriod.split('-')[0];
        
        // Load user data
        const userData = await loadUserData(userId);
        console.log("User data loaded:", userData);
        
        if (!userData) throw new Error("User data not found.");

        // Load expense accounts for category dropdown
        const expenseAccounts = userData.accounts?.expense || [];
        console.log("Expense accounts:", expenseAccounts);
        populateCategoryDropdown(expenseAccounts);
        
        // Load available budget periods
        availablePeriods = await loadBudgetPeriods(userId);
        console.log("Available budget periods:", availablePeriods);
        
        // Load transactions and budgets for current period
        await loadAndDisplayBudgetsForPeriod(currentPeriod);
        
        // Update period display
        updateCurrentPeriodDisplay(currentPeriod);
        
        // Setup event listeners
        setupEventListeners();
        console.log("Budgets page initialized successfully");

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
        if (!dropdown) {
            console.warn(`Dropdown with ID ${dropdownId} not found`);
            return;
        }
        
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
    console.log("Year dropdowns populated");
}

function updateCurrentPeriodDisplay(period) {
    const displayElement = document.getElementById('currentPeriodDisplay');
    if (!displayElement) {
        console.warn("Current period display element not found");
        return;
    }
    
    const [year, month] = period.split('-');
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthName = monthNames[parseInt(month) - 1];
    displayElement.textContent = `${monthName} ${year}`;
    console.log("Period display updated to:", `${monthName} ${year}`);
}

async function loadAndDisplayBudgetsForPeriod(period) {
    try {
        console.log("Loading budgets for period:", period);
        const userData = await loadUserData(userId);
        console.log("User data loaded:", userData);
        
        if (!userData || !userData.budgets) {
            console.log("No budgets data found in user data");
            document.getElementById('budgetList').innerHTML = '<p class="empty-state">No budgets found for this period.</p>';
            return;
        }
        
        console.log("All budgets:", userData.budgets);
        const periodBudgets = userData.budgets[period] || {};
        console.log("Budgets for this period:", periodBudgets);
        
        // Load transactions for this period
        const allTransactions = await loadTransactions(userId) || {};
        console.log("Transactions loaded:", Object.keys(allTransactions).length);
        
        // Process budgets with transactions
        const processedBudgets = processBudgets(periodBudgets, allTransactions, period);
        console.log("Processed budgets:", processedBudgets);
        
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
    console.log("Processing budgets for period:", period);
    // Extract year and month from period
    const [year, month] = period.split('-').map(Number);
    console.log(`Year: ${year}, Month: ${month}`);
    
    // Buat salinan objek budgets agar tidak mengubah data asli
    const processedBudgets = JSON.parse(JSON.stringify(budgets));
    
    // Reset 'spent' amount for all budgets
    for (const category in processedBudgets) {
        processedBudgets[category].spent = 0;
    }
    
    // Calculate spent amount for each category from transactions in this period
    let matchCount = 0;
    for (const txId in transactions) {
        const tx = transactions[txId];
        if (!tx.timestamp) {
            console.log("Transaction missing timestamp:", tx);
            continue;
        }
        
        const txDate = new Date(tx.timestamp);
        const txYear = txDate.getFullYear();
        const txMonth = txDate.getMonth() + 1; // JavaScript months are 0-indexed
        
        // Check if transaction is in the selected period
        if (tx.type === 'expense' && txYear === year && txMonth === month) {
            matchCount++;
            if (processedBudgets[tx.account]) {
                processedBudgets[tx.account].spent += tx.amount;
                console.log(`Added ${tx.amount} to ${tx.account}, new total: ${processedBudgets[tx.account].spent}`);
            }
        }
    }
    
    console.log(`Found ${matchCount} matching transactions for period ${year}-${month}`);
    return processedBudgets;
}

// ============================================================================
// UI Display Functions
// ============================================================================
function populateCategoryDropdown(expenseAccounts) {
    const select = document.getElementById('budgetCategory');
    if (!select) {
        console.warn("Budget category select element not found");
        return;
    }
    
    select.innerHTML = '<option value="">Select a category...</option>';
    expenseAccounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        select.appendChild(option);
    });
    console.log("Category dropdown populated with", expenseAccounts.length, "options");
}

function displayBudgets(budgets, period) {
    const container = document.getElementById('budgetList');
    if (!container) {
        console.error("Budget list container not found!");
        return;
    }

    console.log("Displaying budgets:", budgets);
    console.log("Number of budgets:", Object.keys(budgets).length);

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
    console.log("Budget HTML generated:", html.substring(0, 100) + "...");
    attachDeleteListeners();
}

// ============================================================================
// Event Listeners
// ============================================================================
function setupEventListeners() {
    // View budget for selected period
    const viewButton = document.getElementById('viewBudgetPeriodBtn');
    if (viewButton) {
        viewButton.addEventListener('click', () => {
            console.log("View Period button clicked");
            const month = document.getElementById('budgetPeriodMonth').value;
            const year = document.getElementById('budgetPeriodYear').value;
            const period = `${year}-${month}`;
            
            console.log(`Selected period: ${period}`);
            currentPeriod = period;
            updateCurrentPeriodDisplay(period);
            loadAndDisplayBudgetsForPeriod(period);
        });
    } else {
        console.error("View Period button not found!");
    }
    
    // Toggle custom period fields
    const periodSelect = document.getElementById('newBudgetPeriod');
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            const customFields = document.getElementById('customPeriodFields');
            if (customFields) {
                customFields.style.display = e.target.value === 'custom' ? 'block' : 'none';
            }
        });
    }
    
    // Add budget form submission
    const budgetForm = document.getElementById('addBudgetForm');
    if (budgetForm) {
        budgetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Budget form submitted");
            
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
            
            console.log(`Creating budget: period=${period}, category=${category}, limit=${limit}`);

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
    } else {
        console.error("Budget form not found!");
    }
}

function attachDeleteListeners() {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const period = button.dataset.period;
            const category = button.dataset.category;
            
            console.log(`Delete button clicked for ${category} in period ${period}`);
            
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
    } else {
        console.error("Error element not found, message was:", message);
    }
}

function showSuccessMessage(message) {
    alert(message);
}
