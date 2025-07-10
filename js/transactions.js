// transactions.js
import { auth, db, loadUserData, loadTransactions, saveTransaction, deleteTransaction, updateUserData } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// ============================================================================
// Global Variables
// ============================================================================
let userId;
let allTransactions = {};
let userAccounts = {};
let userWallets = {};

// ============================================================================
// Main Initialization on Auth State Change
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid;
        try {
            const userData = await loadUserData(userId);
            if (userData) {
                userAccounts = userData.accounts || { income: [], expense: [] };
                userWallets = userData.wallets || {};
                // Muat dropdown untuk form dan filter
                loadAccounts(userAccounts);
                loadWallets(userWallets);
                loadFilters(userAccounts, userWallets);
            }
            
            allTransactions = await loadTransactions(userId);
            // Ubah objek transaksi menjadi array untuk ditampilkan
            const transactionsArray = Object.keys(allTransactions).map(key => ({
                id: key,
                ...allTransactions[key]
            }));
            displayTransactions(transactionsArray);

        } catch (error) {
            console.error("Error initializing transactions page:", error);
        }
    } else {
        window.location.href = "index.html";
    }
});

// ============================================================================
// Function to load accounts into form dropdown
// ============================================================================
function loadAccounts(accounts) {
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

// Event listener for transaction type change
document.getElementById('type')?.addEventListener('change', () => {
    loadAccounts(userAccounts);
});

// ============================================================================
// Function to load wallets into form dropdown
// ============================================================================
function loadWallets(wallets) {
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

    displayTransactions(filtered);
}

function resetFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterWallet').value = '';
    document.getElementById('filterAccount').value = '';
    const transactionsArray = Object.keys(allTransactions).map(key => ({
        id: key,
        ...allTransactions[key]
    }));
    displayTransactions(transactionsArray);
}

// Event listeners for filter buttons
document.getElementById('applyFilters')?.addEventListener('click', (e) => {
    e.preventDefault();
    filterTransactions();
});

document.getElementById('resetFilters')?.addEventListener('click', (e) => {
    e.preventDefault();
    resetFilters();
});

// ============================================================================
// Function to display transactions
// ============================================================================
function displayTransactions(transactionsArray) {
    const container = document.getElementById('transactionHistory');
    if (!container) return;

    transactionsArray.sort((a, b) => b.timestamp - a.timestamp);

    if (!transactionsArray || transactionsArray.length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions found.</p>';
        return;
    }

    let html = '<ul>';
    transactionsArray.forEach(transaction => {
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

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const transactionId = button.dataset.transactionId;
            if (confirm('Are you sure you want to delete this transaction?')) {
                try {
                    showLoading();
                    const deletedTransaction = allTransactions[transactionId];
                    if (!deletedTransaction) throw new Error("Transaction not found");

                    // Hapus transaksi dari database
                    await deleteTransaction(userId, transactionId);

                    // Update saldo
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
                    await update(ref(db, `users/${userId}/wallets/${walletId}`), { balance: walletBalance });

                    showSuccessMessage('Transaction deleted successfully!');
                    
                    // Muat ulang data dan tampilkan lagi
                    allTransactions = await loadTransactions(userId);
                    const updatedTransactionsArray = Object.keys(allTransactions).map(key => ({ id: key, ...allTransactions[key] }));
                    displayTransactions(updatedTransactionsArray);

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
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 3000);
    }
}

function showError(message) {
    const errorElement = document.getElementById('formError');
    if(errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 3000);
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

    // Validation
    if (!date || !type || !account || !description || !wallet || isNaN(amount) || amount <= 0) {
        showError('Please fill all fields with valid data.');
        return;
    }

    const transaction = {
        date,
        type,
        account,
        description,
        wallet,
        amount,
        timestamp: new Date(date).getTime()
    };

    try {
        showLoading();
        // Simpan transaksi
        await saveTransaction(userId, transaction);

        // Update saldo
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

        showSuccessMessage('Transaction saved successfully!');
        e.target.reset(); // Reset form
        
        // Muat ulang data dan tampilkan lagi
        allTransactions = await loadTransactions(userId);
        const updatedTransactionsArray = Object.keys(allTransactions).map(key => ({ id: key, ...allTransactions[key] }));
        displayTransactions(updatedTransactionsArray);

    } catch (error) {
        console.error("Error saving transaction:", error);
        showError('Failed to save transaction. Please try again.');
    } finally {
        hideLoading();
    }
});
