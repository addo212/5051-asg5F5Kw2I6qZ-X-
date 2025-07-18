// js/transactions.js

// ============================================================================
// MODULE IMPORTS
// ============================================================================
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    get, 
    update, 
    push, 
    remove 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { formatRupiah } from './utils.js';

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// ============================================================================
// GLOBAL STATE
// ============================================================================
let userId;
let allTransactions = [];
let wallets = {};
let allAccounts = {};
let currentPage = 1;
const rowsPerPage = 10;
let sortColumn = 'date';
let sortDirection = 'desc';

// ============================================================================
// AUTHENTICATION & INITIALIZATION
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeTransactionsPage();
    } else {
        window.location.href = "index.html";
    }
});

async function initializeTransactionsPage() {
    setupEventListeners();
    try {
        const userData = await loadInitialData();
        wallets = userData.wallets || {};
        
        const incomeAccounts = (userData.accounts && userData.accounts.income) || [];
        const expenseAccounts = (userData.accounts && userData.accounts.expense) || [];
        
        allAccounts = {};
        incomeAccounts.filter(acc => acc).forEach(acc => allAccounts[acc] = 'income');
        expenseAccounts.filter(acc => acc).forEach(acc => allAccounts[acc] = 'expense');

        populateDropdowns();
        
        const transactionsData = (await get(ref(database, `users/${userId}/transactions`))).val() || {};
        processAndDisplayTransactions(transactionsData);

        const urlParams = new URLSearchParams(window.location.search);
        const type = urlParams.get('type');
        if (type === 'income' || type === 'expense') {
            document.getElementById('addTransactionSection').open = true;
            document.getElementById('transactionType').value = type;
            updateAccountDropdown('transactionAccount', type);
        }

    } catch (error) {
        console.error("Error initializing page:", error);
        document.getElementById('transactionTableBody').innerHTML = `<tr><td colspan="6" class="empty-state">Error loading data. Please refresh.</td></tr>`;
    }
}

async function loadInitialData() {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    return snapshot.val() || {};
}

function processAndDisplayTransactions(transactionsData) {
    allTransactions = Object.values(transactionsData);
    displayTransactions();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
    document.getElementById('addTransactionForm').addEventListener('submit', handleAddTransaction);
    document.getElementById('editTransactionModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('close-modal')) {
            document.getElementById('editTransactionModal').classList.remove('show');
        }
    });
    document.getElementById('editTransactionForm').addEventListener('submit', handleUpdateTransaction);
    document.getElementById('transactionTableBody').addEventListener('click', handleTableActions);
    document.querySelectorAll('.sortable').forEach(header => header.addEventListener('click', handleSort));
    
    // PERBAIKAN: Listener untuk tombol filter yang baru
    document.getElementById('applyFilterBtn').addEventListener('click', () => {
        currentPage = 1; // Selalu kembali ke halaman pertama saat filter baru diterapkan
        displayTransactions();
    });
    document.getElementById('resetFilterBtn').addEventListener('click', () => {
        document.querySelector('.filter-bar').querySelectorAll('input, select').forEach(el => el.value = '');
        currentPage = 1;
        displayTransactions();
    });

    // Pencarian tetap bekerja secara live
    document.getElementById('searchInput').addEventListener('input', () => {
        currentPage = 1;
        displayTransactions();
    });
    
    document.getElementById('paginationContainer').addEventListener('click', handlePagination);

    document.getElementById('transactionType').addEventListener('change', (e) => {
        updateAccountDropdown('transactionAccount', e.target.value);
    });
    document.getElementById('editTransactionType').addEventListener('change', (e) => {
        updateAccountDropdown('editTransactionAccount', e.target.value);
    });
}

// ============================================================================
// CRUD HANDLERS
// ============================================================================
async function handleAddTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Adding...';

    try {
        const date = form.transactionDate.value;
        const timestamp = new Date(date).getTime();
        const newTransaction = {
            type: form.transactionType.value,
            amount: parseFloat(form.transactionAmount.value),
            description: form.transactionDescription.value,
            account: form.transactionAccount.value,
            walletId: form.transactionWallet.value,
            wallet: wallets[form.transactionWallet.value].name,
            timestamp: timestamp,
            date: date
        };

        const txRef = push(ref(database, `users/${userId}/transactions`));
        newTransaction.id = txRef.key;

        const updates = await createTransactionUpdates(newTransaction);
        await update(ref(database), updates);

        alert('Transaction added successfully!');
        form.reset();
        document.getElementById('addTransactionSection').open = false;
        
        const transactionsData = (await get(ref(database, `users/${userId}/transactions`))).val() || {};
        processAndDisplayTransactions(transactionsData);
        const userData = await loadInitialData();
        wallets = userData.wallets || {};
        populateDropdowns();

    } catch (error) {
        console.error("Error adding transaction:", error);
        alert(`Failed to add transaction: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Add Transaction';
    }
}

async function handleUpdateTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const txId = form.editTransactionId.value;
        const date = form.editTransactionDate.value;
        const timestamp = new Date(date).getTime();

        const updatedData = {
            id: txId,
            type: form.editTransactionType.value,
            amount: parseFloat(form.editTransactionAmount.value),
            description: form.editTransactionDescription.value,
            account: form.editTransactionAccount.value,
            walletId: form.editTransactionWallet.value,
            wallet: wallets[form.editTransactionWallet.value].name,
            timestamp: timestamp,
            date: date
        };

        const oldTxSnapshot = await get(ref(database, `users/${userId}/transactions/${txId}`));
        const oldTx = oldTxSnapshot.val();

        const updates = await createTransactionUpdates(updatedData, oldTx);
        await update(ref(database), updates);

        alert('Transaction updated successfully!');
        document.getElementById('editTransactionModal').classList.remove('show');
        
        const transactionsData = (await get(ref(database, `users/${userId}/transactions`))).val() || {};
        processAndDisplayTransactions(transactionsData);
        const userData = await loadInitialData();
        wallets = userData.wallets || {};
        populateDropdowns();

    } catch (error) {
        console.error("Error updating transaction:", error);
        alert(`Failed to update transaction: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
}

async function handleDeleteTransaction(txId) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
        const txSnapshot = await get(ref(database, `users/${userId}/transactions/${txId}`));
        const txToDelete = txSnapshot.val();
        if (!txToDelete) throw new Error("Transaction not found.");

        const updates = await createTransactionUpdates(null, txToDelete);
        updates[`users/${userId}/transactions/${txId}`] = null;
        await update(ref(database), updates);

        alert('Transaction deleted successfully!');
        
        const transactionsData = (await get(ref(database, `users/${userId}/transactions`))).val() || {};
        processAndDisplayTransactions(transactionsData);
        const userData = await loadInitialData();
        wallets = userData.wallets || {};
        populateDropdowns();

    } catch (error) {
        console.error("Error deleting transaction:", error);
        alert(`Failed to delete transaction: ${error.message}`);
    }
}

// ============================================================================
// UI RENDERING & MANIPULATION
// ============================================================================
function displayTransactions() {
    const tableBody = document.getElementById('transactionTableBody');
    
    let filteredTransactions = [...allTransactions];
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterType = document.getElementById('filterType').value;
    const filterAccount = document.getElementById('filterAccount').value;
    const filterWallet = document.getElementById('filterWallet').value;
    const filterStartDate = document.getElementById('filterStartDate').value;
    const filterEndDate = document.getElementById('filterEndDate').value;

    if (searchTerm) {
        filteredTransactions = filteredTransactions.filter(tx => 
            tx.description.toLowerCase().includes(searchTerm) ||
            tx.account.toLowerCase().includes(searchTerm) ||
            tx.wallet.toLowerCase().includes(searchTerm)
        );
    }
    if (filterType) filteredTransactions = filteredTransactions.filter(tx => tx.type === filterType);
    if (filterAccount) filteredTransactions = filteredTransactions.filter(tx => tx.account === filterAccount);
    if (filterWallet) filteredTransactions = filteredTransactions.filter(tx => tx.walletId === filterWallet);
    if (filterStartDate) {
        const startDate = new Date(filterStartDate).getTime();
        filteredTransactions = filteredTransactions.filter(tx => tx.timestamp >= startDate);
    }
    if (filterEndDate) {
        const endDate = new Date(filterEndDate).getTime() + (24 * 60 * 60 * 1000 - 1);
        filteredTransactions = filteredTransactions.filter(tx => tx.timestamp <= endDate);
    }

    filteredTransactions.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        if (sortColumn === 'date') {
            valA = a.timestamp;
            valB = b.timestamp;
        }
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    updateSortIcons();

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

    if (paginatedTransactions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No transactions found.</td></tr>`;
    } else {
        tableBody.innerHTML = paginatedTransactions.map(tx => `
            <tr>
                <td>${tx.date}</td>
                <td>${tx.description}</td>
                <td>${tx.account}</td>
                <td>${tx.wallet}</td>
                <td class="${tx.type === 'income' ? 'amount-income' : 'amount-expense'}">
                    ${tx.type === 'income' ? '+' : '-'} ${formatRupiah(tx.amount)}
                </td>
                <td class="transaction-actions">
                    <button class="edit-btn" data-id="${tx.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" data-id="${tx.id}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    renderPagination(filteredTransactions.length);
}

function renderPagination(totalRows) {
    const paginationContainer = document.getElementById('paginationContainer');
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.dataset.page = i;
        if (i === currentPage) {
            button.classList.add('active');
        }
        paginationContainer.appendChild(button);
    }
}

async function openEditModal(txId) {
    const modal = document.getElementById('editTransactionModal');
    const form = document.getElementById('editTransactionForm');
    const tx = allTransactions.find(t => t.id === txId);

    if (!tx) {
        alert('Transaction not found!');
        return;
    }

    form.editTransactionId.value = tx.id;
    form.editTransactionType.value = tx.type;
    form.editTransactionDate.value = tx.date;
    form.editTransactionAmount.value = tx.amount;
    form.editTransactionDescription.value = tx.description;
    
    const walletSelect = form.editTransactionWallet;
    walletSelect.innerHTML = '';
    Object.entries(wallets).forEach(([id, wallet]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = wallet.name;
        walletSelect.appendChild(option);
    });
    walletSelect.value = tx.walletId;

    updateAccountDropdown('editTransactionAccount', tx.type);
    form.editTransactionAccount.value = tx.account;

    modal.classList.add('show');
}

// ============================================================================
// EVENT HANDLER HELPERS
// ============================================================================
function handleTableActions(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const txId = target.dataset.id;
    if (target.classList.contains('edit-btn')) {
        openEditModal(txId);
    } else if (target.classList.contains('delete-btn')) {
        handleDeleteTransaction(txId);
    }
}

function handleSort(e) {
    const newSortColumn = e.currentTarget.dataset.sort;
    if (sortColumn === newSortColumn) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = newSortColumn;
        sortDirection = 'desc';
    }
    currentPage = 1;
    displayTransactions();
}

function handlePagination(e) {
    if (e.target.tagName === 'BUTTON') {
        currentPage = parseInt(e.target.dataset.page);
        displayTransactions();
    }
}

// ============================================================================
// HELPER & UTILITY FUNCTIONS
// ============================================================================
function populateDropdowns() {
    const walletSelects = document.querySelectorAll('#transactionWallet, #editTransactionWallet, #filterWallet');
    walletSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = select.id === 'filterWallet' ? '<option value="">All</option>' : '<option value="" disabled selected>Select a wallet</option>';
        Object.entries(wallets).forEach(([id, wallet]) => {
            select.innerHTML += `<option value="${id}">${wallet.name}</option>`;
        });
        select.value = currentValue;
    });

    const filterAccountSelect = document.getElementById('filterAccount');
    filterAccountSelect.innerHTML = '<option value="">All</option>';
    Object.keys(allAccounts).sort().forEach(acc => {
        filterAccountSelect.innerHTML += `<option value="${acc}">${acc}</option>`;
    });

    updateAccountDropdown('transactionAccount', document.getElementById('transactionType').value);
}

function updateAccountDropdown(selectId, transactionType) {
    const accountSelect = document.getElementById(selectId);
    const currentValue = accountSelect.value;
    accountSelect.innerHTML = '<option value="" disabled selected>Select an account</option>';
    
    Object.entries(allAccounts).forEach(([account, type]) => {
        if (type === transactionType) {
            accountSelect.innerHTML += `<option value="${account}">${account}</option>`;
        }
    });
    
    if (accountSelect.querySelector(`option[value="${currentValue}"]`)) {
        accountSelect.value = currentValue;
    }
}

function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.classList.remove('fa-sort-up', 'fa-sort-down');
        icon.classList.add('fa-sort');
    });
    const activeIcon = document.querySelector(`th[data-sort="${sortColumn}"] .sort-icon`);
    if (activeIcon) {
        activeIcon.classList.remove('fa-sort');
        activeIcon.classList.add(sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
    }
}

async function createTransactionUpdates(newTx, oldTx = null) {
    const updates = {};
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    const userData = snapshot.val();
    let totalBalance = userData.totalBalance || 0;
    const walletsCopy = { ...userData.wallets };
    const budgetsCopy = { ...userData.budgets };

    if (oldTx) {
        if (oldTx.type === 'income') {
            totalBalance -= oldTx.amount;
            if (walletsCopy[oldTx.walletId]) walletsCopy[oldTx.walletId].balance -= oldTx.amount;
        } else {
            totalBalance += oldTx.amount;
            if (walletsCopy[oldTx.walletId]) walletsCopy[oldTx.walletId].balance += oldTx.amount;
            const period = new Date(oldTx.timestamp).toISOString().slice(0, 7);
            if (budgetsCopy[period] && budgetsCopy[period][oldTx.account]) {
                budgetsCopy[period][oldTx.account].spent -= oldTx.amount;
            }
        }
    }

    if (newTx) {
        if (newTx.type === 'income') {
            totalBalance += newTx.amount;
            if (walletsCopy[newTx.walletId]) walletsCopy[newTx.walletId].balance += newTx.amount;
        } else {
            totalBalance -= newTx.amount;
            if (walletsCopy[newTx.walletId]) walletsCopy[newTx.walletId].balance -= newTx.amount;
            const period = new Date(newTx.timestamp).toISOString().slice(0, 7);
            if (budgetsCopy[period] && budgetsCopy[period][newTx.account]) {
                budgetsCopy[period][newTx.account].spent = (budgetsCopy[period][newTx.account].spent || 0) + newTx.amount;
            }
        }
        updates[`users/${userId}/transactions/${newTx.id}`] = newTx;
    }

    updates[`users/${userId}/totalBalance`] = totalBalance;
    updates[`users/${userId}/wallets`] = walletsCopy;
    updates[`users/${userId}/budgets`] = budgetsCopy;

    return updates;
}
