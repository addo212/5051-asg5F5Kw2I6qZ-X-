// main.js

// ============================================================================
// Module Imports
// ============================================================================
import { auth, loadUserData, loadTransactions } from './database.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { formatRupiah } from './utils.js';

// ============================================================================
// Global Variables
// ============================================================================
let userId;

// ============================================================================
// Main Initialization on Auth State Change
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeDashboard();
        setupEventListeners();
    } else {
        window.location.href = "index.html";
    }
});

// ============================================================================
// Event Listeners
// ============================================================================
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to logout?')) {
                try {
                    await signOut(auth);
                    console.log('User signed out successfully.');
                } catch (error) {
                    console.error('Error signing out:', error);
                    alert('Failed to sign out. Please try again.');
                }
            }
        });
    }

    // Quick action buttons
    document.getElementById('quickAddIncome')?.addEventListener('click', () => {
        window.location.href = 'transactions.html?type=income';
    });

    document.getElementById('quickAddExpense')?.addEventListener('click', () => {
        window.location.href = 'transactions.html?type=expense';
    });

    document.getElementById('quickTransfer')?.addEventListener('click', () => {
        window.location.href = 'wallets.html?action=transfer';
    });

    document.getElementById('quickBudget')?.addEventListener('click', () => {
        window.location.href = 'budgets.html';
    });
}

// ============================================================================
// Core Dashboard Logic
// ============================================================================
async function initializeDashboard() {
    try {
        console.log("Initializing dashboard...");
        
        // Show loading states
        document.getElementById('recentTransactionsList').innerHTML = '<p class="empty-state">Loading recent transactions...</p>';
        document.getElementById('topBudgets').innerHTML = '<p class="empty-state">Loading budget data...</p>';
        document.getElementById('topWallets').innerHTML = '<p class="empty-state">Loading wallet data...</p>';
        
        // Load user data and transactions
        const [userData, transactionsData] = await Promise.all([
            loadUserData(userId),
            loadTransactions(userId)
        ]);

        console.log("Data loaded:", { userData, transactionsHasData: !!transactionsData });

        if (!userData) {
            console.error("User data not found!");
            return;
        }

        // Calculate monthly summary
        const monthlySummary = calculateMonthlySummary(transactionsData);

        // Update dashboard cards
        updateDashboardCards(userData.totalBalance, monthlySummary.monthlyIncome, monthlySummary.monthlyExpenses);

        // Display recent transactions
        displayRecentTransactions(transactionsData);

        // Display top wallets
        displayTopWallets(userData.wallets || {});

        // Display top budgets
        displayTopBudgets(userData.budgets || {});

        // Display weekly trends
        displayWeeklyTrends(transactionsData);

        // Show daily financial tip
        showDailyTip();

    } catch (error) {
        console.error("Error initializing dashboard:", error);
        document.getElementById('recentTransactionsList').innerHTML = '<p class="empty-state">Error loading transactions. Please try refreshing the page.</p>';
    }
}

// ============================================================================
// Data Processing Functions
// ============================================================================
function calculateMonthlySummary(transactions) {
    let monthlyIncome = 0;
    let monthlyExpenses = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (!transactions) {
        return { monthlyIncome, monthlyExpenses };
    }

    // Convert transactions object to array if needed
    const transactionsArray = typeof transactions === 'object' && !Array.isArray(transactions) 
        ? Object.values(transactions) 
        : transactions;

    transactionsArray.forEach(tx => {
        if (!tx || !tx.timestamp) return;
        
        const txDate = new Date(tx.timestamp);
        
        // Only process transactions from current month and year
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
            if (tx.type === 'income') {
                monthlyIncome += tx.amount;
            } else if (tx.type === 'expense') {
                monthlyExpenses += tx.amount;
            }
        }
    });

    return { monthlyIncome, monthlyExpenses };
}

function getWeeklyData(transactions) {
    // Get dates for the last 7 days
    const dates = [];
    const incomeData = [];
    const expenseData = [];
    
    // Initialize with zeros
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        incomeData.push(0);
        expenseData.push(0);
    }
    
    // Convert transactions object to array if needed
    const transactionsArray = typeof transactions === 'object' && !Array.isArray(transactions) 
        ? Object.values(transactions) 
        : transactions;
    
    // Process transactions
    transactionsArray.forEach(tx => {
        if (!tx || !tx.timestamp) return;
        
        const txDate = new Date(tx.timestamp);
        const today = new Date();
        const diffTime = today - txDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < 7) {
            const index = 6 - diffDays;
            if (tx.type === 'income') {
                incomeData[index] += tx.amount;
            } else if (tx.type === 'expense') {
                expenseData[index] += tx.amount;
            }
        }
    });
    
    // Calculate totals
    const totalIncome = incomeData.reduce((sum, val) => sum + val, 0);
    const totalExpense = expenseData.reduce((sum, val) => sum + val, 0);
    
    return {
        labels: dates,
        income: incomeData,
        expense: expenseData,
        totalIncome,
        totalExpense
    };
}

// ============================================================================
// UI Update Functions
// ============================================================================
function updateDashboardCards(totalBalance, monthlyIncome, monthlyExpenses) {
    // Update main stats
    document.getElementById('totalBalance').textContent = formatRupiah(totalBalance || 0);
    document.getElementById('monthlyIncome').textContent = formatRupiah(monthlyIncome || 0);
    document.getElementById('monthlyExpenses').textContent = formatRupiah(monthlyExpenses || 0);
    
    // Update trends (placeholder - in a real app, you'd compare with previous month)
    const balanceTrend = document.getElementById('balanceTrend');
    const incomeTrend = document.getElementById('incomeTrend');
    const expenseTrend = document.getElementById('expenseTrend');
    
    // Simulate some trend data
    updateTrendIndicator(balanceTrend, 5.2);
    updateTrendIndicator(incomeTrend, 3.8);
    updateTrendIndicator(expenseTrend, -2.1);
}

function updateTrendIndicator(element, percentage) {
    if (!element) return;
    
    const isPositive = percentage > 0;
    const isNeutral = percentage === 0;
    
    // Remove all classes first
    element.classList.remove('positive', 'negative', 'neutral');
    
    // Add appropriate class
    if (isPositive) {
        element.classList.add('positive');
        element.innerHTML = `<i class="fas fa-arrow-up"></i> ${Math.abs(percentage).toFixed(1)}%`;
    } else if (isNeutral) {
        element.classList.add('neutral');
        element.innerHTML = `<i class="fas fa-minus"></i> ${Math.abs(percentage).toFixed(1)}%`;
    } else {
        element.classList.add('negative');
        element.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(percentage).toFixed(1)}%`;
    }
}

function displayRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactionsList');
    if (!container) {
        console.error("Recent transactions container not found!");
        return;
    }

    console.log("Displaying recent transactions...");

    if (!transactions || Object.keys(transactions).length === 0) {
        container.innerHTML = '<p class="empty-state">No recent transactions found.</p>';
        return;
    }

    // Convert transactions object to array
    let transactionsArray = [];
    
    if (Array.isArray(transactions)) {
        transactionsArray = transactions;
    } else {
        // Convert from object to array
        transactionsArray = Object.keys(transactions).map(key => ({
            id: key,
            ...transactions[key]
        }));
    }
    
    // Filter valid transactions
    const validTransactions = transactionsArray.filter(tx => 
        tx && tx.timestamp && tx.type && (tx.type === 'income' || tx.type === 'expense')
    );
    
    // Sort by timestamp (newest first)
    validTransactions.sort((a, b) => b.timestamp - a.timestamp);
    
    // Take 5 most recent
    const recentTransactions = validTransactions.slice(0, 5);
    
    if (recentTransactions.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent transactions found.</p>';
        return;
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let html = '';
    recentTransactions.forEach(transaction => {
        const isIncome = transaction.type === 'income';
        const iconClass = isIncome ? 'income' : 'expense';
        const amountClass = isIncome ? 'amount-income' : 'amount-expense';
        const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
        const sign = isIncome ? '+' : '-';
        
        // Ensure timestamp is a number
        const timestamp = typeof transaction.timestamp === 'number' 
            ? transaction.timestamp 
            : parseInt(transaction.timestamp);
            
        const date = new Date(timestamp);
        
        html += `
            <div class="transaction-item enhanced">
                <div class="transaction-date">
                    <span class="day">${date.getDate()}</span>
                    <span class="month">${monthNames[date.getMonth()]}</span>
                </div>
                <div class="transaction-details">
                    <div class="transaction-icon ${iconClass}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="transaction-info">
                        <h4>${transaction.description || 'Transaction'}</h4>
                        <p>${transaction.account || 'Unknown'} • ${transaction.wallet || 'Unknown'}</p>
                    </div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${sign} ${formatRupiah(transaction.amount)}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    console.log("Recent transactions displayed successfully");
}

function displayTopWallets(wallets) {
    const container = document.getElementById('topWallets');
    if (!container) return;
    
    if (!wallets || Object.keys(wallets).length === 0) {
        container.innerHTML = '<p class="empty-state">No wallets found. Create a wallet to get started.</p>';
        return;
    }
    
    // Convert wallets object to array
    const walletsArray = Object.entries(wallets).map(([id, wallet]) => ({
        id,
        ...wallet
    }));
    
    // Sort by balance (highest first)
    walletsArray.sort((a, b) => (b.balance || 0) - (a.balance || 0));
    
    // Take top 3
    const topWallets = walletsArray.slice(0, 3);
    
    let html = '';
    topWallets.forEach(wallet => {
        // Default color if not set
        const color = wallet.color || '#6c5ce7';
        
        // Create a darker shade for gradient
        const darkerColor = adjustColor(color, -30);
        
        html += `
            <div class="wallet-card" style="background: linear-gradient(135deg, ${color}, ${darkerColor})">
                <div class="wallet-icon">
                    <i class="fas ${wallet.icon || 'fa-wallet'}"></i>
                </div>
                <h3>${wallet.name}</h3>
                <p class="wallet-balance">${formatRupiah(wallet.balance || 0)}</p>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayTopBudgets(budgets) {
    const container = document.getElementById('topBudgets');
    if (!container) return;
    
    // Get current month's budgets
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const currentBudgets = budgets[currentPeriod] || {};
    
    if (Object.keys(currentBudgets).length === 0) {
        container.innerHTML = '<p class="empty-state">No budgets found for this month.</p>';
        return;
    }
    
    // Convert to array and calculate percentages
    const budgetsArray = Object.entries(currentBudgets).map(([category, budget]) => ({
        category,
        ...budget,
        percentage: budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0
    }));
    
    // Sort by percentage (highest first)
    budgetsArray.sort((a, b) => b.percentage - a.percentage);
    
    // Take top 3
    const topBudgets = budgetsArray.slice(0, 3);
    
    let html = '';
    topBudgets.forEach(budget => {
        const percentage = budget.percentage;
        let statusClass = 'safe';
        
        if (percentage >= 90) statusClass = 'danger';
        else if (percentage >= 75) statusClass = 'warning';
        
        html += `
            <div class="budget-item">
                <div class="budget-info">
                    <h4>${budget.category}</h4>
                    <p>${formatRupiah(budget.spent)} / ${formatRupiah(budget.limit)}</p>
                </div>
                <div class="budget-bar">
                    <div class="budget-progress ${statusClass}" style="width: ${Math.min(percentage, 100)}%;"></div>
                </div>
                <div class="budget-percentage ${statusClass}">${percentage.toFixed(0)}%</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayWeeklyTrends(transactions) {
    const weeklyData = getWeeklyData(transactions);
    
    // Update totals
    document.getElementById('weeklyIncomeTotal').textContent = formatRupiah(weeklyData.totalIncome);
    document.getElementById('weeklyExpenseTotal').textContent = formatRupiah(weeklyData.totalExpense);
    
    // Create income sparkline
    const incomeCtx = document.getElementById('incomeSparkline');
    if (incomeCtx) {
        new Chart(incomeCtx, {
            type: 'line',
            data: {
                labels: weeklyData.labels,
                datasets: [{
                    data: weeklyData.income,
                    borderColor: 'rgba(76, 175, 80, 0.8)',
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: 'rgba(76, 175, 80, 1)'
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { 
                    x: { 
                        display: true,
                        grid: { display: false }
                    }, 
                    y: { 
                        display: false,
                        beginAtZero: true
                    } 
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Create expense sparkline
    const expenseCtx = document.getElementById('expenseSparkline');
    if (expenseCtx) {
        new Chart(expenseCtx, {
            type: 'line',
            data: {
                labels: weeklyData.labels,
                datasets: [{
                    data: weeklyData.expense,
                    borderColor: 'rgba(244, 67, 54, 0.8)',
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: 'rgba(244, 67, 54, 1)'
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { 
                    x: { 
                        display: true,
                        grid: { display: false }
                    }, 
                    y: { 
                        display: false,
                        beginAtZero: true
                    } 
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

function showDailyTip() {
    const tips = [
        "Save 20% of your income for long-term goals.",
        "Track every expense to identify spending patterns.",
        "Pay yourself first - automate your savings.",
        "Review your budget regularly to stay on track.",
        "Avoid impulse purchases by waiting 24 hours before buying.",
        "Use the 50/30/20 rule: 50% needs, 30% wants, 20% savings.",
        "Eliminate high-interest debt first.",
        "Build an emergency fund covering 3-6 months of expenses.",
        "Invest early and regularly for compound growth.",
        "Use cash for discretionary spending to be more mindful.",
        "Negotiate bills and subscriptions annually.",
        "Cook at home more often to reduce food expenses.",
        "Set specific financial goals with deadlines.",
        "Use cashback and rewards programs strategically.",
        "Review your credit report annually for errors."
    ];
    
    // Choose tip based on date
    const today = new Date();
    const tipIndex = (today.getDate() + today.getMonth()) % tips.length;
    
    document.getElementById('dailyTip').textContent = tips[tipIndex];
}

// ============================================================================
// Helper Functions
// ============================================================================
function adjustColor(hex, percent) {
    // Convert hex to RGB
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);

    // Adjust color
    r = Math.max(0, Math.min(255, r + percent));
    g = Math.max(0, Math.min(255, g + percent));
    b = Math.max(0, Math.min(255, b + percent));

    // Convert back to hex
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
