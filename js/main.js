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
async function initializeDashboard() {
    try {
        console.log("Initializing dashboard...");
        
        // Tampilkan loading state
        document.getElementById('recentTransactionsList').innerHTML = '<p class="empty-state">Loading recent transactions...</p>';
        
        // Memuat data pengguna dan transaksi secara bersamaan
        const [userData, transactionsData] = await Promise.all([
            loadUserData(userId),
            loadTransactions(userId)
        ]);

        console.log("Data loaded:", { userData, transactionsHasData: !!transactionsData });

        if (!userData) {
            console.error("User data not found!");
            return;
        }

        // Hitung ringkasan bulanan dari semua transaksi
        const monthlySummary = calculateMonthlySummary(transactionsData);

        // Perbarui kartu ringkasan di UI
        updateDashboardCards(userData.totalBalance, monthlySummary.monthlyIncome, monthlySummary.monthlyExpenses);

        // Tampilkan transaksi terbaru di UI
        displayRecentTransactions(transactionsData);

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

    // Konversi objek transaksi menjadi array jika perlu
    const transactionsArray = typeof transactions === 'object' && !Array.isArray(transactions) 
        ? Object.values(transactions) 
        : transactions;

    transactionsArray.forEach(tx => {
        if (!tx || !tx.timestamp) return;
        
        const txDate = new Date(tx.timestamp);
        
        // Hanya proses transaksi dari bulan dan tahun saat ini
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

// ============================================================================
// UI Update Functions
// ============================================================================
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

    // Konversi objek transaksi menjadi array
    let transactionsArray = [];
    
    if (Array.isArray(transactions)) {
        transactionsArray = transactions;
    } else {
        // Konversi dari objek ke array
        transactionsArray = Object.keys(transactions).map(key => ({
            id: key,
            ...transactions[key]
        }));
    }
    
    console.log(`Found ${transactionsArray.length} transactions total`);

    // Filter transaksi yang valid (memiliki timestamp dan type)
    const validTransactions = transactionsArray.filter(tx => 
        tx && tx.timestamp && tx.type && (tx.type === 'income' || tx.type === 'expense')
    );
    
    console.log(`Found ${validTransactions.length} valid transactions`);

    // Urutkan berdasarkan timestamp terbaru
    validTransactions.sort((a, b) => b.timestamp - a.timestamp);
    
    // Ambil 5 transaksi teratas
    const recentTransactions = validTransactions.slice(0, 5);
    
    console.log(`Displaying ${recentTransactions.length} recent transactions`);

    if (recentTransactions.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent transactions found.</p>';
        return;
    }

    let html = '';
    recentTransactions.forEach(transaction => {
        const isIncome = transaction.type === 'income';
        const iconClass = isIncome ? 'income' : 'expense';
        const amountClass = isIncome ? 'amount-income' : 'amount-expense';
        const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
        const sign = isIncome ? '+' : '-';
        
        // Pastikan timestamp adalah angka
        const timestamp = typeof transaction.timestamp === 'number' 
            ? transaction.timestamp 
            : parseInt(transaction.timestamp);
            
        const date = new Date(timestamp);
        const formattedDate = date.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        });

        html += `
            <div class="transaction-item">
                <div class="transaction-details">
                    <div class="transaction-icon ${iconClass}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="transaction-info">
                        <h4>${transaction.description || 'Transaction'}</h4>
                        <p>${formattedDate} - ${transaction.account || 'Unknown'}</p>
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
