// js/transactions.js

// Impor dari database.js
import { auth, db, loadUserData, loadTransactions as fetchTransactions, saveTransaction, updateTransaction, deleteTransaction } from './database.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { ref, get, set, update, remove, push, query, orderByChild, limitToFirst, startAt } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// ============================================================================
// Global Variables
// ============================================================================
let userId;
let currentTransactions = [];
let currentPage = 1;
let transactionsPerPage = 10;
let lastVisible = null;
let currentSort = 'date-desc';
let currentFilters = {};
let editingTransactionId = null;

// ============================================================================
// Main Initialization
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeTransactionsPage();
        setupEventListeners();
    } else {
        window.location.href = "index.html";
    }
});

async function initializeTransactionsPage() {
    try {
        // Load user data to get wallets
        const userData = await loadUserData(userId);
        
        // Populate wallet dropdowns
        populateWalletDropdowns(userData.wallets || {});
        
        // Populate category dropdowns
        populateCategoryDropdowns(userData.accounts || {});
        
        // Set default date for new transaction
        setDefaultDate();
        
        // Check URL for any pre-selected type
        checkUrlParams();
        
        // Load transactions
        await loadTransactions();
        
        // Setup theme toggle
        setupThemeToggle();
        
        // Update user info in UI
        updateUserInfo(userData);
        
    } catch (error) {
        console.error("Error initializing transactions page:", error);
        showToast("Error loading transactions. Please try again.", "error");
    }
}

// ============================================================================
// Event Listeners
// ============================================================================
function setupEventListeners() {
    // Add transaction button
    document.getElementById('addTransactionBtn').addEventListener('click', () => {
        openTransactionModal();
    });
    
    // Close modal buttons
    document.getElementById('closeModal').addEventListener('click', () => {
        closeTransactionModal();
    });
    
    document.getElementById('closeDeleteModal').addEventListener('click', () => {
        closeDeleteModal();
    });
    
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
        closeDeleteModal();
    });
    
    // Transaction form submission
    document.getElementById('transactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveTransactionHandler();
    });
    
    // Delete transaction button
    document.getElementById('deleteTransactionBtn').addEventListener('click', () => {
        openDeleteConfirmModal();
    });
    
    // Confirm delete button
    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        await deleteTransactionHandler();
    });
    
    // Filter form submission
    document.getElementById('filterForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        currentPage = 1;
        lastVisible = null;
        currentFilters = getFilterValues();
        await loadTransactions(true);
    });
    
    // Reset filters
    document.getElementById('filterForm').addEventListener('reset', async () => {
        setTimeout(async () => {
            currentPage = 1;
            lastVisible = null;
            currentFilters = {};
            await loadTransactions(true);
        }, 0);
    });
    
    // Toggle filter visibility
    document.getElementById('toggleFilterBtn').addEventListener('click', () => {
        const filterContent = document.getElementById('filterContent');
        filterContent.classList.toggle('collapsed');
        
        const icon = document.getElementById('toggleFilterBtn').querySelector('i');
        if (filterContent.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-down';
        } else {
            icon.className = 'fas fa-chevron-up';
        }
    });
    
    // Sort dropdown
    document.getElementById('sortDropdownBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('sortDropdown').classList.toggle('show');
    });
    
    // Close sort dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.matches('#sortDropdownBtn') && !e.target.closest('#sortDropdownBtn')) {
            const dropdown = document.getElementById('sortDropdown');
            if (dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
            }
        }
    });
    
    // Sort options
    document.querySelectorAll('#sortDropdown .dropdown-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            currentSort = e.target.closest('.dropdown-item').dataset.sort;
            currentPage = 1;
            lastVisible = null;
            await loadTransactions(true);
            document.getElementById('sortDropdown').classList.remove('show');
        });
    });
    
    // Transaction type radio buttons
    document.querySelectorAll('input[name="type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updateCategoryOptions();
        });
    });
    
    // User menu toggle
    const userMenuBtn = document.getElementById('userMenu');
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', function() {
            this.classList.toggle('active');
        });

        // Close user menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!userMenuBtn.contains(event.target)) {
                userMenuBtn.classList.remove('active');
            }
        });
    }

    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');
    const mobileNavClose = document.getElementById('mobileNavClose');

    if (mobileMenuToggle && mobileNav && mobileNavClose) {
        mobileMenuToggle.addEventListener('click', function() {
            mobileNav.classList.add('active');
        });

        mobileNavClose.addEventListener('click', function() {
            mobileNav.classList.remove('active');
        });
    }

    // Notifications toggle
    const notificationsBtn = document.getElementById('notificationsBtn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', function() {
            this.classList.toggle('active');
        });

        // Close notifications when clicking outside
        document.addEventListener('click', function(event) {
            if (!notificationsBtn.contains(event.target)) {
                notificationsBtn.classList.remove('active');
            }
        });
    }
    
    // Logout button
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

    // Mobile logout button
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', async () => {
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

// Setup theme toggle
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    // Set initial state based on current theme
    const currentTheme = document.documentElement.getAttribute('data-theme');
    themeToggle.checked = currentTheme === 'dark';
    
    // Add event listener
    themeToggle.addEventListener('change', function() {
        const newTheme = this.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// Update user info in UI
function updateUserInfo(userData) {
    // Get user name and email
    const userName = userData?.displayName || auth.currentUser?.displayName || 'User';
    const userEmail = userData?.email || auth.currentUser?.email || 'user@example.com';
    
    // Update user name in header
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(element => {
        element.textContent = userName;
    });
    
    // Update user email in header
    const userEmailElements = document.querySelectorAll('.user-email');
    userEmailElements.forEach(element => {
        element.textContent = userEmail;
    });
    
    // Update mobile nav user info
    const mobileUserNameElement = document.querySelector('.mobile-nav-user-name');
    if (mobileUserNameElement) {
        mobileUserNameElement.textContent = userName;
    }
    
    const mobileUserEmailElement = document.querySelector('.mobile-nav-user-email');
    if (mobileUserEmailElement) {
        mobileUserEmailElement.textContent = userEmail;
    }
    
    // Update user avatar if available
    const photoURL = userData?.photoURL || auth.currentUser?.photoURL;
    if (photoURL) {
        const avatarElements = document.querySelectorAll('.user-avatar img');
        avatarElements.forEach(element => {
            element.src = photoURL;
        });
    }
}

// ============================================================================
// Data Loading Functions
// ============================================================================
async function loadTransactions(refresh = false) {
    try {
        const transactionsContainer = document.getElementById('transactionsList');
        
        if (refresh) {
            transactionsContainer.innerHTML = '<p class="empty-state">Loading transactions...</p>';
        }
        
        // Gunakan fungsi loadTransactions dari database.js
        const transactions = await fetchTransactions(userId);
        
        // Konversi objek transaksi menjadi array
        const transactionsArray = transactions ? Object.keys(transactions).map(key => ({
            id: key,
            ...transactions[key]
        })) : [];
        
        // Filter dan sort transaksi
        const filteredTransactions = filterTransactions(transactionsArray);
        const sortedTransactions = sortTransactions(filteredTransactions);
        
        // Pagination
        const paginatedTransactions = paginateTransactions(sortedTransactions);
        
        // Update current transactions
        if (refresh) {
            currentTransactions = paginatedTransactions;
        } else {
            currentTransactions = [...currentTransactions, ...paginatedTransactions];
        }
        
        // Display transactions
        displayTransactions(currentTransactions);
        
        // Update summary
        updateTransactionsSummary(filteredTransactions);
        
        // Update pagination
        updatePagination(paginatedTransactions.length < transactionsPerPage);
        
    } catch (error) {
        console.error("Error loading transactions:", error);
        document.getElementById('transactionsList').innerHTML = 
            '<p class="empty-state">Error loading transactions. Please try refreshing the page.</p>';
    }
}

function filterTransactions(transactions) {
    if (Object.keys(currentFilters).length === 0) {
        return transactions;
    }
    
    return transactions.filter(transaction => {
        // Filter by type
        if (currentFilters.type && currentFilters.type !== 'all' && transaction.type !== currentFilters.type) {
            return false;
        }
        
        // Filter by account (category)
        if (currentFilters.account && currentFilters.account !== 'all' && transaction.account !== currentFilters.account) {
            return false;
        }
        
        // Filter by wallet
        if (currentFilters.wallet && currentFilters.wallet !== 'all' && transaction.wallet !== currentFilters.wallet) {
            return false;
        }
        
        // Filter by date range
        if (currentFilters.dateFrom) {
            const fromDate = new Date(currentFilters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (transaction.timestamp < fromDate.getTime()) {
                return false;
            }
        }
        
        if (currentFilters.dateTo) {
            const toDate = new Date(currentFilters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (transaction.timestamp > toDate.getTime()) {
                return false;
            }
        }
        
        // Filter by amount range
        if (currentFilters.amountMin && transaction.amount < parseFloat(currentFilters.amountMin)) {
            return false;
        }
        
        if (currentFilters.amountMax && transaction.amount > parseFloat(currentFilters.amountMax)) {
            return false;
        }
        
        return true;
    });
}

function sortTransactions(transactions) {
    const [sortField, sortDirection] = currentSort.split('-');
    
    return [...transactions].sort((a, b) => {
        const fieldA = sortField === 'date' ? a.timestamp : a.amount;
        const fieldB = sortField === 'date' ? b.timestamp : b.amount;
        
        if (sortDirection === 'asc') {
            return fieldA - fieldB;
        } else {
            return fieldB - fieldA;
        }
    });
}

function paginateTransactions(transactions) {
    const startIndex = (currentPage - 1) * transactionsPerPage;
    return transactions.slice(startIndex, startIndex + transactionsPerPage);
}

// ============================================================================
// UI Update Functions
// ============================================================================
function displayTransactions(transactions) {
    const transactionsContainer = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        transactionsContainer.innerHTML = '<p class="empty-state">No transactions found. Add a new transaction to get started.</p>';
        return;
    }
    
    let html = '';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    transactions.forEach(transaction => {
        const date = new Date(transaction.timestamp);
        const isIncome = transaction.type === 'income';
        
        html += `
            <div class="transaction-item" data-id="${transaction.id}">
                <div class="transaction-date">
                    <span class="day">${date.getDate()}</span>
                    <span class="month">${monthNames[date.getMonth()]}</span>
                </div>
                <div class="transaction-icon ${isIncome ? 'income' : 'expense'}">
                    <i class="fas ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                </div>
                <div class="transaction-details">
                    <h4 class="transaction-title">${transaction.description}</h4>
                    <p class="transaction-subtitle">${transaction.account} • ${transaction.wallet}</p>
                </div>
                <div class="transaction-amount ${isIncome ? 'income' : 'expense'}">
                    ${isIncome ? '+' : '-'} Rp${formatNumber(transaction.amount)}
                </div>
                <div class="transaction-actions">
                    <button class="transaction-action-btn edit" data-id="${transaction.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="transaction-action-btn delete" data-id="${transaction.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    transactionsContainer.innerHTML = html;
    
    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.transaction-action-btn.edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const transactionId = btn.dataset.id;
            editTransaction(transactionId);
        });
    });
    
    document.querySelectorAll('.transaction-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const transactionId = btn.dataset.id;
            deleteTransactionPrompt(transactionId);
        });
    });
}

function updateTransactionsSummary(transactions) {
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(transaction => {
        if (transaction.type === 'income') {
            totalIncome += parseFloat(transaction.amount);
        } else {
            totalExpense += parseFloat(transaction.amount);
        }
    });
    
    const netBalance = totalIncome - totalExpense;
    
    document.getElementById('totalIncome').textContent = `Rp${formatNumber(totalIncome)}`;
    document.getElementById('totalExpense').textContent = `Rp${formatNumber(totalExpense)}`;
    document.getElementById('netBalance').textContent = `Rp${formatNumber(netBalance)}`;
    
    // Add class based on net balance
    const netBalanceElement = document.getElementById('netBalance');
    if (netBalance > 0) {
        netBalanceElement.classList.add('positive');
        netBalanceElement.classList.remove('negative');
    } else if (netBalance < 0) {
        netBalanceElement.classList.add('negative');
        netBalanceElement.classList.remove('positive');
    } else {
        netBalanceElement.classList.remove('positive', 'negative');
    }
}

function updatePagination(isLastPage) {
    const paginationContainer = document.getElementById('pagination');
    
    // If there are no transactions, hide pagination
    if (currentTransactions.length === 0) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `
        <a href="#" class="pagination-item ${currentPage === 1 ? 'disabled' : ''}" id="prevPage">
            <i class="fas fa-chevron-left"></i>
        </a>
    `;
    
    // Current page indicator
    html += `<span class="pagination-item active">${currentPage}</span>`;
    
    // Next button
    html += `
        <a href="#" class="pagination-item ${isLastPage ? 'disabled' : ''}" id="nextPage">
            <i class="fas fa-chevron-right"></i>
        </a>
    `;
    
    paginationContainer.innerHTML = html;
    
    // Add event listeners
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn && currentPage > 1) {
        prevPageBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                lastVisible = null; // Reset last visible for proper pagination
                await loadTransactions(true);
            }
        });
    }
    
    if (nextPageBtn && !isLastPage) {
        nextPageBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            currentPage++;
            await loadTransactions(false); // Append mode
        });
    }
}

function populateWalletDropdowns(wallets) {
    const walletSelects = [
        document.getElementById('wallet'),
        document.getElementById('filterWallet')
    ];
    
    walletSelects.forEach(select => {
        if (!select) return;
        
        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Add wallet options
        for (const walletId in wallets) {
            const wallet = wallets[walletId];
            const option = document.createElement('option');
            option.value = wallet.name;
            option.textContent = wallet.name;
            select.appendChild(option);
        }
    });
}

function populateCategoryDropdowns(accounts) {
    if (!accounts) {
        accounts = {
            income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Other Income'],
            expense: ['Food', 'Transportation', 'Housing', 'Entertainment', 'Shopping', 'Utilities', 'Healthcare', 'Education', 'Other Expense']
        };
    }
    
    // Populate filter account dropdown
    const filterAccountSelect = document.getElementById('filterAccount');
    if (filterAccountSelect) {
        // Clear existing options except the first one
        while (filterAccountSelect.options.length > 1) {
            filterAccountSelect.remove(1);
        }
        
        // Add all categories
        const allCategories = [...accounts.income, ...accounts.expense];
        allCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filterAccountSelect.appendChild(option);
        });
    }
    
    // Update transaction form category dropdown based on selected type
    updateCategoryOptions(accounts);
}

function updateCategoryOptions(accounts) {
    if (!accounts) {
        accounts = {
            income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Other Income'],
            expense: ['Food', 'Transportation', 'Housing', 'Entertainment', 'Shopping', 'Utilities', 'Healthcare', 'Education', 'Other Expense']
        };
    }
    
    const transactionType = document.querySelector('input[name="type"]:checked').value;
    const accountSelect = document.getElementById('account');
    
    if (!accountSelect) return;
    
    // Clear existing options
    while (accountSelect.options.length > 0) {
        accountSelect.remove(0);
    }
    
    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = "";
    placeholderOption.textContent = "Select category";
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    accountSelect.appendChild(placeholderOption);
    
    // Add category options based on transaction type
    const categoryList = accounts[transactionType] || [];
    
    categoryList.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        accountSelect.appendChild(option);
    });
}

// ============================================================================
// Transaction Modal Functions
// ============================================================================
function openTransactionModal(transaction = null) {
    const modal = document.getElementById('transactionModal');
    const form = document.getElementById('transactionForm');
    const modalTitle = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('deleteTransactionBtn');
    
    // Reset form
    form.reset();
    
    if (transaction) {
        // Edit mode
        modalTitle.textContent = 'Edit Transaction';
        editingTransactionId = transaction.id;
        
        // Fill form with transaction data
        document.querySelector(`input[name="type"][value="${transaction.type}"]`).checked = true;
        document.getElementById('amount').value = transaction.amount;
        
        // Format date for input
        const date = new Date(transaction.timestamp);
        const formattedDate = date.toISOString().split('T')[0];
        document.getElementById('date').value = formattedDate;
        
        document.getElementById('description').value = transaction.description;
        
        // Update category options based on transaction type
        updateCategoryOptions();
        
        document.getElementById('account').value = transaction.account;
        document.getElementById('wallet').value = transaction.wallet;
        document.getElementById('notes').value = transaction.notes || '';
        
        // Show delete button
        deleteBtn.style.display = 'inline-flex';
    } else {
        // Add mode
        modalTitle.textContent = 'Add Transaction';
        editingTransactionId = null;
        
        // Set default date to today
        setDefaultDate();
        
        // Hide delete button
        deleteBtn.style.display = 'none';
    }
    
    // Show modal
    modal.classList.add('show');
    document.body.classList.add('modal-open');
}

function closeTransactionModal() {
    const modal = document.getElementById('transactionModal');
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
}

function openDeleteConfirmModal() {
    const modal = document.getElementById('deleteConfirmModal');
    modal.classList.add('show');
    document.body.classList.add('modal-open');
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteConfirmModal');
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
}

// ============================================================================
// Transaction CRUD Functions
// ============================================================================
async function saveTransactionHandler() {
    try {
        const form = document.getElementById('transactionForm');
        const type = document.querySelector('input[name="type"]:checked').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const dateStr = document.getElementById('date').value;
        const description = document.getElementById('description').value;
        const account = document.getElementById('account').value;
        const wallet = document.getElementById('wallet').value;
        const notes = document.getElementById('notes').value;
        
        // Convert date string to timestamp
        const date = new Date(dateStr);
        const timestamp = date.getTime();
        
        const transactionData = {
            type,
            amount,
            timestamp,
            description,
            account,
            wallet,
            notes,
            updatedAt: Date.now()
        };
        
        if (editingTransactionId) {
            // Update existing transaction
            transactionData.id = editingTransactionId;
            await updateTransaction(userId, editingTransactionId, transactionData);
            showToast("Transaction updated successfully!", "success");
        } else {
            // Add new transaction
            transactionData.createdAt = Date.now();
            await saveTransaction(userId, transactionData);
            showToast("Transaction added successfully!", "success");
        }
        
        // Close modal
        closeTransactionModal();
        
        // Reload transactions
        currentPage = 1;
        lastVisible = null;
        await loadTransactions(true);
        
        // Update wallet balance
        await updateWalletBalance(wallet, amount, type, editingTransactionId ? 'update' : 'add');
        
    } catch (error) {
        console.error("Error saving transaction:", error);
        showToast("Error saving transaction. Please try again.", "error");
    }
}

async function deleteTransactionHandler() {
    try {
        if (!editingTransactionId) return;
        
        // Get transaction data before deleting
        const transactions = await fetchTransactions(userId);
        const transaction = transactions[editingTransactionId];
        
        if (transaction) {
            // Delete transaction
            await deleteTransaction(userId, editingTransactionId);
            
            // Update wallet balance
            await updateWalletBalance(
                transaction.wallet, 
                transaction.amount, 
                transaction.type, 
                'delete'
            );
            
            showToast("Transaction deleted successfully!", "success");
            
            // Close modals
            closeDeleteModal();
            closeTransactionModal();
            
            // Reload transactions
            currentPage = 1;
            lastVisible = null;
            await loadTransactions(true);
        }
    } catch (error) {
        console.error("Error deleting transaction:", error);
        showToast("Error deleting transaction. Please try again.", "error");
    }
}

async function updateWalletBalance(walletName, amount, type, action) {
    try {
        // Get user data to find wallet
        const userData = await loadUserData(userId);
        const wallets = userData.wallets || {};
        
        // Find wallet by name
        let walletId = null;
        let wallet = null;
        
        for (const id in wallets) {
            if (wallets[id].name === walletName) {
                walletId = id;
                wallet = wallets[id];
                break;
            }
        }
        
        if (!wallet) return;
        
        // Calculate new balance
        let newBalance = wallet.balance || 0;
        
        if (action === 'add') {
            // Adding new transaction
            if (type === 'income') {
                newBalance += amount;
            } else {
                newBalance -= amount;
            }
        } else if (action === 'update') {
            // For simplicity, recalculate from all transactions
            const transactions = await fetchTransactions(userId);
            
            // Calculate balance from all transactions for this wallet
            newBalance = 0;
            Object.values(transactions).forEach(tx => {
                if (tx.wallet === walletName) {
                    if (tx.type === 'income') {
                        newBalance += parseFloat(tx.amount);
                    } else {
                        newBalance -= parseFloat(tx.amount);
                    }
                }
            });
        } else if (action === 'delete') {
            // Deleting transaction
            if (type === 'income') {
                newBalance -= amount;
            } else {
                newBalance += amount;
            }
        }
        
        // Update wallet balance
        await update(ref(db, `users/${userId}/wallets/${walletId}`), { balance: newBalance });
        
        // Calculate total balance
        let totalBalance = 0;
        for (const id in wallets) {
            if (id === walletId) {
                totalBalance += newBalance;
            } else {
                totalBalance += wallets[id].balance || 0;
            }
        }
        
        // Update total balance
        await update(ref(db, `users/${userId}`), { totalBalance });
        
    } catch (error) {
        console.error("Error updating wallet balance:", error);
        throw error;
    }
}

// ============================================================================
// Helper Functions
// ============================================================================
function editTransaction(transactionId) {
    // Find transaction in current transactions
    const transaction = currentTransactions.find(t => t.id === transactionId);
    
    if (transaction) {
        openTransactionModal(transaction);
    }
}

function deleteTransactionPrompt(transactionId) {
    editingTransactionId = transactionId;
    openDeleteConfirmModal();
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

function getFilterValues() {
    return {
        type: document.getElementById('filterType').value,
        account: document.getElementById('filterAccount').value,
        wallet: document.getElementById('filterWallet').value,
        dateFrom: document.getElementById('filterDateFrom').value,
        dateTo: document.getElementById('filterDateTo').value,
        amountMin: document.getElementById('filterAmountMin').value,
        amountMax: document.getElementById('filterAmountMax').value
    };
}

function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    
    if (type === 'income' || type === 'expense') {
        document.querySelector(`input[name="type"][value="${type}"]`).checked = true;
        updateCategoryOptions();
        openTransactionModal();
    }
}
function formatNumber(number) {
    return new Intl.NumberFormat('id-ID').format(number);
}

// Show toast notification
function showToast(message, type = 'info') {
    // Check if toast container exists, if not create it
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Add icon based on type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icon}"></i>
        </div>
        <div class="toast-content">${message}</div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Add close functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('toast-visible');
    }, 10);
}

// Add toast styles dynamically if not already in the document
function addToastStyles() {
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 300px;
            }
            
            .toast {
                background-color: var(--bg-secondary);
                color: var(--text-primary);
                border-left: 4px solid var(--accent-color);
                border-radius: var(--border-radius-md);
                padding: 12px;
                display: flex;
                align-items: center;
                box-shadow: var(--card-shadow);
                transform: translateX(100%);
                opacity: 0;
                transition: transform 0.3s ease, opacity 0.3s ease;
            }
            
            .toast-visible {
                transform: translateX(0);
                opacity: 1;
            }
            
            .toast-hiding {
                transform: translateX(100%);
                opacity: 0;
            }
            
            .toast-icon {
                margin-right: 12px;
                font-size: 1.2rem;
                color: var(--accent-color);
            }
            
            .toast-content {
                flex-grow: 1;
                font-size: 0.9rem;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: var(--text-tertiary);
                cursor: pointer;
                padding: 0;
                font-size: 0.9rem;
                margin-left: 12px;
            }
            
            .toast-close:hover {
                color: var(--text-primary);
            }
            
            .toast-success {
                border-left-color: var(--success-color);
            }
            
            .toast-success .toast-icon {
                color: var(--success-color);
            }
            
            .toast-error {
                border-left-color: var(--danger-color);
            }
            
            .toast-error .toast-icon {
                color: var(--danger-color);
            }
            
            .toast-warning {
                border-left-color: var(--warning-color);
            }
            
            .toast-warning .toast-icon {
                color: var(--warning-color);
            }
            
            @media (max-width: 576px) {
                .toast-container {
                    left: 20px;
                    right: 20px;
                    max-width: none;
                }
                
                .toast {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Call this when the script loads
addToastStyles();

// Make edit and delete functions available globally
window.editTransaction = editTransaction;
window.deleteTransactionPrompt = deleteTransactionPrompt;
