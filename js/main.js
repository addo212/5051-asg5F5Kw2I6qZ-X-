javascript


// main.js

// ============================================================================
// Module Imports
// ============================================================================
import { auth, loadUserData, loadTransactions } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
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
    } else {
        // Jika tidak ada pengguna, arahkan kembali ke halaman login
        window.location.href = "index.html";
    }
});

// ============================================================================
// Core Dashboard Logic
// ============================================================================
async function initializeDashboard() {
    try {
        // Memuat data pengguna dan transaksi secara bersamaan
        const [userData, allTransactions] = await Promise.all([
            loadUserData(userId),
            loadTransactions(userId)
        ]);

        if (!userData) {
            console.error("User data not found!");
            return;
        }

        // Hitung ringkasan bulanan dari semua transaksi
        const monthlySummary = calculateMonthlySummary(allTransactions);

        // Perbarui kartu ringkasan di UI
        updateDashboardCards(userData.totalBalance, monthlySummary.monthlyIncome, monthlySummary.monthlyExpenses);

        // Tampilkan transaksi terbaru di UI
        displayRecentTransactions(allTransactions);

    } catch (error) {
        console.error("Error initializing dashboard:", error);
        // Anda bisa menambahkan pesan error di UI di sini jika diperlukan
    }
}

// ============================================================================
// Data Processing Functions
// ============================================================================
/**
 * Menghitung total pemasukan dan pengeluaran untuk bulan berjalan.
 * @param {object} transactions - Objek berisi semua transaksi pengguna.
 * @returns {object} - Objek dengan properti monthlyIncome dan monthlyExpenses.
 */
function calculateMonthlySummary(transactions) {
    let monthlyIncome = 0;
    let monthlyExpenses = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (!transactions) {
        return { monthlyIncome, monthlyExpenses };
    }

    for (const key in transactions) {
        const tx = transactions[key];
        const txDate = new Date(tx.timestamp);

        // Hanya proses transaksi dari bulan dan tahun saat ini
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
            if (tx.type === 'income') {
                monthlyIncome += tx.amount;
            } else if (tx.type === 'expense') {
                monthlyExpenses += tx.amount;
            }
        }
    }

    return { monthlyIncome, monthlyExpenses };
}

// ============================================================================
// UI Update Functions
// ============================================================================
/**
 * Memperbarui nilai pada kartu ringkasan di dashboard.
 * @param {number} totalBalance - Saldo total pengguna.
 * @param {number} monthlyIncome - Pemasukan bulan ini.
 * @param {number} monthlyExpenses - Pengeluaran bulan ini.
 */
function updateDashboardCards(totalBalance, monthlyIncome, monthlyExpenses) {
    const totalBalanceElement = document.getElementById('totalBalance');
    const monthlyIncomeElement = document.getElementById('monthlyIncome');
    const monthlyExpensesElement = document.getElementById('monthlyExpenses');

    if (totalBalanceElement) {
        totalBalanceElement.textContent = formatRupiah(totalBalance || 0);
    }
    if (monthlyIncomeElement) {
        monthlyIncomeElement.textContent = formatRupiah(monthlyIncome || 0);
    }
    if (monthlyExpensesElement) {
        monthlyExpensesElement.textContent = formatRupiah(monthlyExpenses || 0);
    }
}

/**
 * Menampilkan 5 transaksi terakhir (selain transfer) di dashboard.
 * @param {object} transactions - Objek berisi semua transaksi pengguna.
 */
function displayRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactionsList');
    if (!container) {
        console.error("Recent transactions container not found!");
        return;
    }

    if (!transactions || Object.keys(transactions).length === 0) {
        container.innerHTML = '<p class="empty-state">No recent transactions found.</p>';
        return;
    }

    // Ubah objek menjadi array, filter selain 'transfer', urutkan, dan ambil 5 teratas
    const recentTransactions = Object.values(transactions)
        .filter(tx => tx.type !== 'transfer') // Menyaring transaksi tipe 'transfer'
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);

    if (recentTransactions.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent income or expense transactions.</p>';
        return;
    }

    let html = '';
    recentTransactions.forEach(transaction => {
        const isIncome = transaction.type === 'income';
        const iconClass = isIncome ? 'income' : 'expense';
        const amountClass = isIncome ? 'amount-income' : 'amount-expense';
        const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
        const sign = isIncome ? '+' : '-';
        const date = new Date(transaction.timestamp);
        const formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

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
                    ${sign} ${formatRupiah(transaction.amount)}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}
