// transactions.js
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { updateUserData, loadUserData, saveTransaction, loadTransactions, deleteTransaction } from './database.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Global variables
let userId;
let userWallets = {};
let userAccounts = {};
let transactionsData = {}; // Store all transactions


// ============================================================================
// Authentication state listener
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        loadUserData(userId).then(userData => {
            userWallets = userData.wallets || {};
            userAccounts = userData.accounts || { income: [], expense: [] };
            loadAccounts();
            loadWallets();
            loadFilters(); // Load filters initially
        });
        loadTransactions(userId).then((transactions) => {
            transactionsData = transactions || {};
            displayTransactions(transactionsData); // Display all transactions initially
        });
    } else {
        window.location.href = "index.html";
    }
});

// ============================================================================
// Function to load accounts from database
// ============================================================================
function loadAccounts() {
    const accountsSelect = document.getElementById('account');
    accountsSelect.innerHTML = '<option value="">Select Account</option>';

    const selectedType = document.getElementById('type').value || 'income';
    const accountList = userAccounts[selectedType] || [];

    accountList.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        accountsSelect.appendChild(option);
    });

    document.getElementById('type').addEventListener('change', () => {
        loadAccounts();
    });
}

// ============================================================================
// Function to load wallets from database
// ============================================================================
function loadWallets() {
    const walletsSelect = document.getElementById('wallet');
    walletsSelect.innerHTML = '<option value="">Select Wallet</option>';

    if (userWallets) {
        Object.keys(userWallets).forEach(walletId => {
            const wallet = userWallets[walletId];
            const option = document.createElement('option');
            option.value = wallet.name;
            option.text = wallet.name;
            walletsSelect.appendChild(option);
        });
    }
}

// ============================================================================
// Function to load filter options
// ============================================================================
function loadFilters() {
    loadFilterWallets();
    loadFilterAccounts();
}

// ============================================================================
// Function to load wallets into filter select
// ============================================================================
function loadFilterWallets() {
    const filterWalletSelect = document.getElementById('filterWallet');
    filterWalletSelect.innerHTML = '<option value="">All Wallets</option>';

    if (userWallets) {
        Object.keys(userWallets).forEach(walletId => {
            const wallet = userWallets[walletId];
            const option = document.createElement('option');
            option.value = wallet.name;
            option.text = wallet.name;
            filterWalletSelect.appendChild(option);
        });
    }
}

// ============================================================================
// Function to load accounts into filter select
// ============================================================================
function loadFilterAccounts() {
    const filterAccountSelect = document.getElementById('filterAccount');
    filterAccountSelect.innerHTML = '<option value="">All Accounts</option>';

    if (userAccounts) {
        const allAccounts = [...(userAccounts.income || []), ...(userAccounts.expense || [])];
        allAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account;
            option.text = account;
            filterAccountSelect.appendChild(option);
        });
    }
}

// ============================================================================
// Function to filter transactions
// ============================================================================
function filterTransactions() {
    const filterStartDate = document.getElementById('filterStartDate').value;
    const filterEndDate = document.getElementById('filterEndDate').value;
    const filterWallet = document.getElementById('filterWallet').value;
    const filterAccount = document.getElementById('filterAccount').value;

    const filteredTransactions = Object.values(transactionsData).filter(transaction => {
        const transactionDate = new Date(transaction.date);
        const startDate = filterStartDate ? new Date(filterStartDate) : null;
        const endDate = filterEndDate ? new Date(filterEndDate) : null;

        const matchesDate = (!startDate || transactionDate >= startDate) && (!endDate || transactionDate <= endDate);
        const matchesWallet = !filterWallet || transaction.wallet === filterWallet;
        const matchesAccount = !filterAccount || transaction.account === filterAccount;

        return matchesDate && matchesWallet && matchesAccount;
    });

    displayTransactions(filteredTransactions);
}

// ============================================================================
// Function to reset filters
// ============================================================================
function resetFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterWallet').value = '';
    document.getElementById('filterAccount').value = '';
    displayTransactions(transactionsData); // Tampilkan semua transaksi
}

// ============================================================================
// Event listeners for filter and reset buttons
// ============================================================================
document.getElementById('applyFilters').addEventListener('click', (e) => {
    e.preventDefault();
    filterTransactions();
});

document.getElementById('resetFilters').addEventListener('click', (e) => {
    e.preventDefault();
    resetFilters();
});

// ============================================================================
// Function to display transactions
// ============================================================================
function displayTransactions(transactions) {
    const container = document.getElementById('transactionHistory');
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions yet or no transactions match the filter.</p>';
        return;
    }

    let html = '<ul>';
    transactions.forEach(transaction => {
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

    // Tambahkan event listener untuk tombol hapus setelah HTML di-update
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const transactionId = button.dataset.transactionId;
            if (confirm('Are you sure you want to delete this transaction?')) {
                deleteTransaction(userId, transactionId).then(() => {
                    loadUserData(userId).then(userData => {
                        let totalBalance = userData.totalBalance || 0;
                        const deletedTransaction = transactions.find(t => t.id === transactionId); // Find the deleted transaction
                        if (deletedTransaction) {
                            if (deletedTransaction.type === 'income') {
                                totalBalance -= deletedTransaction.amount;
                            } else {
                                totalBalance += deletedTransaction.amount;
                            }
                            updateUserData(userId, { totalBalance: totalBalance });
                        }
                    });
                    showSuccessMessage('Transaction deleted successfully!');
                    loadTransactions(userId).then((transactions) => {
                        displayTransactions(transactions);
                    });
                }).catch(error => {
                    console.error("Error deleting transaction:", error);
                    showError('Failed to delete transaction. Please try again.');
                });
            }
        });
    });
}


// ============================================================================
// Function to display success message
// ============================================================================
function showSuccessMessage(message) {
    const successMessage = document.createElement('p');
    successMessage.textContent = message;
    successMessage.classList.add('success-message');
    document.body.appendChild(successMessage);

    setTimeout(() => {
        successMessage.remove();
    }, 3000);
}

// ============================================================================
// Function to display error message
// ============================================================================
function showError(message) {
    const errorElement = document.getElementById('formError');
    errorElement.textContent = message;
    errorElement.style.display = 'block';

    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 3000);
}

// ============================================================================
// Function to show loading indicator
// ============================================================================
function showLoading() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.classList.add('loading-overlay');
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div> Loading...';
    document.body.appendChild(loadingOverlay);
}

// ============================================================================
// Function to hide loading indicator
// ============================================================================
function hideLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

// ============================================================================
// Event listener for transaction form submission
// ============================================================================
document.getElementById('transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const date = document.getElementById('date').value;
    const type = document.getElementById('type').value;
    const account = document.getElementById('account').value;
    const description = document.getElementById('description').value;
    const wallet = document.getElementById('wallet').value;
    let amount = parseFloat(document.getElementById('amount').value);

    // Validasi input
    if (!date) {
        showError('Please select a date.');
        return;
    }
    if (!type) {
        showError('Please select a transaction type.');
        return;
    }
    if (!account) {
        showError('Please select an account.');
        return;
    }
    if (!description) {
        showError('Please enter a description.');
        return;
    }
    if (!wallet) {
        showError('Please select a wallet.');
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        showError('Please enter a valid amount.');
        return;
    }

    const transaction = {
        date,
        type,
        account,
        description,
        wallet,
        amount,
        timestamp: new Date(date).getTime(),
        id: generateUUID() // Generate a unique ID for the transaction
    };

    try {
        showLoading();
        await saveTransaction(userId, transaction);
        // Update total balance after saving transaction
        const userData = await loadUserData(userId);
        let totalBalance = userData.totalBalance || 0;
        if (transaction.type === 'income') {
            totalBalance += transaction.amount;
        } else {
            totalBalance -= transaction.amount;
        }

        // Update wallet balance
        const walletId = Object.keys(userData.wallets).find(key => userData.wallets[key].name === wallet);
        let walletBalance = userData.wallets[walletId].balance || 0;
        if (transaction.type === 'income') {
            walletBalance += transaction.amount;
        } else {
            walletBalance -= transaction.amount;
        }

        await update(ref(db, `users/${userId}/wallets/${walletId}`), { balance: walletBalance });

        await updateUserData(userId, { totalBalance: totalBalance });
        displayTransactions(await loadTransactions(userId)); // Reload and display transactions
        showSuccessMessage('Transaction saved successfully!');

    } catch (error) {
        console.error("Error saving transaction:", error);
        showError('Failed to save transaction. Please try again.');
    } finally {
        hideLoading();
    }
});


function generateUUID() { // Public Domain/MIT
    var d = new Date().getTime();//Timestamp
    var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now()*1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16;//random number between 0 and 16
        if(d > 0){//Use timestamp until depleted
            r = (d + r)%16 | 0;
            d = Math.floor(d/16);
        } else {//Use microseconds since page-load if supported
            r = (d2 + r)%16 | 0;
            d2 = Math.floor(d2/16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
