// transactions.js
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { updateUserData, loadUserData, saveTransaction, loadTransactions, deleteTransaction, getAccounts, getWallets } from './database.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Global variables
let userId;
let userWallets = {};
let userAccounts = {};

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
        });
        loadTransactions(userId).then((transactions) => {
            displayTransactions(transactions);
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
// Function to display transactions
// ============================================================================
function displayTransactions(transactionsData) {
    const container = document.getElementById('transactionHistory');
    if (!container) return;

    if (!transactionsData || Object.keys(transactionsData).length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions yet.</p>';
        return;
    }

    let html = '<ul>';
    for (const transactionId in transactionsData) {
        const transaction = transactionsData[transactionId];
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
                <button class="delete-btn" data-transaction-id="${transactionId}"><i class="fas fa-trash"></i></button>
            </li>
        `;
    }
    html += '</ul>';
    container.innerHTML = html;

    // Add event listeners to delete buttons after HTML update
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const transactionId = button.dataset.transactionId;
            if (confirm('Are you sure you want to delete this transaction?')) {
                deleteTransaction(userId, transactionId).then(() => {
                    loadUserData(userId).then(userData => {
                        let totalBalance = userData.totalBalance || 0;
                        const deletedTransaction = transactionsData[transactionId];
                        if (deletedTransaction.type === 'income') {
                            totalBalance -= deletedTransaction.amount;
                        } else {
                            totalBalance += deletedTransaction.amount;
                        }
                        updateUserData(userId, { totalBalance: totalBalance }).then(() => {
                            loadTransactions(userId).then((transactions) => {
                                displayTransactions(transactions);
                            });
                        });
                    });
                    showSuccessMessage('Transaction deleted successfully!');
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
        timestamp: new Date(date).getTime()
    };

    await saveTransaction(userId, transaction)
        .then(() => {
            // Update total balance after saving transaction
            loadUserData(userId).then(userData => {
                let totalBalance = userData.totalBalance || 0;
                if (transaction.type === 'income') {
                    totalBalance += transaction.amount;
                } else {
                    totalBalance -= transaction.amount;
                }
                updateUserData(userId, { totalBalance: totalBalance });
            });
        })
        .catch(error => {
            console.error("Error saving transaction:", error);
            showError('Failed to save transaction. Please try again.');
        });
});
