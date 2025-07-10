// wallets.js
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onValue, get, update } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
let userId;
let userWallets = {};

// ============================================================================
// Authentication state listener
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        loadWallets();
    } else {
        window.location.href = "index.html";
    }
});
// ============================================================================
// Get currency symbol
// ============================================================================
function getCurrencySymbol(currency) {
    switch (currency) {
        case 'USD': return '$';
        case 'IDR': return 'Rp';
        case 'EUR': return '€';
        case 'GBP': return '£';
        default: return '$';
    }
}

// ============================================================================
// Function to load wallets
// ============================================================================
async function loadWallets() {
    try {
        const walletsList = document.getElementById('walletsList');
        const userData = await loadUserData(userId);
        userWallets = userData.wallets || {};

        if (Object.keys(userWallets).length === 0) {
            walletsList.innerHTML = '<p class="empty-state">No wallets found.</p>';
            return;
        }

        displayWallets(userWallets, walletsList);
        loadTransferFormOptions(); // Load wallet options for transfer form
    } catch (error) {
        console.error("Error loading wallets:", error);
    }
}

// ============================================================================
// Function to display wallets
// ============================================================================
function displayWallets(wallets, listElement) {
    listElement.innerHTML = '';
    let html = '<ul>';
    for (const walletId in wallets) {
        const wallet = wallets[walletId];
        const currency = localStorage.getItem('currency') || 'USD';
        const currencySymbol = getCurrencySymbol(currency);
        html += `
            <li class="wallet-item">
                <h3>${wallet.name}</h3>
                <p>Balance: ${currencySymbol}${wallet.balance.toFixed(2)}</p>
            </li>
        `;
    }
    html += '</ul>';
    listElement.innerHTML = html;
}


// ============================================================================
// Function to load wallet options for transfer form
// ============================================================================
function loadTransferFormOptions() {
    const fromWalletSelect = document.getElementById('fromWallet');
    const toWalletSelect = document.getElementById('toWallet');

    // Clear existing options
    fromWalletSelect.innerHTML = '';
    toWalletSelect.innerHTML = '';

    for (const walletId in userWallets) {
        const wallet = userWallets[walletId];

        // Add options to "From Wallet" select
        const fromOption = document.createElement('option');
        fromOption.value = walletId;
        fromOption.text = wallet.name;
        fromWalletSelect.appendChild(fromOption);

        // Add options to "To Wallet" select
        const toOption = document.createElement('option');
        toOption.value = walletId;
        toOption.text = wallet.name;
        toWalletSelect.appendChild(toOption);
    }
}


// ============================================================================
// Function to handle transfer form submission
// ============================================================================
async function transferBalance(fromWalletId, toWalletId, amount) {
    try {
        // Get current wallet balances
        const fromWallet = userWallets[fromWalletId];
        const toWallet = userWallets[toWalletId];

        if (!fromWallet || !toWallet) {
            throw new Error("Invalid wallet selected.");
        }

        if (fromWallet.balance < amount) {
            throw new Error("Insufficient balance in the selected wallet.");
        }

        // Update balances
        const newFromBalance = fromWallet.balance - amount;
        const newToBalance = toWallet.balance + amount;

        // Update database
        await update(ref(db, `users/${userId}/wallets/${fromWalletId}`), { balance: newFromBalance });
        await update(ref(db, `users/${userId}/wallets/${toWalletId}`), { balance: newToBalance });

        // Update local wallet data and refresh display
        userWallets[fromWalletId].balance = newFromBalance;
        userWallets[toWalletId].balance = newToBalance;
        displayWallets(userWallets, document.getElementById('walletsList'));

        showSuccessMessage('Transfer successful!');

    } catch (error) {
        console.error("Error transferring balance:", error);
        showError(error.message); // Display specific error message
    }
}

// ============================================================================
// Function to load user data
// ============================================================================
async function loadUserData(userId) {
    try {
        const snapshot = await get(ref(db, `users/${userId}`));
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error("Error loading user data:", error);
        throw error;
    }
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
    const errorElement = document.getElementById('transferError');
    errorElement.textContent = message;
    errorElement.style.display = 'block';

    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 3000);
}


document.getElementById('transferForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const fromWallet = document.getElementById('fromWallet').value;
    const toWallet = document.getElementById('toWallet').value;
    const amount = parseFloat(document.getElementById('amount').value);

    if (isNaN(amount) || amount <= 0) {
        showError('Please enter a valid amount.');
        return;
    }

    if (fromWallet === toWallet) {
        showError('Cannot transfer to the same wallet.');
        return;
    }

    await transferBalance(fromWallet, toWallet, amount);
    e.target.reset();
});

