// transactions.js

// ============================================================================
// Module Imports
// ============================================================================
// Impor fungsi dan instance yang dibutuhkan dari file database.js terpusat
import { auth, db, loadUserData, loadTransactions, saveTransaction, deleteTransaction, updateUserData } from './database.js';
// Impor fungsi spesifik dari Firebase SDK
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
// Impor fungsi pagination baru kita
import { paginate, renderPaginationControls } from './pagination.js';

// ============================================================================
// Global Variables & Constants
// ============================================================================
let userId;
let allTransactions = {};                 // Objek untuk menyimpan semua transaksi dari database
let userAccounts = {};                    // Menyimpan data akun pengguna
let userWallets = {};                     // Menyimpan data dompet pengguna
let currentTransactionsArray = [];        // Array yang akan ditampilkan (bisa semua atau hasil filter)
let currentPage = 1;                      // Halaman saat ini untuk pagination
const ITEMS_PER_PAGE = 10;                // Tampilkan 10 transaksi per halaman (bisa diubah)

// ============================================================================
// Main Initialization on Auth State Change (Titik Awal Eksekusi)
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid;
        try {
            const userData = await loadUserData(userId);
            if (userData) {
                userAccounts = userData.accounts || { income: [], expense: [] };
                userWallets = userData.wallets || {};
                loadAccountsForForm(userAccounts);
                loadWalletsForForm(userWallets);
                loadFilters(userAccounts, userWallets);
            }
            
            allTransactions = await loadTransactions(userId);
            // Siapkan array transaksi untuk ditampilkan, diurutkan dari yang terbaru
            currentTransactionsArray = Object.keys(allTransactions)
                .map(key => ({ id: key, ...allTransactions[key] }))
                .sort((a, b) => b.timestamp - a.timestamp);
            
            // Tampilkan halaman pertama dari data awal
            displayPage();

        } catch (error) {
            console.error("Error initializing transactions page:", error);
        }
    } else {
        window.location.href = "index.html";
    }
});

// ============================================================================
// Core Display Logic with Pagination
// ============================================================================
/**
 * Fungsi utama untuk mengatur tampilan.
 * Memanggil fungsi paginate, menampilkan item, dan merender kontrol pagination.
 */
function displayPage() {
    const { paginatedItems, totalPages } = paginate(currentTransactionsArray, currentPage, ITEMS_PER_PAGE);
    displayTransactions(paginatedItems);
    renderPaginationControls('pagination-container', currentPage, totalPages, handlePageChange);
}

/**
 * Callback yang dipanggil saat pengguna mengklik tombol halaman.
 * @param {number} newPage - Nomor halaman baru yang akan ditampilkan.
 */
function handlePageChange(newPage) {
    currentPage = newPage;
    displayPage();
}

// ============================================================================
// Functions to Populate Form Dropdowns
// ============================================================================
function loadAccountsForForm(accounts) {
    const accountsSelect = document.getElementById('account');
    if (!accountsSelect) return;
    accountsSelect.innerHTML = '<option value="">Select Account</option>';
    const selectedType = document.getElementById('type').value || 'income';
    const accountList = accounts[selectedType] || [];
    accountList.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        accountsSelect.appendChild(option);
    });
}

document.getElementById('type')?.addEventListener('change', () => {
    loadAccountsForForm(userAccounts);
});

function loadWalletsForForm(wallets) {
    const walletsSelect = document.getElementById('wallet');
    if (!walletsSelect) return;
    walletsSelect.innerHTML = '<option value="">Select Wallet</option>';
    Object.keys(wallets).forEach(walletId => {
        const wallet = wallets[walletId];
        const option = document.createElement('option');
        option.value = wallet.name;
        option.text = wallet.name;
        walletsSelect.appendChild(option);
    });
}

// ============================================================================
// Filter Functions
// ============================================================================
function loadFilters(accounts, wallets) {
    loadFilterWallets(wallets);
    loadFilterAccounts(accounts);
}

function loadFilterWallets(wallets) {
    const filterWalletSelect = document.getElementById('filterWallet');
    if (!filterWalletSelect) return;
    filterWalletSelect.innerHTML = '<option value="">All Wallets</option>';
    Object.keys(wallets).forEach(walletId => {
        const wallet = wallets[walletId];
        const option = document.createElement('option');
        option.value = wallet.name;
        option.text = wallet.name;
        filterWalletSelect.appendChild(option);
    });
}

function loadFilterAccounts(accounts) {
    const filterAccountSelect = document.getElementById('filterAccount');
    if (!filterAccountSelect) return;
    filterAccountSelect.innerHTML = '<option value="">All Accounts</option>';
    const allAccounts = [...(accounts.income || []), ...(accounts.expense || [])];
    const uniqueAccounts = [...new Set(allAccounts)];
    uniqueAccounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        filterAccountSelect.appendChild(option);
    });
}

function filterTransactions() {
    const filterStartDate = document.getElementById('filterStartDate').value;
    const filterEndDate = document.getElementById('filterEndDate').value;
    const filterWallet = document.getElementById('filterWallet').value;
    const filterAccount = document.getElementById('filterAccount').value;

    const filtered = Object.keys(allTransactions).filter(key => {
        const transaction = allTransactions[key];
        const transactionDate = new Date(transaction.date);
        const startDate = filterStartDate ? new Date(filterStartDate) : null;
        const endDate = filterEndDate ? new Date(filterEndDate) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999);
        const matchesDate = (!startDate || transactionDate >= startDate) && (!endDate || transactionDate <= endDate);
        const matchesWallet = !filterWallet || transaction.wallet === filterWallet;
        const matchesAccount = !filterAccount || transaction.account === filterAccount;
        return matchesDate && matchesWallet && matchesAccount;
    }).map(key => ({ id: key, ...allTransactions[key] }));

    // Setelah memfilter, perbarui array utama dan reset ke halaman 1
    currentTransactionsArray = filtered.sort((a, b) => b.timestamp - a.timestamp);
    currentPage = 1;
    displayPage();
}

function resetFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterWallet').value = '';
    document.getElementById('filterAccount').value = '';
    
    // Setelah mereset, kembalikan array utama ke semua transaksi dan reset ke halaman 1
    currentTransactionsArray = Object.keys(allTransactions)
        .map(key => ({ id: key, ...allTransactions[key] }))
        .sort((a, b) => b.timestamp - a.timestamp);
    currentPage = 1;
    displayPage();
}

document.getElementById('applyFilters')?.addEventListener('click', (e) => {
    e.preventDefault();
    filterTransactions();
});

document.getElementById('resetFilters')?.addEventListener('click', (e) => {
    e.preventDefault();
    resetFilters();
});

// ============================================================================
// Function to display transactions (sekarang hanya menampilkan item per halaman)
// ============================================================================
function displayTransactions(transactionsOnPage) {
    const container = document.getElementById('transactionHistory');
    if (!container) return;

    if (!transactionsOnPage || transactionsOnPage.length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions found for the current filter or page.</p>';
        return;
    }

    let html = '<ul>';
    transactionsOnPage.forEach(transaction => {
        const isIncome = transaction.type === 'income';
        const amountClass = isIncome ? 'amount-income' : 'amount-expense';
        const sign = isIncome ? '+' : '-';
        const date = new Date(transaction.timestamp);
        const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        html += `
            <li class="transaction-item">
                <div class="transaction-details">
                    <div class="transaction-info">
                        <h4>${transaction.description || 'Transaction'}</h4>
                        <p>${formattedDate} - ${transaction.account} - ${transaction.wallet}</p>
                    </div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${sign}$${Math.abs(transaction.amount).toFixed(2)}
                </div>
                <button class="delete-btn" data-transaction-id="${transaction.id}"><i class="fas fa-trash"></i></button>
            </li>
        `;
    });
    html += '</ul>';
    container.innerHTML = html;

    // Tambahkan event listener untuk tombol hapus
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const transactionId = button.dataset.transactionId;
            if (confirm('Are you sure you want to delete this transaction?')) {
                try {
                    showLoading();
                    const deletedTransaction = allTransactions[transactionId];
                    if (!deletedTransaction) throw new Error("Transaction not found");

                    await deleteTransaction(userId, transactionId);

                    const userData = await loadUserData(userId);
                    let totalBalance = userData.totalBalance || 0;
                    const walletId = Object.keys(userData.wallets).find(key => userData.wallets[key].name === deletedTransaction.wallet);
                    let walletBalance = userData.wallets[walletId]?.balance || 0;

                    if (deletedTransaction.type === 'income') {
                        totalBalance -= deletedTransaction.amount;
                        walletBalance -= deletedTransaction.amount;
                    } else {
                        totalBalance += deletedTransaction.amount;
                        walletBalance += deletedTransaction.amount;
                    }

                    await updateUserData(userId, { totalBalance: totalBalance });
                    if (walletId) {
                        await update(ref(db, `users/${userId}/wallets/${walletId}`), { balance: walletBalance });
                    }
                    
                    allTransactions = await loadTransactions(userId);
                    currentTransactionsArray = Object.keys(allTransactions)
                        .map(key => ({ id: key, ...allTransactions[key] }))
                        .sort((a, b) => b.timestamp - a.timestamp);

                    const totalPages = Math.ceil(currentTransactionsArray.length / ITEMS_PER_PAGE);
                    if (currentPage > totalPages && totalPages > 0) {
                        currentPage = totalPages;
                    }
                    
                    displayPage();
                    showSuccessMessage('Transaction deleted successfully!');
                } catch (error) {
                    console.error("Error deleting transaction:", error);
                    showError('Failed to delete transaction. Please try again.');
                } finally {
                    hideLoading();
                }
            }
        });
    });
}

// ============================================================================
// UI Helper Functions (Messages and Loading)
// ============================================================================
function showSuccessMessage(message) {
    const successElement = document.getElementById('successMessage');
    if(successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
        setTimeout(() => { successElement.style.display = 'none'; }, 3000);
    }
}

function showError(message) {
    const errorElement = document.getElementById('formError');
    if(errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => { errorElement.style.display = 'none'; }, 3000);
    }
}

function showLoading() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.classList.add('loading-overlay');
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div> Loading...';
    document.body.appendChild(loadingOverlay);
}

function hideLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

// ============================================================================
// Event listener for transaction form submission
// ============================================================================
document.getElementById('transactionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('date').value;
    const type = document.getElementById('type').value;
    const account = document.getElementById('account').value;
    const description = document.getElementById('description').value;
    const wallet = document.getElementById('wallet').value;
    let amount = parseFloat(document.getElementById('amount').value);

    if (!date || !type || !account || !description || !wallet || isNaN(amount) || amount <= 0) {
        showError('Please fill all fields with valid data.');
        return;
    }

    const transaction = { date, type, account, description, wallet, amount, timestamp: new Date(date).getTime() };

    try {
        showLoading();
        await saveTransaction(userId, transaction);

        const userData = await loadUserData(userId);
        let totalBalance = userData.totalBalance || 0;
        const walletId = Object.keys(userData.wallets).find(key => userData.wallets[key].name === wallet);
        if (!walletId) throw new Error("Wallet not found for update.");
        
        let walletBalance = userData.wallets[walletId].balance || 0;

        if (transaction.type === 'income') {
            totalBalance += transaction.amount;
            walletBalance += transaction.amount;
        } else {
            totalBalance -= transaction.amount;
            walletBalance -= transaction.amount;
        }

        await updateUserData(userId, { totalBalance: totalBalance });
        await update(ref(db, `users/${userId}/wallets/${walletId}`), { balance: walletBalance });

        e.target.reset();
        
        allTransactions = await loadTransactions(userId);
        currentTransactionsArray = Object.keys(allTransactions)
            .map(key => ({ id: key, ...allTransactions[key] }))
            .sort((a, b) => b.timestamp - a.timestamp);
        
        currentPage = 1; // Selalu kembali ke halaman pertama setelah menambah data baru
        displayPage();
        showSuccessMessage('Transaction saved successfully!');
    } catch (error) {
        console.error("Error saving transaction:", error);
        showError('Failed to save transaction. Please try again.');
    } finally {
        hideLoading();
    }
});
