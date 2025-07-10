// settings.js
import { auth, db, loadUserData, saveWallet, deleteWallet, saveAccount, deleteAccount } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
let userId;
const availableIcons = [
    'fa-wallet', 'fa-piggy-bank', 'fa-university', 'fa-credit-card', 'fa-money-bill-wave',
    'fa-briefcase', 'fa-car', 'fa-home', 'fa-gift', 'fa-plane'
];

// ============================================================================
// Authentication state listener
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        loadAccounts();
        loadWallets();
        populateIconPicker();
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
// Wallet Management Functions
// ============================================================================
async function loadWallets() {
    const walletsListElement = document.getElementById('walletsList');
    try {
        const userData = await loadUserData(userId);
        const wallets = userData.wallets || {};
        displayWallets(wallets, walletsListElement);
    } catch (error) {
        console.error("Error loading wallets:", error);
    }
}

function displayWallets(wallets, listElement) {
    listElement.innerHTML = '';
    for (const walletId in wallets) {
        const wallet = wallets[walletId];
        const li = document.createElement('li');
        li.style.borderLeft = `5px solid ${wallet.color}`; // Tampilkan warna
        li.innerHTML = `
            <i class="fas ${wallet.icon}" style="margin-right: 10px; color: ${wallet.color};"></i>
            ${wallet.name}
            <button class="delete-btn" data-wallet-id="${walletId}"><i class="fas fa-trash"></i></button>
        `;
        li.querySelector('.delete-btn').addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete wallet: ${wallet.name}?`)) {
                deleteWallet(userId, walletId).then(loadWallets);
            }
        });
        listElement.appendChild(li);
    }
}

// ============================================================================
// Icon Picker Functions
// ============================================================================
function populateIconPicker() {
    const picker = document.getElementById('iconPicker');
    const selectedIconInput = document.getElementById('selectedWalletIcon');
    picker.innerHTML = '';

    availableIcons.forEach(iconClass => {
        const iconElement = document.createElement('i');
        iconElement.className = `fas ${iconClass} icon-option`;
        
        // Tandai ikon default sebagai terpilih
        if (iconClass === selectedIconInput.value) {
            iconElement.classList.add('selected');
        }

        iconElement.addEventListener('click', () => {
            // Hapus 'selected' dari semua ikon
            picker.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
            // Tambahkan 'selected' ke ikon yang diklik
            iconElement.classList.add('selected');
            // Simpan nilai ikon yang dipilih
            selectedIconInput.value = iconClass;
        });
        picker.appendChild(iconElement);
    });
}

// ============================================================================
// Event Listeners for Forms
// ============================================================================
document.getElementById('addWalletForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const walletName = document.getElementById('newWalletName').value;
    const walletColor = document.getElementById('newWalletColor').value;
    const walletIcon = document.getElementById('selectedWalletIcon').value;

    if (!walletName.trim()) {
        alert('Please enter a wallet name.');
        return;
    }

    saveWallet(userId, walletName, walletColor, walletIcon)
        .then(() => {
            showSuccessMessage('Wallet added successfully!');
            loadWallets(); // Muat ulang daftar dompet
            e.target.reset(); // Reset form
            // Reset pilihan ikon ke default
            document.getElementById('selectedWalletIcon').value = 'fa-wallet';
            populateIconPicker();
        })
        .catch(error => {
            alert(error.message);
        });
});
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
// ============================================================================
// UI Helper Functions
// ============================================================================
function showSuccessMessage(message) {
    alert(message);
}
