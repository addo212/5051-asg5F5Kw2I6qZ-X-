// transactions.js

// ============================================================================
// Module Imports
// ============================================================================
import { auth, db, loadUserData, loadTransactions, saveTransaction, deleteTransaction, updateUserData, updateTransaction } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { paginate, renderPaginationControls } from './pagination.js';
import { formatRupiah } from './utils.js';

// ============================================================================
// Global Variables & Constants
// ============================================================================
let userId;
let allTransactions = {};
let userAccounts = {};
let userWallets = {};
let currentTransactionsArray = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let editingTransactionId = null;

// ============================================================================
// Main Initialization
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
            
            await reloadAndDisplayTransactions();
            initEditModal();

        } catch (error) {
            console.error("Error initializing transactions page:", error);
        }
    } else {
        window.location.href = "index.html";
    }
});

// ============================================================================
// Edit Transaction Modal
// ============================================================================
function initEditModal() {
    if (document.getElementById('editTransactionModal')) return;
    const modalHTML = `
        <div id="editTransactionModal" class="modal">
            <div class="modal-content">
                <span class="close-modal">×</span>
                <h2><i class="fas fa-edit"></i> Edit Transaction</h2>
                <form id="editTransactionForm">
                    <div class="form-group"><label for="editDate">Date:</label><input type="date" id="editDate" required></div>
                    <div class="form-group"><label for="editType">Type:</label><select id="editType" required><option value="expense">Expense</option><option value="income">Income</option></select></div>
                    <div class="form-group"><label for="editAccount">Account:</label><select id="editAccount" required></select></div>
                    <div class="form-group"><label for="editDescription">Description:</label><input type="text" id="editDescription" required></div>
                    <div class="form-group"><label for="editWallet">Wallet:</label><select id="editWallet" required></select></div>
                    <div class="form-group"><label for="editAmount">Amount:</label><input type="number" id="editAmount" required></div>
                    <button type="submit" class="btn-primary">Save Changes</button>
                    <p id="editFormError" class="status-message" style="color: var(--danger-color); display: none;"></p>
                </form>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.querySelector('.close-modal').addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => { if (event.target == document.getElementById('editTransactionModal')) closeEditModal(); });
    document.getElementById('editTransactionForm').addEventListener('submit', handleEditFormSubmit);
    document.getElementById('editType').addEventListener('change', () => loadAccountsForEditForm(userAccounts));
}

function openEditModal(transactionId) {
    const transaction = allTransactions[transactionId];
    if (!transaction) return;
    editingTransactionId = transactionId;
    document.getElementById('editDate').value = transaction.date;
    document.getElementById('editType').value = transaction.type;
    document.getElementById('editDescription').value = transaction.description;
    document.getElementById('editAmount').value = transaction.amount;
    loadAccountsForEditForm(userAccounts);
    loadWalletsForEditForm(userWallets);
    setTimeout(() => {
        document.getElementById('editAccount').value = transaction.account;
        document.getElementById('editWallet').value = transaction.wallet;
    }, 0);
    document.getElementById('editTransactionModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editTransactionModal').style.display = 'none';
    editingTransactionId = null;
}

async function handleEditFormSubmit(e) {
    e.preventDefault();
    if (!editingTransactionId) return;
    const oldTx = allTransactions[editingTransactionId];
    const newTx = {
        date: document.getElementById('editDate').value,
        type: document.getElementById('editType').value,
        account: document.getElementById('editAccount').value,
        description: document.getElementById('editDescription').value,
        wallet: document.getElementById('editWallet').value,
        amount: parseFloat(document.getElementById('editAmount').value),
        timestamp: new Date(document.getElementById('editDate').value).getTime(),
        id: editingTransactionId
    };
    if (Object.values(newTx).some(val => !val && val !== 0)) {
        showEditError('Please fill all fields.');
        return;
    }
    try {
        showLoading();
        const userData = await loadUserData(userId);
        let totalBalance = userData.totalBalance || 0;
        const wallets = userData.wallets || {};
        const updates = {};
        totalBalance = (totalBalance + (oldTx.type === 'income' ? -oldTx.amount : oldTx.amount)) + (newTx.type === 'income' ? newTx.amount : -newTx.amount);
        updates[`/users/${userId}/totalBalance`] = totalBalance;
        const oldWalletId = Object.keys(wallets).find(k => wallets[k].name === oldTx.wallet);
        if (oldWalletId) {
            wallets[oldWalletId].balance += (oldTx.type === 'income' ? -oldTx.amount : oldTx.amount);
        }
        const newWalletId = Object.keys(wallets).find(k => wallets[k].name === newTx.wallet);
        if (newWalletId) {
            wallets[newWalletId].balance += (newTx.type === 'income' ? newTx.amount : -newTx.amount);
        }
        updates[`/users/${userId}/wallets`] = wallets;
        updates[`/users/${userId}/transactions/${editingTransactionId}`] = newTx;
        await update(ref(db), updates);
        await reloadAndDisplayTransactions();
        closeEditModal();
        showSuccessMessage('Transaction updated!');
    } catch (error) {
        console.error("Error updating transaction:", error);
        showEditError('Failed to update transaction.');
    } finally {
        hideLoading();
    }
}

// ============================================================================
// Populate Dropdowns
// ============================================================================
function populateSelect(selectId, options, defaultText) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = `<option value="">${defaultText}</option>`;
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = typeof opt === 'object' ? opt.name : opt;
        option.text = typeof opt === 'object' ? opt.name : opt;
        select.appendChild(option);
    });
}

// ============================================================================
// Functions to Populate Form Dropdowns
// ============================================================================
function loadAccountsForForm(accounts) {
    const typeSelect = document.getElementById('type');
    const accountSelect = document.getElementById('account');

    if (!typeSelect || !accountSelect) return;

    // 1. Ambil nilai yang SEDANG DIPILIH dari dropdown 'Type'
    const selectedType = typeSelect.value;

    // 2. Dapatkan daftar akun yang benar berdasarkan tipe yang dipilih
    const accountList = accounts[selectedType] || [];

    // 3. Kosongkan opsi lama dari dropdown 'Account'
    accountSelect.innerHTML = '<option value="">Select Account</option>';

    // 4. Isi dengan opsi yang baru dan benar
    accountList.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        accountSelect.appendChild(option);
    });
}
// ============================================================================
// Functions to Populate Edit Form Dropdowns
// ============================================================================
function loadAccountsForEditForm(accounts) {
    const typeSelect = document.getElementById('editType');
    const accountsSelect = document.getElementById('editAccount');

    if (!typeSelect || !accountsSelect) return;

    // 1. Ambil nilai yang SEDANG DIPILIH dari dropdown 'Type' di modal edit
    const selectedType = typeSelect.value;

    // 2. Dapatkan daftar akun yang benar
    const accountList = accounts[selectedType] || [];

    // 3. Kosongkan opsi lama
    accountsSelect.innerHTML = '<option value="">Select Account</option>';

    // 4. Isi dengan opsi yang baru
    accountList.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        accountsSelect.appendChild(option);
    });
}

// Event listener ini yang memastikan fungsi di atas dipanggil setiap kali Anda mengubah pilihan
document.getElementById('type')?.addEventListener('change', () => {
    loadAccountsForForm(userAccounts);
});

// ============================================================================
// Filter Logic
// ============================================================================
function loadFilters(accounts, wallets) {
    const allAccountNames = [...new Set([...(accounts.income || []), ...(accounts.expense || [])])];
    populateSelect('filterAccount', allAccountNames, 'All Accounts');
    populateSelect('filterWallet', Object.values(wallets), 'All Wallets');
}

function filterTransactions() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const wallet = document.getElementById('filterWallet').value;
    const account = document.getElementById('filterAccount').value;
    const startTimestamp = startDate ? new Date(startDate).getTime() : 0;
    const endTimestamp = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;

    currentTransactionsArray = Object.values(allTransactions).filter(tx => {
        const matchDate = tx.timestamp >= startTimestamp && tx.timestamp <= endTimestamp;
        const matchAccount = !account || tx.account === account;
        let matchWallet = !wallet;
        if (wallet) {
            matchWallet = tx.type === 'transfer' ? (tx.fromWallet === wallet || tx.toWallet === wallet) : tx.wallet === wallet;
        }
        return matchDate && matchAccount && matchWallet;
    }).sort((a, b) => b.timestamp - a.timestamp);
    
    currentPage = 1;
    displayPage();
}

function resetFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterWallet').value = '';
    document.getElementById('filterAccount').value = '';
    reloadAndDisplayTransactions();
}

// ============================================================================
// Display Logic
// ============================================================================
function displayPage() {
    const { paginatedItems, totalPages } = paginate(currentTransactionsArray, currentPage, ITEMS_PER_PAGE);
    displayTransactions(paginatedItems);
    renderPaginationControls('pagination-container', currentPage, totalPages, handlePageChange);
}

function handlePageChange(newPage) {
    currentPage = newPage;
    displayPage();
}

function displayTransactions(transactionsOnPage) {
    const container = document.getElementById('transactionHistory');
    if (!container) return;
    if (transactionsOnPage.length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions found.</p>';
        return;
    }
    container.innerHTML = `<ul>${transactionsOnPage.map(tx => createTransactionHTML(tx)).join('')}</ul>`;
    attachActionListeners();
}

function createTransactionHTML(tx) {
    let amountClass = '', sign = '', description = tx.description, icon = '', accountInfo = '';
    if (tx.type === 'income') {
        amountClass = 'amount-income'; sign = '+'; icon = '<i class="fas fa-arrow-down"></i>'; accountInfo = `${tx.account} - ${tx.wallet}`;
    } else if (tx.type === 'expense') {
        amountClass = 'amount-expense'; sign = '-'; icon = '<i class="fas fa-arrow-up"></i>'; accountInfo = `${tx.account} - ${tx.wallet}`;
    } else if (tx.type === 'transfer') {
        amountClass = 'amount-transfer'; icon = '<i class="fas fa-exchange-alt"></i>'; description = `Transfer: ${tx.fromWallet} <i class="fas fa-long-arrow-alt-right"></i> ${tx.toWallet}`; accountInfo = tx.account;
    }
    const formattedDate = new Date(tx.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
        <li class="transaction-item">
            <div class="transaction-icon ${tx.type}">${icon}</div>
            <div class="transaction-details">
                <div class="transaction-info"><h4>${description}</h4><p>${formattedDate} - ${accountInfo}</p></div>
            </div>
            <div class="transaction-amount ${amountClass}">${sign} ${formatRupiah(tx.amount)}</div>
            <div class="transaction-actions">
                ${tx.type !== 'transfer' ? `<button class="edit-btn" data-transaction-id="${tx.id}"><i class="fas fa-edit"></i></button>` : ''}
                <button class="delete-btn" data-transaction-id="${tx.id}"><i class="fas fa-trash"></i></button>
            </div>
        </li>`;
}

function attachActionListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.transactionId)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDeleteTransaction(btn.dataset.transactionId)));
}

// ============================================================================
// Core Actions (Add, Delete)
// ============================================================================
async function handleDeleteTransaction(transactionId) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
        showLoading();
        const tx = allTransactions[transactionId];
        if (!tx) throw new Error("Transaction not found.");
        const userData = await loadUserData(userId);
        let totalBalance = userData.totalBalance || 0;
        const wallets = userData.wallets || {};
        const updates = {};
        if (tx.type === 'transfer') {
            const fromWalletId = Object.keys(wallets).find(k => wallets[k].name === tx.fromWallet);
            const toWalletId = Object.keys(wallets).find(k => wallets[k].name === tx.toWallet);
            if (fromWalletId) wallets[fromWalletId].balance += tx.amount;
            if (toWalletId) wallets[toWalletId].balance -= tx.amount;
        } else {
            totalBalance += (tx.type === 'income' ? -tx.amount : tx.amount);
            const walletId = Object.keys(wallets).find(k => wallets[k].name === tx.wallet);
            if (walletId) wallets[walletId].balance += (tx.type === 'income' ? -tx.amount : tx.amount);
        }
        updates[`/users/${userId}/totalBalance`] = totalBalance;
        updates[`/users/${userId}/wallets`] = wallets;
        updates[`/users/${userId}/transactions/${transactionId}`] = null; // Deletion
        await update(ref(db), updates);
        await reloadAndDisplayTransactions();
        showSuccessMessage('Transaction deleted!');
    } catch (error) {
        console.error("Error deleting transaction:", error);
        showError('Failed to delete transaction.');
    } finally {
        hideLoading();
    }
}

document.getElementById('transactionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const transaction = {
        date: document.getElementById('date').value,
        type: document.getElementById('type').value,
        account: document.getElementById('account').value,
        description: document.getElementById('description').value,
        wallet: document.getElementById('wallet').value,
        amount: parseFloat(document.getElementById('amount').value),
    };
    if (Object.values(transaction).some(val => !val && val !== 0)) {
        showError('Please fill all fields.');
        return;
    }
    transaction.timestamp = new Date(transaction.date).getTime();
    try {
        showLoading();
        await saveTransaction(userId, transaction);
        const userData = await loadUserData(userId);
        let totalBalance = userData.totalBalance || 0;
        const walletId = Object.keys(userData.wallets).find(k => userData.wallets[k].name === transaction.wallet);
        if (!walletId) throw new Error("Wallet not found.");
        let walletBalance = userData.wallets[walletId].balance || 0;
        if (transaction.type === 'income') {
            totalBalance += transaction.amount;
            walletBalance += transaction.amount;
        } else {
            totalBalance -= transaction.amount;
            walletBalance -= transaction.amount;
        }
        await updateUserData(userId, { totalBalance });
        await update(ref(db, `users/${userId}/wallets/${walletId}`), { balance: walletBalance });
        e.target.reset();
        await reloadAndDisplayTransactions();
        currentPage = 1;
        displayPage();
        showSuccessMessage('Transaction saved!');
    } catch (error) {
        console.error("Error saving transaction:", error);
        showError('Failed to save transaction.');
    } finally {
        hideLoading();
    }
});

async function reloadAndDisplayTransactions() {
    allTransactions = await loadTransactions(userId) || {};
    currentTransactionsArray = Object.values(allTransactions).sort((a, b) => b.timestamp - a.timestamp);
    const totalPages = Math.ceil(currentTransactionsArray.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    displayPage();
}

// ============================================================================
// UI Helper Functions
// ============================================================================
function showSuccessMessage(message) {
    const el = document.getElementById('successMessage');
    if (el) { el.textContent = message; el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 3000); }
}
function showError(message) {
    const el = document.getElementById('formError');
    if (el) { el.textContent = message; el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 3000); }
}
function showEditError(message) {
    const el = document.getElementById('editFormError');
    if (el) { el.textContent = message; el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 3000); }
}
function showLoading() {
    if (document.querySelector('.loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div> Loading...';
    document.body.appendChild(overlay);
}
function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) overlay.remove();
}

// Event listeners for filter buttons
document.getElementById('applyFilters')?.addEventListener('click', (e) => { e.preventDefault(); filterTransactions(); });
document.getElementById('resetFilters')?.addEventListener('click', (e) => { e.preventDefault(); resetFilters(); });
