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
        // Memulai semua proses untuk dashboard
        initializeDashboard();
        // Memasang event listener setelah pengguna dipastikan login
        setupEventListeners();
    } else {
        // Jika tidak ada pengguna, arahkan kembali ke halaman login
        window.location.href = "index.html";
    }
});

// ============================================================================
// Event Listeners
// ============================================================================
/**
 * Fungsi untuk memasang semua event listener yang dibutuhkan di halaman dashboard.
 */
function setupEventListeners() {
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
}

// ============================================================================
// Core Dashboard Logic
// ============================================================================
/**
 * Fungsi utama untuk menginisialisasi semua data dan tampilan di dashboard.
 */
async function initializeDashboard() {
    try {
        // Memuat data pengguna dan transaksi secara bersamaan untuk efisiensi
        const [userData, allTransactions] = await Promise.all([
            loadUserData(userId),
            loadTransactions(userId)
        ]);

        if (!userData) {
            console.error("User data not found! Cannot initialize dashboard.");
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
        // Tampilkan pesan error di UI jika perlu
        document.getElementById('recentTransactionsList').innerHTML = '<p class="empty-state">Could not load dashboard data.</p>';
    }
}

// ============================================================================
// Data Processing Functions
// ============================================================================
/**
 * Menghitung total pemasukan dan pengeluaran untuk bulan berjalan.
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
 */
function updateDashboardCards(totalBalance, monthlyIncome, monthlyExpenses) {
    const totalBalanceElement = document.getElementById('totalBalance');
    const monthlyIncomeElement = document.getElementById('monthlyIncome');
    const monthlyExpensesElement = document.getElementById('monthlyExpenses');

    if (totalBalanceElement) totalBalanceElement.textContent = formatRupiah(totalBalance || 0);
    if (monthlyIncomeElement) monthlyIncomeElement.textContent = formatRupiah(monthlyIncome || 0);
    if (monthlyExpensesElement) monthlyExpensesElement.textContent = formatRupiah(monthlyExpenses || 0);
}

/**
 * Menampilkan 5 transaksi terakhir (selain transfer) di dashboard.
 */
function displayRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactionsList');
    if (!container) {
        console.error("Recent transactions container not found!");
        return;
    }

    if (!transactions || Object.keys(transactions).length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions have been recorded yet.</p>';
        return;
    }

    // Ubah objek menjadi array, filter selain 'transfer', urutkan, dan ambil 5 teratas
    const recentTransactions = Object.values(transactions)
        .filter(tx => tx.type !== 'transfer')
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
