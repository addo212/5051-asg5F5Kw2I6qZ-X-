// wallets.js

// ============================================================================
// Module Imports
// ============================================================================
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    getDatabase,
    ref, 
    get, 
    set, 
    update, 
    push, 
    remove 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { formatRupiah } from './utils.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// ============================================================================
// Global Variables
// ============================================================================
let userId;
const walletColors = [
    '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336',
    '#3F51B5', '#009688', '#FF5722', '#607D8B', '#E91E63'
];
const walletIcons = [
    'fa-wallet', 'fa-credit-card', 'fa-piggy-bank', 'fa-money-bill',
    'fa-coins', 'fa-landmark', 'fa-money-check', 'fa-university',
    'fa-dollar-sign', 'fa-money-bill-wave'
];
// ============================================================================
// Main Initialization on Auth State Change
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeWalletsPage();
        setupEventListeners();
    } else {
        window.location.href = "index.html";
    }
});

// ============================================================================
// Event Listeners
// ============================================================================
function setupEventListeners() {
    // Add wallet button
    document.getElementById('addWalletBtn')?.addEventListener('click', () => {
        document.getElementById('walletModal').style.display = 'flex';
    });

    // Transfer button
    document.getElementById('transferBtn')?.addEventListener('click', () => {
        showTransferModal();
    });

    // Close modal buttons
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });

    // Add wallet form
    document.getElementById('walletForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('walletName').value;
        const balance = parseFloat(document.getElementById('walletBalance').value);
        const color = document.getElementById('walletColor').value;
        const icon = document.getElementById('walletIcon').value;
        
        if (!name || isNaN(balance)) {
            alert('Please fill all required fields');
            return;
        }
        
        try {
            document.getElementById('walletSubmitBtn').disabled = true;
            document.getElementById('walletSubmitBtn').textContent = 'Adding...';
            
            await addWallet(name, balance, color, icon);
            
            alert('Wallet added successfully!');
            document.getElementById('walletForm').reset();
            document.getElementById('walletModal').style.display = 'none';
            
            // Refresh wallet data
            await loadAndDisplayWallets();
        } catch (error) {
            alert(`Failed to add wallet: ${error.message}`);
        } finally {
            document.getElementById('walletSubmitBtn').disabled = false;
            document.getElementById('walletSubmitBtn').textContent = 'Add Wallet';
        }
    });

    // Transfer form
    document.getElementById('transferForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fromWalletId = document.getElementById('fromWallet').value;
        const toWalletId = document.getElementById('toWallet').value;
        const amount = parseFloat(document.getElementById('transferAmount').value);
        const description = document.getElementById('transferDescription').value;
        const date = document.getElementById('transferDate').value; // Ambil nilai tanggal
        
        if (!fromWalletId || !toWalletId || isNaN(amount) || amount <= 0) {
            alert('Please fill all required fields with valid values');
            return;
        }
        
        try {
            document.getElementById('transferSubmitBtn').disabled = true;
            document.getElementById('transferSubmitBtn').textContent = 'Processing...';
            
            await transferBetweenWallets(fromWalletId, toWalletId, amount, description, date);
            
            alert('Transfer completed successfully!');
            document.getElementById('transferForm').reset();
            document.getElementById('transferModal').style.display = 'none';
            
            // Refresh wallet data
            await loadAndDisplayWallets();
        } catch (error) {
            alert(`Transfer failed: ${error.message}`);
        } finally {
            document.getElementById('transferSubmitBtn').disabled = false;
            document.getElementById('transferSubmitBtn').textContent = 'Transfer';
        }
    });

    // Edit wallet form
    document.getElementById('editWalletForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const walletId = document.getElementById('editWalletId').value;
        const name = document.getElementById('editWalletName').value;
        const color = document.getElementById('editWalletColor').value;
        const icon = document.getElementById('editWalletIcon').value;
        
        if (!walletId || !name) {
            alert('Please fill all required fields');
            return;
        }
        
        try {
            document.getElementById('editWalletSubmitBtn').disabled = true;
            document.getElementById('editWalletSubmitBtn').textContent = 'Saving...';
            
            await updateWallet(walletId, { name, color, icon });
            
            alert('Wallet updated successfully!');
            document.getElementById('editWalletModal').style.display = 'none';
            
            // Refresh wallet data
            await loadAndDisplayWallets();
        } catch (error) {
            alert(`Failed to update wallet: ${error.message}`);
        } finally {
            document.getElementById('editWalletSubmitBtn').disabled = false;
            document.getElementById('editWalletSubmitBtn').textContent = 'Save Changes';
        }
    });

    // Initialize color and icon pickers
    initializeColorPicker('walletColor');
    initializeIconPicker('walletIcon');
    initializeColorPicker('editWalletColor');
    initializeIconPicker('editWalletIcon');
}

// ============================================================================
// Core Wallets Page Logic
// ============================================================================
async function initializeWalletsPage() {
    try {
        // Check if we need to show transfer modal from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        
        // Load and display wallets
        await loadAndDisplayWallets();
        
        // Show transfer modal if action=transfer
        if (action === 'transfer') {
            showTransferModal();
        }
    } catch (error) {
        console.error('Error initializing wallets page:', error);
        alert('Failed to load wallet data. Please try refreshing the page.');
    }
}

// Fungsi untuk menampilkan modal transfer
function showTransferModal() {
    const modal = document.getElementById('transferModal');
    if (!modal) return;
    
    // Set tanggal hari ini sebagai default
    const today = new Date();
    const formattedDate = formatDateForInput(today);
    document.getElementById('transferDate').value = formattedDate;
    
    // Tampilkan modal
    modal.style.display = 'flex';
}

// Helper function untuk memformat tanggal untuk input date (YYYY-MM-DD)
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================================================
// Wallet Management Functions
// ============================================================================
async function loadAndDisplayWallets() {
    try {
        const userRef = ref(database, `users/${userId}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();
        
        if (!userData) {
            throw new Error('User data not found');
        }
        
        const wallets = userData.wallets || {};
        displayWallets(wallets);
        populateWalletDropdowns(wallets);
        
        // Update total balance display
        document.getElementById('totalBalance').textContent = formatRupiah(userData.totalBalance || 0);
    } catch (error) {
        console.error('Error loading wallets:', error);
        throw error;
    }
}

function displayWallets(wallets) {
    const container = document.getElementById('walletsContainer');
    if (!container) return;
    
    if (Object.keys(wallets).length === 0) {
        container.innerHTML = '<p class="empty-state">No wallets found. Create a wallet to get started.</p>';
        return;
    }
    
    let html = '';
    Object.entries(wallets).forEach(([id, wallet]) => {
        const darkerColor = adjustColor(wallet.color || '#6c5ce7', -30);
        
        html += `
            <div class="wallet-card" style="background: linear-gradient(135deg, ${wallet.color || '#6c5ce7'}, ${darkerColor})">
                <div class="wallet-header">
                    <div class="wallet-icon">
                        <i class="fas ${wallet.icon || 'fa-wallet'}"></i>
                    </div>
                    <div class="wallet-actions">
                        <button class="edit-wallet-btn" data-id="${id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-wallet-btn" data-id="${id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <h3>${wallet.name}</h3>
                <p class="wallet-balance">${formatRupiah(wallet.balance || 0)}</p>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.edit-wallet-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const walletId = e.currentTarget.getAttribute('data-id');
            openEditWalletModal(walletId, wallets[walletId]);
        });
    });
    
    document.querySelectorAll('.delete-wallet-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const walletId = e.currentTarget.getAttribute('data-id');
            const wallet = wallets[walletId];
            
            if (confirm(`Are you sure you want to delete the wallet "${wallet.name}"? This action cannot be undone.`)) {
                try {
                    await deleteWallet(walletId);
                    await loadAndDisplayWallets();
                } catch (error) {
                    alert(`Failed to delete wallet: ${error.message}`);
                }
            }
        });
    });
}

function populateWalletDropdowns(wallets) {
    const fromWalletSelect = document.getElementById('fromWallet');
    const toWalletSelect = document.getElementById('toWallet');
    
    if (!fromWalletSelect || !toWalletSelect) return;
    
    // Clear existing options
    fromWalletSelect.innerHTML = '<option value="">Select source wallet</option>';
    toWalletSelect.innerHTML = '<option value="">Select destination wallet</option>';
    
    // Add wallet options
    Object.entries(wallets).forEach(([id, wallet]) => {
        const option = `<option value="${id}">${wallet.name} (${formatRupiah(wallet.balance || 0)})</option>`;
        fromWalletSelect.insertAdjacentHTML('beforeend', option);
        toWalletSelect.insertAdjacentHTML('beforeend', option);
    });
}

function openEditWalletModal(walletId, wallet) {
    const modal = document.getElementById('editWalletModal');
    if (!modal) return;
    
    document.getElementById('editWalletId').value = walletId;
    document.getElementById('editWalletName').value = wallet.name;
    document.getElementById('editWalletColor').value = wallet.color || '#6c5ce7';
    document.getElementById('editWalletIcon').value = wallet.icon || 'fa-wallet';
    
    // Update color and icon previews
    updateColorPreview('editWalletColor');
    updateIconPreview('editWalletIcon');
    
    modal.style.display = 'flex';
}

async function addWallet(name, balance, color, icon) {
    try {
        // Get user data
        const userRef = ref(database, `users/${userId}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val() || {};
        
        // Create new wallet
        const walletRef = push(ref(database, `users/${userId}/wallets`));
        const walletId = walletRef.key;
        const wallet = {
            name,
            balance,
            color: color || '#6c5ce7',
            icon: icon || 'fa-wallet'
        };
        
        // Update total balance
        const totalBalance = (userData.totalBalance || 0) + balance;
        
        // Create initial transaction if balance > 0
        let transactionId = null;
        let transaction = null;
        
        if (balance > 0) {
            const transactionRef = push(ref(database, `users/${userId}/transactions`));
            transactionId = transactionRef.key;
            const now = new Date();
            transaction = {
                id: transactionId,
                type: 'income',
                amount: balance,
                description: `Initial balance for ${name}`,
                account: 'Initial Balance',
                wallet: name,
                walletId,
                timestamp: now.getTime(),
                date: formatDateForDB(now)
            };
        }
        
        // Update database
        const updates = {};
        updates[`users/${userId}/wallets/${walletId}`] = wallet;
        updates[`users/${userId}/totalBalance`] = totalBalance;
        
        if (transaction) {
            updates[`users/${userId}/transactions/${transactionId}`] = transaction;
        }
        
        await update(ref(database), updates);
        return walletId;
    } catch (error) {
        console.error('Error adding wallet:', error);
        throw error;
    }
}

async function updateWallet(walletId, updates) {
    try {
        const walletRef = ref(database, `users/${userId}/wallets/${walletId}`);
        const walletSnapshot = await get(walletRef);
        const wallet = walletSnapshot.val();
        
        if (!wallet) {
            throw new Error('Wallet not found');
        }
        
        // Update wallet properties
        const updatedWallet = {
            ...wallet,
            ...updates
        };
        
        await set(walletRef, updatedWallet);
        return walletId;
    } catch (error) {
        console.error('Error updating wallet:', error);
        throw error;
    }
}

async function deleteWallet(walletId) {
    try {
        // Get user data
        const userRef = ref(database, `users/${userId}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();
        
        if (!userData || !userData.wallets || !userData.wallets[walletId]) {
            throw new Error('Wallet not found');
        }
        
        const wallet = userData.wallets[walletId];
        
        // Update total balance
        const totalBalance = (userData.totalBalance || 0) - (wallet.balance || 0);
        
        // Remove wallet and update total balance
        const updates = {};
        updates[`users/${userId}/wallets/${walletId}`] = null;
        updates[`users/${userId}/totalBalance`] = totalBalance;
        
        await update(ref(database), updates);
        return true;
    } catch (error) {
        console.error('Error deleting wallet:', error);
        throw error;
    }
}

// Fungsi untuk melakukan transfer antar wallet
async function transferBetweenWallets(fromWalletId, toWalletId, amount, description, date) {
    try {
        // Validasi input
        if (!fromWalletId || !toWalletId || amount <= 0) {
            throw new Error('Invalid transfer parameters');
        }

        if (fromWalletId === toWalletId) {
            throw new Error('Cannot transfer to the same wallet');
        }

        // Ambil data wallet
        const userRef = ref(database, `users/${userId}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        if (!userData || !userData.wallets) {
            throw new Error('User data or wallets not found');
        }

        const wallets = userData.wallets;
        const fromWallet = wallets[fromWalletId];
        const toWallet = wallets[toWalletId];

        if (!fromWallet || !toWallet) {
            throw new Error('One or both wallets not found');
        }

        // Cek saldo cukup
        if (fromWallet.balance < amount) {
            throw new Error('Insufficient balance in source wallet');
        }

        // Konversi tanggal ke timestamp
        const timestamp = date ? new Date(date).getTime() : Date.now();

        // Update saldo wallet
        const fromWalletBalance = (fromWallet.balance || 0) - amount;
        const toWalletBalance = (toWallet.balance || 0) + amount;

        // Buat transaksi untuk wallet sumber (expense)
        const fromTransactionRef = push(ref(database, `users/${userId}/transactions`));
        const fromTransactionId = fromTransactionRef.key;
        const fromTransaction = {
            id: fromTransactionId,
            type: 'expense',
            amount: amount,
            description: description || `Transfer to ${toWallet.name}`,
            account: 'Transfer Out',
            wallet: fromWallet.name,
            walletId: fromWalletId,
            timestamp: timestamp,
            date: formatDateForDB(new Date(timestamp))
        };

        // Buat transaksi untuk wallet tujuan (income)
        const toTransactionRef = push(ref(database, `users/${userId}/transactions`));
        const toTransactionId = toTransactionRef.key;
        const toTransaction = {
            id: toTransactionId,
            type: 'income',
            amount: amount,
            description: description || `Transfer from ${fromWallet.name}`,
            account: 'Transfer In',
            wallet: toWallet.name,
            walletId: toWalletId,
            timestamp: timestamp,
            date: formatDateForDB(new Date(timestamp))
        };

        // Update database
        const updates = {};
        updates[`users/${userId}/wallets/${fromWalletId}/balance`] = fromWalletBalance;
        updates[`users/${userId}/wallets/${toWalletId}/balance`] = toWalletBalance;
        updates[`users/${userId}/transactions/${fromTransactionId}`] = fromTransaction;
        updates[`users/${userId}/transactions/${toTransactionId}`] = toTransaction;
        updates[`users/${userId}/totalBalance`] = (userData.totalBalance || 0); // Total balance tidak berubah pada transfer

        await update(ref(database), updates);
        return { fromTransaction, toTransaction };
    } catch (error) {
        console.error('Error transferring between wallets:', error);
        throw error;
    }
}

// Helper function to format date for database (YYYY-MM-DD)
function formatDateForDB(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================================================
// UI Helper Functions
// ============================================================================
function initializeColorPicker(inputId) {
    const colorInput = document.getElementById(inputId);
    if (!colorInput) return;
    
    // Set initial color
    colorInput.value = colorInput.value || walletColors[0];
    updateColorPreview(inputId);
    
    // Create color options
    const colorPickerContainer = document.createElement('div');
    colorPickerContainer.className = 'color-picker';
    
    walletColors.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;
        colorOption.setAttribute('data-color', color);
        colorOption.addEventListener('click', () => {
            colorInput.value = color;
            updateColorPreview(inputId);
        });
        colorPickerContainer.appendChild(colorOption);
    });
    
    // Insert color picker after the input
    colorInput.parentNode.insertBefore(colorPickerContainer, colorInput.nextSibling);
    
    // Update color preview when input changes
    colorInput.addEventListener('input', () => {
        updateColorPreview(inputId);
    });
}

function updateColorPreview(inputId) {
    const colorInput = document.getElementById(inputId);
    if (!colorInput) return;
    
    const previewElement = colorInput.parentNode.querySelector('.color-preview') || document.createElement('div');
    previewElement.className = 'color-preview';
    previewElement.style.backgroundColor = colorInput.value;
    
    if (!colorInput.parentNode.querySelector('.color-preview')) {
        colorInput.parentNode.insertBefore(previewElement, colorInput);
    }
}

function initializeIconPicker(inputId) {
    const iconInput = document.getElementById(inputId);
    if (!iconInput) return;
    
    // Set initial icon
    iconInput.value = iconInput.value || walletIcons[0];
    updateIconPreview(inputId);
    
    // Create icon options
    const iconPickerContainer = document.createElement('div');
    iconPickerContainer.className = 'icon-picker';
    
    walletIcons.forEach(icon => {
        const iconOption = document.createElement('div');
        iconOption.className = 'icon-option';
        iconOption.innerHTML = `<i class="fas ${icon}"></i>`;
        iconOption.setAttribute('data-icon', icon);
        iconOption.addEventListener('click', () => {
            iconInput.value = icon;
            updateIconPreview(inputId);
        });
        iconPickerContainer.appendChild(iconOption);
    });
    
    // Insert icon picker after the input
    iconInput.parentNode.insertBefore(iconPickerContainer, iconInput.nextSibling);
    
    // Update icon preview when input changes
    iconInput.addEventListener('input', () => {
        updateIconPreview(inputId);
    });
}

function updateIconPreview(inputId) {
    const iconInput = document.getElementById(inputId);
    if (!iconInput) return;
    
    const previewElement = iconInput.parentNode.querySelector('.icon-preview') || document.createElement('div');
    previewElement.className = 'icon-preview';
    previewElement.innerHTML = `<i class="fas ${iconInput.value}"></i>`;
    
    if (!iconInput.parentNode.querySelector('.icon-preview')) {
        iconInput.parentNode.insertBefore(previewElement, iconInput);
    }
}

function adjustColor(hex, percent) {
    // Convert hex to RGB
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);

    // Adjust color
    r = Math.max(0, Math.min(255, r + percent));
    g = Math.max(0, Math.min(255, g + percent));
    b = Math.max(0, Math.min(255, b + percent));

    // Convert back to hex
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Export functions for testing
export { addWallet, updateWallet, deleteWallet, transferBetweenWallets };
