// main.js - Dashboard functionality
import { auth, initializeUserData, loadUserData, loadTransactions } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// ============================================================================
// Main Application Logic
// ============================================================================
async function initializeApp(user) {
    try {
        let userData = await loadUserData(user.uid);
        if (!userData) {
            console.log("New user detected, initializing data...");
            await initializeUserData(user.uid);
            userData = await loadUserData(user.uid); // Reload data after initialization
        }
        
        updateDashboard(userData);
        
        const transactions = await loadTransactions(user.uid);
        const transactionsArray = Object.values(transactions || {});
        displayRecentTransactions(transactionsArray);

    } catch (error) {
        console.error("Error during app initialization:", error);
    }
}

// ============================================================================
// Authentication state listener
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        initializeApp(user);
    } else {
        const protectedPages = ['dashboard.html', 'transactions.html', 'wallets.html', 'settings.html'];
        if (protectedPages.some(page => window.location.pathname.endsWith(page))) {
            window.location.href = "index.html";
        }
    }
});

// ============================================================================
// Update dashboard with user data
// ============================================================================
function updateDashboard(userData) {
    if (!userData) return;
    const currency = localStorage.getItem('currency') || 'USD';
    const currencySymbol = getCurrencySymbol(currency);

    const totalBalanceElement = document.getElementById('totalBalance');
    if (totalBalanceElement) {
        totalBalanceElement.textContent = `${currencySymbol}${(userData.totalBalance || 0).toFixed(2)}`;
    }

    const monthlyIncomeElement = document.getElementById('monthlyIncome');
    if (monthlyIncomeElement) {
        monthlyIncomeElement.textContent = `${currencySymbol}${(userData.monthlyIncome || 0).toFixed(2)}`;
    }

    const monthlyExpensesElement = document.getElementById('monthlyExpenses');
    if (monthlyExpensesElement) {
        monthlyExpensesElement.textContent = `${currencySymbol}${(userData.monthlyExpenses || 0).toFixed(2)}`;
    }
}

// ============================================================================
// Get currency symbol
// ============================================================================
function getCurrencySymbol(currency) {
    switch (currency) {
        case 'USD': return '$';
        case 'IDR': return 'Rp';
        case 'EUR': return '€';
        case 'GBP': return '£';
        default: return '$';
    }
}

// ============================================================================
// Display recent transactions on the dashboard
// ============================================================================
function displayRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent transactions</p>';
        return;
    }

    // Sort transactions by timestamp (newest first) and take the latest 5
    const recentTransactions = transactions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);

    let html = '';
    recentTransactions.forEach(transaction => {
        const isIncome = transaction.type === 'income';
        const iconClass = isIncome ? 'income' : 'expense';
        const amountClass = isIncome ? 'amount-income' : 'amount-expense';
        const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
        const sign = isIncome ? '+' : '-';
        const date = new Date(transaction.timestamp);
        const formattedDate = date.toLocaleDateString();

        html += `
            <div class="transaction-item">
                <div class="transaction-details">
                    <div class="transaction-icon ${iconClass}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="transaction-info">
                        <h4>${transaction.description || 'Transaction'}</h4>
                        <p>${formattedDate}</p>
                    </div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${sign}$${Math.abs(transaction.amount).toFixed(2)}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============================================================================
// Set active menu item
// ============================================================================
function setActiveMenuItem() {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const menuItems = document.querySelectorAll('.dropdown-content a');

    menuItems.forEach(item => {
        const itemHref = item.getAttribute('href');
        if (itemHref === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Panggil fungsi saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    setActiveMenuItem();
});
