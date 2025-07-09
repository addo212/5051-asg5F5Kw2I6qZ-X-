// main.js - Dashboard functionality

// Import modules
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { initializeUserData, loadUserData, loadTransactions } from './database.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// User ID
let userId;

// ============================================================================
// Fungsi untuk memeriksa apakah pengguna sudah login dan memuat data pengguna
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;

        // Load user data
        loadUserData(userId).then((userData) => {
            if (!userData) {
                // Initialize user data if it doesn't exist
                initializeUserData(userId).then(() => {
                    // Reload user data after initialization
                    loadUserData(userId).then(updatedUserData => {
                        updateDashboard(updatedUserData);
                        loadRecentTransactions(userId); // Load transactions after user data is loaded
                    });
                });
            } else {
                updateDashboard(userData);
                loadRecentTransactions(userId); // Load transactions if user data exists
            }
        }).catch((error) => {
            console.error("Error loading user data:", error);
            // Handle error, misalnya tampilkan pesan error ke pengguna
        });
    } else {
        // Redirect to login if not logged in
        window.location.href = "index.html";
    }
});


// ============================================================================
// Fungsi untuk memperbarui dashboard dengan data pengguna
// ============================================================================
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

// ============================================================================
// Fungsi untuk mendapatkan simbol mata uang
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
// Fungsi untuk menandai menu aktif berdasarkan halaman saat ini
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

// ============================================================================
// Fungsi untuk memuat transaksi terbaru
// ============================================================================
function loadRecentTransactions(userId) {
    loadTransactions(userId).then(transactionsData => {
        if (transactionsData) {
            const transactionsArray = Object.values(transactionsData);
            transactionsArray.sort((a, b) => b.timestamp - a.timestamp);
            const recentTransactions = transactionsArray.slice(0, 5);
            displayRecentTransactions(recentTransactions);
        } else {
            const recentTransactionsContainer = document.getElementById('recentTransactions');
            if (recentTransactionsContainer) {
                recentTransactionsContainer.innerHTML = '<p class="empty-state">No recent transactions</p>';
            }
        }
    }).catch(error => {
        console.error("Error loading transactions:", error);
        // Handle error, misalnya tampilkan pesan error ke pengguna
    });
}

// ============================================================================
// Fungsi untuk menampilkan transaksi terbaru di dashboard
// ============================================================================
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


// Panggil fungsi saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    setActiveMenuItem();
});
