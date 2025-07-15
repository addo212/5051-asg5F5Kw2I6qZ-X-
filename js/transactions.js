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
let allTransactions = [];
let userAccounts = {};
let userWallets = {};
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let editingTransactionId = null;

let sortColumn = 'timestamp';
let sortDirection = 'desc';

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
            
            const transactionsData = await loadTransactions(userId) || {};
            allTransactions = Object.entries(transactionsData).map(([id, tx]) => ({ id, ...tx }));
            
            displayPage();
            initEditModal();
            setupEventListeners();

        } catch (error) {
            console.error("Error initializing transactions page:", error);
        }
    } else {
        window.location.href = "index.html";
    }
});

// ============================================================================
// Event Listeners (FUNGSI YANG DIPERBAIKI)
// ============================================================================
function setupEventListeners() {
    // Form submission
    document.getElementById('transactionForm')?.addEventListener('submit', handleTransactionFormSubmit);
    document.getElementById('type')?.addEventListener('change', () => loadAccountsForForm(userAccounts));

    // --- FILTER LIVE ---
    // Setiap kali ada perubahan pada filter ini, panggil displayPage()
    document.getElementById('transactionSearch')?.addEventListener('input', displayPage);
    document.getElementById('filterStartDate')?.addEventListener('change', displayPage);
    document.getElementById('filterEndDate')?.addEventListener('change', displayPage);
    document.getElementById('filterWallet')?.addEventListener('change', displayPage);
    document.getElementById('filterAccount')?.addEventListener('change', displayPage);
    document.getElementById('filterType')?.addEventListener('change', displayPage);

    // Sorting
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.column;
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'desc';
            }
            displayPage();
        });
    });

    // Panel filter collapsible
    const toggleFilterBtn = document.getElementById('toggleFilterBtn');
    const filterPanel = document.getElementById('filterPanel');
    if (toggleFilterBtn && filterPanel) {
        toggleFilterBtn.addEventListener('click', () => filterPanel.classList.toggle('show'));
    }

    // Tombol Reset
    document.getElementById('resetFilters')?.addEventListener('click', () => {
        resetFilters();
        filterPanel?.classList.remove('show');
    });
}

// ============================================================================
// Filtering and Sorting
// ============================================================================
function getFilteredAndSortedTransactions() {
    const filterStartDate = document.getElementById('filterStartDate')?.value;
    const filterEndDate = document.getElementById('filterEndDate')?.value;
    const filterWallet = document.getElementById('filterWallet')?.value;
    const filterAccount = document.getElementById('filterAccount')?.value;
    const filterType = document.getElementById('filterType')?.value;
    const searchTerm = document.getElementById('transactionSearch')?.value?.toLowerCase() || '';

    const startDate = filterStartDate ? new Date(filterStartDate).getTime() : null;
    const endDate = filterEndDate ? new Date(filterEndDate).setHours(23, 59, 59, 999) : null;

    let filtered = allTransactions.filter(tx => {
        const matchesDate = (!startDate || tx.timestamp >= startDate) && (!endDate || tx.timestamp <= endDate);
        const matchesWallet = !filterWallet || tx.wallet === filterWallet;
        const matchesAccount = !filterAccount || tx.account === filterAccount;
        const matchesType = !filterType || tx.type === filterType;
        
        const matchesSearch = !searchTerm || 
            (tx.description && tx.description.toLowerCase().includes(searchTerm)) ||
            (tx.account && tx.account.toLowerCase().includes(searchTerm)) ||
            (tx.wallet && tx.wallet.toLowerCase().includes(searchTerm));
        
        return matchesDate && matchesWallet && matchesAccount && matchesType && matchesSearch;
    });

    filtered.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
}

function resetFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterWallet').value = '';
    document.getElementById('filterAccount').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('transactionSearch').value = '';
    displayPage();
}

// ============================================================================
// Core Display Logic
// ============================================================================
function displayPage() {
    // Selalu reset ke halaman pertama saat filter berubah
    currentPage = 1; 
    const processedTransactions = getFilteredAndSortedTransactions();
    const { paginatedItems, totalPages } = paginate(processedTransactions, currentPage, ITEMS_PER_PAGE);
    
    displayTransactionsInTable(paginatedItems);
    renderPaginationControls('pagination-container', currentPage, totalPages, handlePageChange);
    updateSortIcons();
}

function handlePageChange(newPage) {
    currentPage = newPage;
    // Saat mengganti halaman, kita tidak perlu memfilter ulang, hanya paginasi ulang
    const processedTransactions = getFilteredAndSortedTransactions();
    const { paginatedItems, totalPages } = paginate(processedTransactions, currentPage, ITEMS_PER_PAGE);
    displayTransactionsInTable(paginatedItems);
    renderPaginationControls('pagination-container', currentPage, totalPages, handlePageChange);
}

// ============================================================================
// UI Rendering
// ============================================================================
function displayTransactionsInTable(transactionsOnPage) {
    const tableBody = document.getElementById('transactionHistoryBody');
    if (!tableBody) return;

    if (!transactionsOnPage || transactionsOnPage.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="empty-state">No transactions found for the selected criteria.</td></tr>';
        return;
    }

    let html = '';
    transactionsOnPage.forEach(tx => {
        const date = new Date(tx.timestamp);
        const formattedDate = date.toLocaleDateString('en-CA');

        html += `
            <tr>
                <td>${formattedDate}</td>
                <td>${tx.description || ''}</td>
                <td>${tx.account || ''}</td>
                <td>${tx.wallet || ''}</td>
                <td class="type-cell"><span class="${tx.type}">${tx.type}</span></td>
                <td class="${tx.type === 'income' ? 'amount-income' : 'amount-expense'}">${formatRupiah(tx.amount)}</td>
                <td class="transaction-actions">
                    <button class="edit-btn" data-transaction-id="${tx.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" data-transaction-id="${tx.id}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;

    tableBody.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', () => openEditModal(button.dataset.transactionId));
    });
    tableBody.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => handleDeleteTransaction(button.dataset.transactionId));
    });
}

function updateSortIcons() {
    document.querySelectorAll('.sortable').forEach(header => {
        const icon = header.querySelector('.sort-icon');
        const column = header.dataset.column;
        icon.className = 'fas sort-icon';
        if (column === sortColumn) {
            icon.classList.add(sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
        } else {
            icon.classList.add('fa-sort');
        }
    });
}

// ============================================================================
// Form and Filter Population
// ============================================================================
function loadAccountsForForm(accounts) {
    const typeSelect = document.getElementById('type');
    const accountSelect = document.getElementById('account');
    if (!typeSelect || !accountSelect) return;
    const selectedType = typeSelect.value;
    const accountList = accounts[selectedType] || [];
    accountSelect.innerHTML = '<option value="">Select Account</option>';
    accountList.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        accountSelect.appendChild(option);
    });
}

function loadWalletsForForm(wallets) {
    const walletsSelect = document.getElementById('wallet');
    if (!walletsSelect) return;
    walletsSelect.innerHTML = '<option value="">Select Wallet</option>';
    Object.values(wallets).forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.name;
        option.text = wallet.name;
        walletsSelect.appendChild(option);
    });
}

function loadFilters(accounts, wallets) {
    loadFilterWallets(wallets);
    loadFilterAccounts(accounts);
}

function loadFilterWallets(wallets) {
    const filterWalletSelect = document.getElementById('filterWallet');
    if (!filterWalletSelect) return;
    filterWalletSelect.innerHTML = '<option value="">All Wallets</option>';
    Object.values(wallets).forEach(wallet => {
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

// ============================================================================
// CRUD Operations
// ============================================================================
async function handleTransactionFormSubmit(e) {
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

        await updateUserData(userId, { totalBalance });
        await update(ref(db, `users/${userId}/wallets/${walletId}`), { balance: walletBalance });

        e.target.reset();
        
        const transactionsData = await loadTransactions(userId) || {};
        allTransactions = Object.entries(transactionsData).map(([id, tx]) => ({ id, ...tx }));
        
        displayPage();
        showSuccessMessage('Transaction saved successfully!');
    } catch (error) {
        console.error("Error saving transaction:", error);
        showError('Failed to save transaction. Please try again.');
    } finally {
        hideLoading();
    }
}

async function handleDeleteTransaction(transactionId) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        try {
            showLoading();
            const deletedTransaction = allTransactions.find(tx => tx.id === transactionId);
            if (!deletedTransaction) throw new Error("Transaction not found");

            await deleteTransaction(userId, transactionId);

            const userData = await loadUserData(userId);
            let totalBalance = userData.totalBalance || 0;
            const walletId = Object.keys(userData.wallets).find(key => userData.wallets[key].name === deletedTransaction.wallet);
            let walletBalance = walletId ? (userData.wallets[walletId]?.balance || 0) : 0;

            if (deletedTransaction.type === 'income') {
                totalBalance -= deletedTransaction.amount;
                if (walletId) walletBalance -= deletedTransaction.amount;
            } else {
                totalBalance += deletedTransaction.amount;
                if (walletId) walletBalance += deletedTransaction.amount;
            }

            await updateUserData(userId, { totalBalance });
            if (walletId) {
                await update(ref(db, `users/${userId}/wallets/${walletId}`), { balance: walletBalance });
            }
            
            const transactionsData = await loadTransactions(userId) || {};
            allTransactions = Object.entries(transactionsData).map(([id, tx]) => ({ id, ...tx }));

            const totalPages = Math.ceil(allTransactions.length / ITEMS_PER_PAGE);
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
}

// ============================================================================
// Edit Transaction Modal Logic
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
                    <div class="form-group"><label for="editType">Type:</label><select id="editType" required><option value="income">Income</option><option value="expense">Expense</option></select></div>
                    <div class="form-group"><label for="editAccount">Account:</label><select id="editAccount" required></select></div>
                    <div class="form-group"><label for="editDescription">Description:</label><input type="text" id="editDescription" required></div>
                    <div class="form-group"><label for="editWallet">Wallet:</label><select id="editWallet" required></select></div>
                    <div class="form-group"><label for="editAmount">Amount:</label><input type="number" id="editAmount" required></div>
                    <button type="submit" class="btn-primary">Save Changes</button>
                    <p id="editFormError" class="status-message" style="display: none;"></p>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.querySelector('.close-modal').addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('editTransactionModal')) closeEditModal();
    });
    document.getElementById('editTransactionForm').addEventListener('submit', handleEditFormSubmit);
    document.getElementById('editType').addEventListener('change', () => loadAccountsForEditForm(userAccounts));
}

function openEditModal(transactionId) {
    const transaction = allTransactions.find(tx => tx.id === transactionId);
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
    }, 100);
    
    document.getElementById('editTransactionModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editTransactionModal').style.display = 'none';
    editingTransactionId = null;
}

function loadAccountsForEditForm(accounts) {
    const typeSelect = document.getElementById('editType');
    const accountsSelect = document.getElementById('editAccount');
    if (!typeSelect || !accountsSelect) return;
    const selectedType = typeSelect.value;
    const accountList = accounts[selectedType] || [];
    accountsSelect.innerHTML = '<option value="">Select Account</option>';
    accountList.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        accountsSelect.appendChild(option);
    });
}

function loadWalletsForEditForm(wallets) {
    const walletsSelect = document.getElementById('editWallet');
    if (!walletsSelect) return;
    walletsSelect.innerHTML = '<option value="">Select Wallet</option>';
    Object.values(wallets).forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.name;
        option.text = wallet.name;
        walletsSelect.appendChild(option);
    });
}

async function handleEditFormSubmit(e) {
    e.preventDefault();
    if (!editingTransactionId) return showEditError('No transaction selected.');
    
    const oldTransaction = allTransactions.find(tx => tx.id === editingTransactionId);
    if (!oldTransaction) return showEditError('Transaction not found.');
    
    const updatedData = {
        date: document.getElementById('editDate').value,
        type: document.getElementById('editType').value,
        account: document.getElementById('editAccount').value,
        description: document.getElementById('editDescription').value,
        wallet: document.getElementById('editWallet').value,
        amount: parseFloat(document.getElementById('editAmount').value),
    };
    updatedData.timestamp = new Date(updatedData.date).getTime();
    
    if (Object.values(updatedData).some(val => !val) || isNaN(updatedData.amount) || updatedData.amount <= 0) {
        return showEditError('Please fill all fields with valid data.');
    }
    
    const hasChanges = 
        oldTransaction.date !== updatedData.date ||
        oldTransaction.type !== updatedData.type ||
        oldTransaction.account !== updatedData.account ||
        oldTransaction.description !== updatedData.description ||
        oldTransaction.wallet !== updatedData.wallet ||
        oldTransaction.amount !== updatedData.amount;
    
    if (!hasChanges) {
        closeEditModal();
        return showSuccessMessage('No changes were made.');
    }
    
    try {
        showLoading();
        
        const userData = await loadUserData(userId);
        let totalBalance = userData.totalBalance || 0;
        
        const oldImpact = oldTransaction.type === 'income' ? oldTransaction.amount : -oldTransaction.amount;
        const newImpact = updatedData.type === 'income' ? updatedData.amount : -updatedData.amount;
        
        const netBalanceChange = newImpact - oldImpact;
        totalBalance += netBalanceChange;
        
        const walletUpdates = {};
        
        const oldWalletId = Object.keys(userData.wallets).find(key => userData.wallets[key].name === oldTransaction.wallet);
        const newWalletId = Object.keys(userData.wallets).find(key => userData.wallets[key].name === updatedData.wallet);
        
        if (oldWalletId === newWalletId) {
            if (oldWalletId) {
                const currentBalance = userData.wallets[oldWalletId].balance || 0;
                walletUpdates[oldWalletId] = currentBalance + netBalanceChange;
            }
        } else {
            if (oldWalletId) {
                const oldWalletBalance = userData.wallets[oldWalletId].balance || 0;
                walletUpdates[oldWalletId] = oldWalletBalance - oldImpact;
            }
            
            if (newWalletId) {
                const newWalletBalance = userData.wallets[newWalletId].balance || 0;
                walletUpdates[newWalletId] = newWalletBalance + newImpact;
            }
        }
        
        await updateTransaction(userId, editingTransactionId, updatedData);
        await updateUserData(userId, { totalBalance });
        
        for (const [walletId, newBalance] of Object.entries(walletUpdates)) {
            await update(ref(db, `users/${userId}/wallets/${walletId}`), { balance: newBalance });
        }
        
        const transactionsData = await loadTransactions(userId) || {};
        allTransactions = Object.entries(transactionsData).map(([id, tx]) => ({ id, ...tx }));
        
        displayPage();
        closeEditModal();
        showSuccessMessage('Transaction updated successfully!');
    } catch (error) {
        console.error("Error updating transaction:", error);
        showEditError('Failed to update transaction: ' + error.message);
    } finally {
        hideLoading();
    }
}

function showEditError(message) {
    const errorElement = document.getElementById('editFormError');
    if(errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => { errorElement.style.display = 'none'; }, 3000);
    }
}
// ============================================================================
// UI Helper Functions
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
