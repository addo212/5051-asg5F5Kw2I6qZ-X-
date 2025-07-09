// settings.js
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, update, get, set } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
let userId;

// ============================================================================
// Authentication state listener
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        loadAccounts();
        loadWallets();
    } else {
        window.location.href = "index.html";
    }
});

// ============================================================================
// Function to load accounts from database
// ============================================================================
function loadAccounts() {
    const incomeAccountsList = document.getElementById('incomeAccountsList');
    const expenseAccountsList = document.getElementById('expenseAccountsList');

    get(ref(db, `users/${userId}/accounts`)).then((snapshot) => {
        const accounts = snapshot.val() || { income: [], expense: [] };

        displayAccounts(accounts.income, incomeAccountsList, 'income');
        displayAccounts(accounts.expense, expenseAccountsList, 'expense');
    }).catch((error) => {
        console.error("Error loading accounts:", error);
        // Handle error, e.g., display an error message
    });
}

// ============================================================================
// Function to display accounts in the settings page
// ============================================================================
function displayAccounts(accounts, listElement, type) {
    listElement.innerHTML = ''; // Clear existing list items

    accounts.forEach(account => {
        const li = document.createElement('li');
        li.textContent = account;

        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.dataset.accountId = account;
        deleteBtn.dataset.accountType = type;
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete account: ${account}?`)) {
                deleteAccount(account, type);
            }
        });

        li.appendChild(deleteBtn);
        listElement.appendChild(li);
    });
}

// ============================================================================
// Function to load wallets from database
// ============================================================================
function loadWallets() {
    const walletsList = document.getElementById('walletsList');

    get(ref(db, `users/${userId}/wallets`)).then((snapshot) => {
        const wallets = snapshot.val() || {};
        displayWallets(wallets, walletsList);
    }).catch((error) => {
        console.error("Error loading wallets:", error);
        // Handle error, e.g., display an error message
    });
}

// ============================================================================
// Function to display wallets in the settings page
// ============================================================================
function displayWallets(wallets, listElement) {
    listElement.innerHTML = ''; // Clear existing list items

    for (const walletId in wallets) {
        const wallet = wallets[walletId];
        const li = document.createElement('li');
        li.textContent = wallet.name;

        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.dataset.walletId = walletId;
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete wallet: ${wallet.name}?`)) {
                deleteWallet(walletId);
            }
        });

        li.appendChild(deleteBtn);
        listElement.appendChild(li);
    }
}

// ============================================================================
// Function to save a new account to the database
// ============================================================================
async function saveAccount(accountName, accountType) {
    if (!accountName.trim()) {
        alert('Please enter a valid account name.');
        return;
    }

    try {
        await get(ref(db, `users/${userId}/accounts`)).then((snapshot) => {
            const accounts = snapshot.val() || { income: [], expense: [] };
            if (accounts[accountType].includes(accountName)) {
                alert('Account with this name already exists.');
                return;
            }
            accounts[accountType].push(accountName);
            return set(ref(db, `users/${userId}/accounts`), accounts);
        }).then(() => {
            loadAccounts(); // Reload accounts after saving
            showSuccessMessage('Account added successfully!');
        });
    } catch (error) {
        console.error("Error saving account:", error);
        showError('Failed to save account. Please try again.');
    }
}


// ============================================================================
// Function to delete an account from the database
// ============================================================================
async function deleteAccount(accountName, accountType) {
    try {
        await get(ref(db, `users/${userId}/accounts`)).then((snapshot) => {
            const accounts = snapshot.val() || { income: [], expense: [] };
            accounts[accountType] = accounts[accountType].filter(account => account !== accountName);
            return set(ref(db, `users/${userId}/accounts`), accounts);
        }).then(() => {
            loadAccounts(); // Reload accounts after deleting
            showSuccessMessage('Account deleted successfully!');
        });
    } catch (error) {
        console.error("Error deleting account:", error);
        showError('Failed to delete account. Please try again.');
    }
}


// ============================================================================
// Function to save a new wallet to the database
// ============================================================================
async function saveWallet(walletName) {
    if (!walletName.trim()) {
        alert('Please enter a valid wallet name.');
        return;
    }

    try {
        const walletsRef = ref(db, `users/${userId}/wallets`);
        const snapshot = await get(walletsRef);
        const wallets = snapshot.val() || {};

        if (Object.values(wallets).some(wallet => wallet.name === walletName)) {
            alert('Wallet with this name already exists.');
            return;
        }

        const newWalletRef = push(walletsRef);
        await set(newWalletRef, { name: walletName, balance: 0 });
        loadWallets(); // Reload wallets after saving
        showSuccessMessage('Wallet added successfully!');

    } catch (error) {
        console.error("Error saving wallet:", error);
        showError('Failed to save wallet. Please try again.');
    }
}

// ============================================================================
// Function to delete a wallet from the database
// ============================================================================
async function deleteWallet(walletId) {
    try {
        await remove(ref(db, `users/${userId}/wallets/${walletId}`));
        loadWallets(); // Reload wallets after deleting
        showSuccessMessage('Wallet deleted successfully!');
    } catch (error) {
        console.error("Error deleting wallet:", error);
        showError('Failed to delete wallet. Please try again.');
    }
}

// ============================================================================
// Event listener for adding a new account
// ============================================================================
document.getElementById('addAccountForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const accountName = document.getElementById('newAccountName').value;
    const accountType = document.getElementById('newAccountType').value;
    saveAccount(accountName, accountType);
    e.target.reset();
});

// ============================================================================
// Event listener for adding a new wallet
// ============================================================================
document.getElementById('addWalletForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const walletName = document.getElementById('newWalletName').value;
    saveWallet(walletName);
    e.target.reset();
});

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
    // Implementasi fungsi showError()
    // ...
}
