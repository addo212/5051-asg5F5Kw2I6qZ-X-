// main.js - Dashboard functionality
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { initializeUserData, loadUserData, loadTransactions } from './database.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        loadUserData(userId).then((userData) => {
            if (!userData) {
                initializeUserData(userId).then(() => {
                    loadUserData(userId).then(updatedUserData => {
                        updateDashboard(updatedUserData);
                        loadRecentTransactions(userId);
                    })
                });
            } else {
                updateDashboard(userData);
                loadRecentTransactions(userId);
            }
        });
    } else {
        // Redirect to login if not logged in
        window.location.href = "index.html";
    }
});

let userId; // Define userId outside onAuthStateChanged

// Update dashboard with user data
function updateDashboard(userData) {
    const currency = localStorage.getItem('currency') || 'USD';
    const currencySymbol = getCurrencySymbol(currency);

    const totalBalanceElement = document.getElementById('totalBalance');
    if (totalBalanceElement) {
        totalBalanceElement.textContent = `${currencySymbol}${userData.totalBalance ? userData.totalBalance.toFixed(2) : (0).toFixed(2)}`;
    }

    const monthlyIncomeElement = document.getElementById('monthlyIncome');
    if (monthlyIncomeElement) {
        monthlyIncomeElement.textContent = `${currencySymbol}${userData.monthlyIncome ? userData.monthlyIncome.toFixed(2) : (0).toFixed(2)}`;
    }

    const monthlyExpensesElement = document.getElementById('monthlyExpenses');
    if (monthlyExpensesElement) {
        monthlyExpensesElement.textContent = `${currencySymbol}${userData.monthlyExpenses ? userData.monthlyExpenses.toFixed(2) : (0).toFixed(2)}`;
    }
}

function getCurrencySymbol(currency) {
    switch (currency) {
        case 'USD': return '$';
        case 'IDR': return 'Rp';
        case 'EUR': return '€';
        case 'GBP': return '£';
        default: return '$';
    }
}

// Menandai menu aktif berdasarkan halaman saat ini
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

// Load recent transactions
function loadRecentTransactions(userId) {
    loadTransactions(userId).then(transactionsData => {
        if (transactionsData) {
            const transactionsArray = Object.values(transactionsData);
            transactionsArray.sort((a, b) => b.timestamp - a.timestamp);
            const recentTransactions = transactionsArray.slice(0, 5);
            displayRecentTransactions(recentTransactions);
        } else {
            // No transactions yet
            const recentTransactionsContainer = document.getElementById('recentTransactions');
            if (recentTransactionsContainer) {
                recentTransactionsContainer.innerHTML = '<p class="empty-state">No recent transactions</p>';
            }
        }
    }).catch(error => {
        console.error("Error loading transactions:", error);
    });
}

function displayRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');
    if (!container) return;

    if (transactions.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent transactions</p>';
        return;
    }

    let html = '';
    transactions.forEach(transaction => {
        const isIncome = transaction.type === 'income';
        const iconClass = isIncome ? 'income' : 'expense';
        const amountClass = isIncome ? 'amount-income' : 'amount-expense';
        const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up'; // Ikon sesuai jenis transaksi
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
