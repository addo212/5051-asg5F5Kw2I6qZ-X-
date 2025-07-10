// settings.js

// ============================================================================
// Module Imports
// ============================================================================
// Impor fungsi dan instance yang dibutuhkan dari file database.js terpusat
import { auth, loadUserData, saveWallet, deleteWallet, saveAccount, deleteAccount } from './database.js';
// Impor fungsi spesifik dari Firebase SDK
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// ============================================================================
// Global Variables & Constants
// ============================================================================
let userId;
// Daftar ikon yang bisa dipilih oleh pengguna. Anda bisa menambah/mengubah daftar ini.
const availableIcons = [
    'fa-wallet', 'fa-piggy-bank', 'fa-university', 'fa-credit-card', 'fa-money-bill-wave',
    'fa-briefcase', 'fa-car', 'fa-home', 'fa-gift', 'fa-plane', 'fa-shopping-cart', 'fa-heart'
];

// ============================================================================
// Initialization (Titik Awal Eksekusi)
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        // Muat semua data yang dibutuhkan saat halaman dibuka
        loadAccountsData();
        loadWalletsData();
        populateIconPicker();
    } else {
        // Jika tidak ada pengguna, arahkan kembali ke halaman login
        window.location.href = "index.html";
    }
});

// ============================================================================
// Account Management Functions
// ============================================================================
async function loadAccountsData() {
    const incomeList = document.getElementById('incomeAccountsList');
    const expenseList = document.getElementById('expenseAccountsList');
    try {
        const userData = await loadUserData(userId);
        const accounts = userData.accounts || { income: [], expense: [] };
        displayAccounts(accounts.income, incomeList, 'income');
        displayAccounts(accounts.expense, expenseList, 'expense');
    } catch (error) {
        console.error("Error loading accounts:", error);
    }
}

function displayAccounts(accounts, listElement, type) {
    listElement.innerHTML = `<h4>${type.charAt(0).toUpperCase() + type.slice(1)} Accounts</h4>`;
    if (!accounts || accounts.length === 0) {
        listElement.innerHTML += '<p>No accounts yet.</p>';
        return;
    }
    accounts.forEach(account => {
        const li = document.createElement('li');
        li.textContent = account;
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete account: ${account}?`)) {
                // Panggil fungsi deleteAccount dengan userId
                deleteAccount(userId, account, type)
                    .then(loadAccountsData)
                    .catch(error => alert(error.message));
            }
        });
        li.appendChild(deleteBtn);
        listElement.appendChild(li);
    });
}

// ============================================================================
// Wallet Management Functions
// ============================================================================
async function loadWalletsData() {
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
    listElement.innerHTML = ''; // Kosongkan daftar sebelum mengisi ulang
    if (Object.keys(wallets).length === 0) {
        listElement.innerHTML = '<p>No wallets yet.</p>';
        return;
    }
    for (const walletId in wallets) {
        const wallet = wallets[walletId];
        const li = document.createElement('li');
        li.style.borderLeft = `5px solid ${wallet.color}`;
        li.innerHTML = `
            <div>
                <i class="fas ${wallet.icon}" style="margin-right: 10px; color: ${wallet.color};"></i>
                <span>${wallet.name}</span>
            </div>
            <button class="delete-btn" data-wallet-id="${walletId}"><i class="fas fa-trash"></i></button>
        `;
        li.querySelector('.delete-btn').addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete wallet: ${wallet.name}?`)) {
                // Panggil fungsi deleteWallet dengan userId
                deleteWallet(userId, walletId)
                    .then(loadWalletsData)
                    .catch(error => alert(error.message));
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
    if (!picker || !selectedIconInput) return;
    
    picker.innerHTML = '';
    const defaultIcon = 'fa-wallet';
    selectedIconInput.value = defaultIcon; // Set nilai default

    availableIcons.forEach(iconClass => {
        const iconElement = document.createElement('i');
        iconElement.className = `fas ${iconClass} icon-option`;
        
        if (iconClass === defaultIcon) {
            iconElement.classList.add('selected');
        }

        iconElement.addEventListener('click', () => {
            picker.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
            iconElement.classList.add('selected');
            selectedIconInput.value = iconClass;
        });
        picker.appendChild(iconElement);
    });
}

// ============================================================================
// Event Listeners for Forms
// ============================================================================
document.getElementById('addWalletForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const walletName = document.getElementById('newWalletName').value;
    const walletColor = document.getElementById('newWalletColor').value;
    const walletIcon = document.getElementById('selectedWalletIcon').value;

    if (!walletName.trim()) {
        alert('Please enter a wallet name.');
        return;
    }

    // Panggil fungsi saveWallet dari database.js dengan semua parameter
    saveWallet(userId, walletName, walletColor, walletIcon)
        .then(() => {
            showSuccessMessage('Wallet added successfully!');
            loadWalletsData(); // Muat ulang daftar dompet
            e.target.reset(); // Reset form
            populateIconPicker(); // Reset pilihan ikon ke default
        })
        .catch(error => {
            alert(error.message);
        });
});

document.getElementById('addAccountForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const accountName = document.getElementById('newAccountName').value;
    const accountType = document.getElementById('newAccountType').value;

    if (!accountName.trim()) {
        alert('Please enter an account name.');
        return;
    }

    // Panggil fungsi saveAccount dari database.js dengan userId
    saveAccount(userId, accountName, accountType)
        .then(() => {
            showSuccessMessage('Account added successfully!');
            loadAccountsData();
            e.target.reset();
        })
        .catch(error => {
            alert(error.message);
        });
});

// ============================================================================
// UI Helper Functions
// ============================================================================
function showSuccessMessage(message) {
    alert(message); // Menggunakan alert sederhana untuk notifikasi sukses
}
