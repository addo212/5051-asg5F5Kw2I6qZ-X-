// wallets.js

// ============================================================================
// Module Imports
// ============================================================================
import { auth, db, loadUserData, loadTransactions, saveTransaction, deleteTransaction } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { formatRupiah } from './utils.js';
import { paginate, renderPaginationControls } from './pagination.js';

// ============================================================================
// Global Variables
// ============================================================================
let userId;
let userWallets = {};
let allTransfers = []; // Array untuk menyimpan riwayat transfer
let currentTransferPage = 1;
const TRANSFERS_PER_PAGE = 5; // Tampilkan 5 riwayat transfer per halaman

// ============================================================================
// Initialization
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeWalletPage(); 
    } else {
        window.location.href = "index.html";
    }
});

async function initializeWalletPage() {
    try {
        const userData = await loadUserData(userId);
        if (!userData) throw new Error("Could not load user data.");

        userWallets = userData.wallets || {};
        displayWallets();
        loadTransferFormOptions(); 

        // Memuat riwayat transfer
        const allTransactions = await loadTransactions(userId) || {};
        allTransfers = Object.values(allTransactions)
            .filter(tx => tx.type === 'transfer')
            .sort((a, b) => b.timestamp - a.timestamp);
        
        displayTransferHistoryPage();

    } catch (error) {
        console.error("Error initializing wallet page:", error);
        document.getElementById('walletsList').innerHTML = `<p class="empty-state error-message">${error.message}</p>`;
    }
}

// ============================================================================
// Wallet Display and Form Logic
// ============================================================================
function displayWallets() {
    const walletsListElement = document.getElementById('walletsList');
    if (!walletsListElement) return;
    const walletIds = Object.keys(userWallets);
    if (walletIds.length === 0) {
        walletsListElement.innerHTML = '<p class="empty-state">No wallets found. Add one in Settings.</p>';
        return;
    }
    let html = '<ul class="wallet-list-container">'; 
    walletIds.forEach(walletId => {
        const wallet = userWallets[walletId];
        const bgColor = wallet.color || '#6c5ce7'; 
        const iconClass = wallet.icon || 'fa-wallet'; 
        html += `
            <li class="wallet-item" style="background-color: ${bgColor};">
                <div class="wallet-info">
                    <i class="fas ${iconClass} wallet-icon"></i>
                    <h3>${wallet.name}</h3>
                </div>
                <p class="wallet-balance">${formatRupiah(wallet.balance)}</p>
            </li>`;
    });
    html += '</ul>';
    walletsListElement.innerHTML = html;
}

function loadTransferFormOptions() {
    const fromWalletSelect = document.getElementById('fromWallet');
    const toWalletSelect = document.getElementById('toWallet');
    fromWalletSelect.innerHTML = '<option value="">Select From Wallet</option>';
    toWalletSelect.innerHTML = '<option value="">Select To Wallet</option>';
    for (const walletId in userWallets) {
        const wallet = userWallets[walletId];
        const fromOption = document.createElement('option');
        fromOption.value = walletId;
        fromOption.text = `${wallet.name} (${formatRupiah(wallet.balance)})`;
        fromWalletSelect.appendChild(fromOption);
        const toOption = document.createElement('option');
        toOption.value = walletId;
        toOption.text = wallet.name;
        toWalletSelect.appendChild(toOption);
    }
}

// ============================================================================
// Transfer History Logic (NEW)
// ============================================================================
function displayTransferHistoryPage() {
    const { paginatedItems, totalPages } = paginate(allTransfers, currentTransferPage, TRANSFERS_PER_PAGE);
    renderTransferHistoryList(paginatedItems);
    renderPaginationControls('transferPagination', currentTransferPage, totalPages, handleTransferPageChange);
}

function handleTransferPageChange(newPage) {
    currentTransferPage = newPage;
    displayTransferHistoryPage();
}

function renderTransferHistoryList(transfersOnPage) {
    const container = document.getElementById('transferHistory');
    if (!container) return;
    if (transfersOnPage.length === 0) {
        container.innerHTML = '<p class="empty-state">No transfer history found.</p>';
        return;
    }
    let html = '<ul class="transaction-list">';
    transfersOnPage.forEach(tx => {
        const formattedDate = new Date(tx.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        html += `
            <li class="transaction-item">
                <div class="transaction-icon transfer"><i class="fas fa-exchange-alt"></i></div>
                <div class="transaction-details">
                    <div class="transaction-info">
                        <h4>${tx.fromWallet} <i class="fas fa-long-arrow-alt-right"></i> ${tx.toWallet}</h4>
                        <p>${formattedDate}</p>
                    </div>
                </div>
                <div class="transaction-amount amount-transfer">${formatRupiah(tx.amount)}</div>
                <div class="transaction-actions">
                    <button class="delete-btn" data-transaction-id="${tx.id}"><i class="fas fa-trash"></i></button>
                </div>
            </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
    attachDeleteListeners();
}

function attachDeleteListeners() {
    document.querySelectorAll('#transferHistory .delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            const transactionId = button.dataset.transactionId;
            handleDeleteTransferRecord(transactionId);
        });
    });
}

async function handleDeleteTransferRecord(transactionId) {
    if (!confirm('Are you sure you want to delete this transfer record? This will also revert the wallet balances to their previous state.')) {
        return;
    }
    try {
        showLoading();
        
        // 1. Ambil data transaksi yang akan dihapus
        const transferToDelete = allTransfers.find(tx => tx.id === transactionId);
        if (!transferToDelete) throw new Error("Transfer record not found");
        
        // 2. Ambil data wallet terkini
        const userData = await loadUserData(userId);
        const wallets = userData.wallets || {};
        
        // 3. Temukan wallet yang terlibat berdasarkan nama
        const fromWalletId = Object.keys(wallets).find(id => wallets[id].name === transferToDelete.fromWallet);
        const toWalletId = Object.keys(wallets).find(id => wallets[id].name === transferToDelete.toWallet);
        
        if (!fromWalletId || !toWalletId) {
            throw new Error("One or both wallets involved in this transfer no longer exist");
        }
        
        // 4. Kembalikan saldo ke nilai semula
        const updates = {};
        updates[`/users/${userId}/wallets/${fromWalletId}/balance`] = wallets[fromWalletId].balance + transferToDelete.amount;
        updates[`/users/${userId}/wallets/${toWalletId}/balance`] = wallets[toWalletId].balance - transferToDelete.amount;
        
        // 5. Hapus transaksi dan perbarui saldo dalam satu operasi
        updates[`/users/${userId}/transactions/${transactionId}`] = null;
        await update(ref(db), updates);
        
        // 6. Perbarui data lokal
        userWallets[fromWalletId].balance += transferToDelete.amount;
        userWallets[toWalletId].balance -= transferToDelete.amount;
        
        // 7. Muat ulang data transaksi dan tampilkan kembali
        const allTransactions = await loadTransactions(userId) || {};
        allTransfers = Object.values(allTransactions)
            .filter(tx => tx.type === 'transfer')
            .sort((a, b) => b.timestamp - a.timestamp);
        
        const totalPages = Math.ceil(allTransfers.length / TRANSFERS_PER_PAGE);
        if (currentTransferPage > totalPages && totalPages > 0) {
            currentTransferPage = totalPages;
        }

        // 8. Perbarui tampilan
        displayWallets();
        loadTransferFormOptions();
        displayTransferHistoryPage();
        
        showSuccessMessage('Transfer record deleted and wallet balances reverted successfully.');
    } catch (error) {
        console.error("Error deleting transfer record:", error);
        showError(error.message || "Failed to delete transfer record.");
    } finally {
        hideLoading();
    }
}

// ============================================================================
// Balance Transfer Logic (Updated)
// ============================================================================
async function handleBalanceTransfer(fromWalletId, toWalletId, amount) {
    try {
        showLoading();
        const fromWallet = userWallets[fromWalletId];
        const toWallet = userWallets[toWalletId];
        if (!fromWallet || !toWallet) throw new Error("Invalid wallet selected.");
        if (fromWallet.balance < amount) throw new Error("Insufficient balance.");

        const transferTransaction = {
            date: new Date().toISOString().split('T')[0],
            type: 'transfer',
            amount: amount,
            fromWallet: fromWallet.name,
            toWallet: toWallet.name,
            account: 'Transfer',
            timestamp: new Date().getTime()
        };
        
        const newTxRef = await saveTransaction(userId, transferTransaction);
        
        const newFromBalance = fromWallet.balance - amount;
        const newToBalance = toWallet.balance + amount;
        const updates = {};
        updates[`/users/${userId}/wallets/${fromWalletId}/balance`] = newFromBalance;
        updates[`/users/${userId}/wallets/${toWalletId}/balance`] = newToBalance;
        await update(ref(db), updates);

        // Update data lokal
        userWallets[fromWalletId].balance = newFromBalance;
        userWallets[toWalletId].balance = newToBalance;
        allTransfers.unshift({ id: newTxRef.key, ...transferTransaction }); // Tambahkan ke riwayat lokal
        allTransfers.sort((a, b) => b.timestamp - a.timestamp);

        displayWallets();
        loadTransferFormOptions();
        displayTransferHistoryPage();
        showSuccessMessage('Transfer successful and recorded!');
    } catch (error) {
        console.error("Error transferring balance:", error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// ============================================================================
// UI Helper Functions
// ============================================================================
function showSuccessMessage(message) { alert(message); }
function showError(message) {
    const errorElement = document.getElementById('transferError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => { errorElement.style.display = 'none'; }, 3000);
    }
}
function showLoading() {
    if (document.querySelector('.loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(overlay);
}
function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) overlay.remove();
}

// ============================================================================
// Event Listener for the Transfer Form
// ============================================================================
// ============================================================================
document.getElementById('transferForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fromWalletId = document.getElementById('fromWallet').value;
    const toWalletId = document.getElementById('toWallet').value;
    // PERBAIKAN DI SINI: Menggunakan id "transferAmount" yang benar sesuai HTML
    const amount = parseFloat(document.getElementById('transferAmount').value);

    // Validasi input
    if (!fromWalletId || !toWalletId) {
        showError('Please select both "From" and "To" wallets.');
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        showError('Please enter a valid positive amount.');
        return;
    }
    if (fromWalletId === toWalletId) {
        showError('Cannot transfer to the same wallet.');
        return;
    }

    // Panggil fungsi logika transfer
    await handleBalanceTransfer(fromWalletId, toWalletId, amount);
    
    // Reset form setelah transfer
    e.target.reset();
    // Muat ulang opsi dropdown untuk menampilkan saldo terbaru
    loadTransferFormOptions();
});
