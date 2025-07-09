import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, update, get, set } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
let userId;

onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        loadAccounts();
        loadWallets();
    } else {
        window.location.href = "index.html";
    }
});

function loadAccounts() {
    const incomeAccountsList = document.getElementById('incomeAccountsList');
    const expenseAccountsList = document.getElementById('expenseAccountsList');

    get(ref(db, `users/${userId}/accounts`)).then((snapshot) => {
        const accounts = snapshot.val() || { income: [], expense: [] };

        displayAccounts(accounts.income, incomeAccountsList, 'income');
        displayAccounts(accounts.expense, expenseAccountsList, 'expense');
    });
}

function displayAccounts(accounts, listElement, type) {
    listElement.innerHTML = '';
    accounts.forEach(account => {
        const li = document.createElement('li');
        li.textContent = account;
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.dataset.accountId = account;
        deleteBtn.dataset.accountType = type;
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.addEventListener('click', () => deleteAccount(account, type));
        li.appendChild(deleteBtn);
        listElement.appendChild(li);
    });
}

function loadWallets() {
    const walletsList = document.getElementById('walletsList');

    get(ref(db, `users/${userId}/wallets`)).then((snapshot) => {
        const wallets = snapshot.val() || {};
        displayWallets(wallets, walletsList);
    });
}

function displayWallets(wallets, listElement) {
    listElement.innerHTML = '';
    for (const walletId in wallets) {
        const wallet = wallets[walletId];
        const li = document.createElement('li');
        li.textContent = wallet.name;
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.dataset.walletId = walletId;
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.addEventListener('click', () => deleteWallet(walletId));
        li.appendChild(deleteBtn);
        listElement.appendChild(li);
    }
}

// Fungsi untuk menyimpan akun
async function saveAccount(accountName, accountType) {
    get(ref(db, `users/${userId}/accounts`)).then((snapshot) => {
        const accounts = snapshot.val() || { income: [], expense: [] };
        accounts[accountType].push(accountName);
        set(ref(db, `users/${userId}/accounts`), accounts);
        loadAccounts();
    });
}

// Fungsi untuk menghapus akun
async function deleteAccount(accountName, accountType) {
    get(ref(db, `users/${userId}/accounts`)).then((snapshot) => {
        const accounts = snapshot.val() || { income: [], expense: [] };
        accounts[accountType] = accounts[accountType].filter(account => account !== accountName);
        set(ref(db, `users/${userId}/accounts`), accounts);
        loadAccounts();
    });
}

// Fungsi untuk menyimpan dompet
async function saveWallet(walletName) {
    const newWalletRef = push(ref(db, `users/${userId}/wallets`));
    set(newWalletRef, { name: walletName, balance: 0 });
    loadWallets();
}

// Fungsi untuk menghapus dompet
async function deleteWallet(walletId) {
    await remove(ref(db, `users/${userId}/wallets/${walletId}`));
    loadWallets();
}

document.getElementById('addAccountForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const accountName = document.getElementById('newAccountName').value;
    const accountType = document.getElementById('newAccountType').value;
    saveAccount(accountName, accountType);
    e.target.reset();
});

document.getElementById('addWalletForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const walletName = document.getElementById('newWalletName').value;
    saveWallet(walletName);
    e.target.reset();
});
