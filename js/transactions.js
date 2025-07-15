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
let allTransactions = []; // Sekarang menjadi array
let userAccounts = {};
let userWallets = {};
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let editingTransactionId = null;

// Variabel untuk sorting
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
            // Konversi objek transaksi menjadi array dengan ID sebagai properti
            allTransactions = Object.entries(transactionsData).map(([id, tx]) => ({
                id,
                ...tx
            }));
            
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
// Event Listeners
// ============================================================================
function setupEventListeners() {
    document.getElementById('applyFilters')?.addEventListener('click', displayPage);
    document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
    document.getElementById('transactionSearch')?.addEventListener('input', displayPage);

    // Setup sorter untuk setiap kolom tabel
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.column;
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'desc'; // Default ke desc untuk kolom baru
            }
            displayPage();
        });
    });

    // Event listener untuk form transaksi
    document.getElementById('transactionForm')?.addEventListener('submit', handleTransactionFormSubmit);
    
    // Event listener untuk perubahan tipe transaksi
    document.getElementById('type')?.addEventListener('change', () => {
        loadAccountsForForm(userAccounts);
    });
}

// ============================================================================
// Filtering and Sorting
// ============================================================================
function getFilteredAndSortedTransactions() {
    // 1. Filtering
    const filterStartDate = document.getElementById('filterStartDate').value;
    const filterEndDate = document.getElementById('filterEndDate').value;
    const filterWallet = document.getElementById('filterWallet').value;
    const filterAccount = document.getElementById('filterAccount').value;
    const searchTerm = document.getElementById('transactionSearch').value.toLowerCase();

    const startDate = filterStartDate ? new Date(filterStartDate).getTime() : null;
    const endDate = filterEndDate ? new Date(filterEndDate).setHours(23, 59, 59, 999) : null;

    let filtered = allTransactions.filter(tx => {
        const matchesDate = (!startDate || tx.timestamp >= startDate) && (!endDate || tx.timestamp <= endDate);
        const matchesWallet = !filterWallet || tx.wallet === filterWallet;
        const matchesAccount = !filterAccount || tx.account === filterAccount;
        const matchesSearch = !searchTerm || 
            (tx.description && tx.description.toLowerCase().includes(searchTerm)) ||
            (tx.account && tx.account.toLowerCase().includes(searchTerm)) ||
            (tx.wallet && tx.wallet.toLowerCase().includes(searchTerm));
        
        return matchesDate && matchesWallet && matchesAccount && matchesSearch;
    });

    // 2. Sorting
    filtered.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        // Konversi ke huruf kecil jika string untuk sorting yang case-insensitive
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        let comparison = 0;
        if (valA > valB) {
            comparison = 1;
        } else if (valA < valB) {
            comparison = -1;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
}

function resetFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterWallet').value = '';
    document.getElementById('filterAccount').value = '';
    document.getElementById('transactionSearch').value = '';
    displayPage();
}

// ============================================================================
// Core Display Logic
// ============================================================================
function displayPage() {
    const processedTransactions = getFilteredAndSortedTransactions();
    const { paginatedItems, totalPages } = paginate(processedTransactions, currentPage, ITEMS_PER_PAGE);
    
    displayTransactionsInTable(paginatedItems);
    renderPaginationControls('pagination-container', currentPage, totalPages, handlePageChange);
    updateSortIcons();
}

function handlePageChange(newPage) {
    currentPage = newPage;
    displayPage();
}

// ============================================================================
// UI Rendering (REWRITTEN FOR TABLE)
// ============================================================================
function displayTransactionsInTable(transactionsOnPage) {
    const tableBody = document.getElementById('transactionHistoryBody');
    if (!tableBody) return;

    if (!transactionsOnPage || transactionsOnPage.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="empty-state">No transactions found.</td></tr>';
        return;
    }

    let html = '';
    transactionsOnPage.forEach(tx => {
        const date = new Date(tx.timestamp);
        const formattedDate = date.toLocaleDateString('en-CA'); // YYYY-MM-DD format

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

    // Re-attach event listeners for edit/delete buttons
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
        icon.className = 'fas sort-icon'; // Reset
        if (column === sortColumn) {
            if (sortDirection === 'asc') {
                icon.classList.add('fa-sort-up');
            } else {
                icon.classList.add('fa-sort-down');
            }
        } else {
            icon.classList.add('fa-sort');
        }
    });
}

// ============================================================================
// Form Functions
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

// ============================================================================
// Transaction Form Submission
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
        
        // Reload transactions data
        const transactionsData = await loadTransactions(userId) || {};
        allTransactions = Object.entries(transactionsData).map(([id, tx]) => ({
            id,
            ...tx
        }));
        
        currentPage = 1; // Selalu kembali ke halaman pertama setelah menambah data baru
        displayPage();
        showSuccessMessage('Transaction saved successfully!');
    } catch (error) {
        console.error("Error saving transaction:", error);
        showError('Failed to save transaction. Please try again.');
    } finally {
        hideLoading();
    }
}

// ============================================================================
// Delete Transaction
// ============================================================================
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
            
            // Reload transactions data
            const transactionsData = await loadTransactions(userId) || {};
            allTransactions = Object.entries(transactionsData).map(([id, tx]) => ({
                id,
                ...tx
            }));

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
// Edit Transaction Modal
// ============================================================================
function initEditModal() {
    if (!document.getElementById('editTransactionModal')) {
        const modalHTML = `
            <div id="editTransactionModal" class="modal">
                <div class="modal-content">
                    <span class="close-modal">×</span>
                    <h2><i class="fas fa-edit"></i> Edit Transaction</h2>
                    <form id="editTransactionForm">
                        <div class="form-group">
                            <label for="editDate">Date:</label>
                            <input type="date" id="editDate" name="editDate" required>
                        </div>
                        <div class="form-group">
                            <label for="editType">Type:</label>
                            <select id="editType" name="editType" required>
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editAccount">Account:</label>
                            <select id="editAccount" name="editAccount" required>
                                <!-- Accounts will be loaded here -->
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editDescription">Description:</label>
                            <input type="text" id="editDescription" name="editDescription" placeholder="Enter description" required>
                        </div>
                        <div class="form-group">
                            <label for="editWallet">Wallet:</label>
                            <select id="editWallet" name="editWallet" required>
                                <!-- Wallets will be loaded here -->
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editAmount">Amount:</label>
                            <input type="number" id="editAmount" name="editAmount" placeholder="Enter amount" step="0.01" min="0.01" required>
                        </div>
                        <button type="submit" class="btn-primary">Save Changes</button>
                        <p id="editFormError" class="status-message" style="display: none;"></p>
                    </form>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);
        
        document.querySelector('.close-modal').addEventListener('click', closeEditModal);
        
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('editTransactionModal');
            if (event.target === modal) {
                closeEditModal();
            }
        });
        
        document.getElementById('editTransactionForm').addEventListener('submit', handleEditFormSubmit);
        
        document.getElementById('editType').addEventListener('change', () => {
            loadAccountsForEditForm(userAccounts);
        });
    }
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
    Object.keys(wallets).forEach(walletId => {
        const wallet = wallets[walletId];
        const option = document.createElement('option');
        option.value = wallet.name;
        option.text = wallet.name;
        walletsSelect.appendChild(option);
    });
}

async function handleEditFormSubmit(e) {
    e.preventDefault();
    
    if (!editingTransactionId) {
        showEditError('No transaction selected for editing.');
        return;
    }
    
    const oldTransaction = allTransactions.find(tx => tx.id === editingTransactionId);
    if (!oldTransaction) {
        showEditError('Transaction not found.');
        return;
    }
    
    const date = document.getElementById('editDate').value;
    const type = document.getElementById('editType').value;
    const account = document.getElementById('editAccount').value;
    const description = document.getElementById('editDescription').value;
    const wallet = document.getElementById('editWallet').value;
    let amount = parseFloat(document.getElementById('editAmount').value);
    
    if (!date || !type || !account || !description || !wallet || isNaN(amount) || amount <= 0) {
        showEditError('Please fill all fields with valid data.');
        return;
    }
    
    const updatedTransaction = {
        date,
        type,
        account,
        description,
        wallet,
        amount,
        timestamp: new Date(date).getTime(),
        id: editingTransactionId
    };
    
    try {
        showLoading();
        
        // Hitung perubahan saldo
        const userData = await loadUserData(userId);
        let totalBalance = userData.totalBalance || 0;
        
        // 1. Batalkan efek transaksi lama
        if (oldTransaction.type === 'income') {
            totalBalance -= oldTransaction.amount;
        } else {
            totalBalance += oldTransaction.amount;
        }
        
        // Cari wallet lama dan batalkan efeknya
        const oldWalletId = Object.keys(userData.wallets).find(key => 
            userData.wallets[key].name === oldTransaction.wallet
        );
        
        if (oldWalletId) {
            let oldWalletBalance = userData.wallets[oldWalletId].balance || 0;
            if (oldTransaction.type === 'income') {
                oldWalletBalance -= oldTransaction.amount;
            } else {
                oldWalletBalance += oldTransaction.amount;
            }
            await update(ref(db, `users/${userId}/wallets/${oldWalletId}`), { balance: oldWalletBalance });
        }
        
        // 2. Terapkan efek transaksi baru
        if (updatedTransaction.type === 'income') {
            totalBalance += updatedTransaction.amount;
        } else {
            totalBalance -= updatedTransaction.amount;
        }
        
        // Cari wallet baru dan terapkan efeknya
        const newWalletId = Object.keys(userData.wallets).find(key => 
            userData.wallets[key].name === updatedTransaction.wallet
        );
        
        if (newWalletId) {
            let newWalletBalance = userData.wallets[newWalletId].balance || 0;
            if (updatedTransaction.type === 'income') {
                newWalletBalance += updatedTransaction.amount;
            } else {
                newWalletBalance -= updatedTransaction.amount;
            }
            await update(ref(db, `users/${userId}/wallets/${newWalletId}`), { balance: newWalletBalance });
        }
        
        // Update total balance
        await updateUserData(userId, { totalBalance });
        
        // Update transaksi
        await updateTransaction(userId, editingTransactionId, updatedTransaction);
        
        // Reload data
        const transactionsData = await loadTransactions(userId) || {};
        allTransactions = Object.entries(transactionsData).map(([id, tx]) => ({
            id,
            ...tx
        }));
        
        displayPage();
        closeEditModal();
        showSuccessMessage('Transaction updated successfully!');
        
    } catch (error) {
        console.error("Error updating transaction:", error);
        showEditError('Failed to update transaction. Please try again.');
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
    } else {
        alert(message);
    }
}

function showError(message) {
    const errorElement = document.getElementById('formError');
    if(errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => { errorElement.style.display = 'none'; }, 3000);
    } else {
        alert(message);
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
