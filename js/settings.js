// js/settings.js

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
    set
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

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

// ============================================================================
// AUTHENTICATION & INITIALIZATION
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeSettingsPage();
    } else {
        window.location.href = "index.html";
    }
});

async function initializeSettingsPage() {
    setupEventListeners();
    try {
        const userData = await loadUserData();
        renderThemeOptions();
        
        // PERBAIKAN: Mengambil data dari struktur yang benar (userData.accounts)
        const incomeAccounts = (userData.accounts && userData.accounts.income) || [];
        const expenseAccounts = (userData.accounts && userData.accounts.expense) || [];
        
        renderAccountLists(incomeAccounts, expenseAccounts);
    } catch (error) {
        console.error("Error initializing settings page:", error);
        alert("Failed to load settings. Please refresh the page.");
    }
}

async function loadUserData() {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    return snapshot.val() || {};
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
    document.getElementById('themeOptions').addEventListener('click', handleThemeSelection);
    document.getElementById('addIncomeAccountForm').addEventListener('submit', (e) => handleAddAccount(e, 'income'));
    document.getElementById('addExpenseAccountForm').addEventListener('submit', (e) => handleAddAccount(e, 'expense'));
    document.getElementById('incomeAccountList').addEventListener('click', (e) => handleDeleteAccount(e, 'income'));
    document.getElementById('expenseAccountList').addEventListener('click', (e) => handleDeleteAccount(e, 'expense'));
    document.getElementById('exportDataBtn').addEventListener('click', () => alert('Export data feature is coming soon!'));
    document.getElementById('importDataBtn').addEventListener('click', () => alert('Import data feature is coming soon!'));
}

// ============================================================================
// THEME MANAGEMENT (Tetap sama)
// ============================================================================
function renderThemeOptions() {
    const themeContainer = document.getElementById('themeOptions');
    const themes = [
        { name: 'light', label: 'Light' },
        { name: 'dark', label: 'Dark' },
        { name: 'blue', label: 'Blue' },
        { name: 'purple', label: 'Purple' }
    ];
    const currentTheme = localStorage.getItem('theme') || 'light';

    themeContainer.innerHTML = themes.map(theme => `
        <div class="theme-option ${currentTheme === theme.name ? 'active' : ''}" data-theme="${theme.name}">
            <div class="theme-preview ${theme.name}-theme">
                <div class="preview-header"></div>
                <div class="preview-content"></div>
            </div>
            <span>${theme.label}</span>
            <i class="fas fa-check-circle theme-selected"></i>
        </div>
    `).join('');
}

function handleThemeSelection(e) {
    const themeOption = e.target.closest('.theme-option');
    if (!themeOption) return;
    const newTheme = themeOption.dataset.theme;
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
    themeOption.classList.add('active');
}

// ============================================================================
// ACCOUNT MANAGEMENT (CRUD) - Diperbaiki untuk menangani ARRAY
// ============================================================================
function renderAccountLists(incomeAccounts, expenseAccounts) {
    // PERBAIKAN: Langsung memproses array
    renderList('incomeAccountList', incomeAccounts, 'income');
    renderList('expenseAccountList', expenseAccounts, 'expense');
}

function renderList(containerId, accountsArray, type) {
    const listContainer = document.getElementById(containerId);
    if (!listContainer) return;

    // PERBAIKAN: Memfilter nilai null yang mungkin ada di database Anda
    const validAccounts = accountsArray.filter(acc => acc !== null);

    if (validAccounts.length === 0) {
        listContainer.innerHTML = `<li class="empty-state">No ${type} accounts found.</li>`;
        return;
    }

    listContainer.innerHTML = validAccounts.sort().map(accountName => `
        <li>
            <span>${accountName}</span>
            <button class="delete-btn" data-name="${accountName}" data-type="${type}">
                <i class="fas fa-trash-alt"></i>
            </button>
        </li>
    `).join('');
}

async function handleAddAccount(e, type) {
    e.preventDefault();
    const inputId = type === 'income' ? 'newIncomeAccountName' : 'newExpenseAccountName';
    const inputElement = document.getElementById(inputId);
    const newName = inputElement.value.trim();

    if (!newName) {
        alert('Account name cannot be empty.');
        return;
    }

    const btn = e.target.querySelector('button');
    btn.disabled = true;

    try {
        // PERBAIKAN: Path sekarang menunjuk ke node array (income atau expense)
        const accountPath = `users/${userId}/accounts/${type}`;
        const accountRef = ref(database, accountPath);
        
        const snapshot = await get(accountRef);
        const currentAccounts = snapshot.val() || [];

        if (currentAccounts.includes(newName)) {
            alert(`Account "${newName}" already exists.`);
            inputElement.value = '';
            btn.disabled = false;
            return;
        }

        // PERBAIKAN: Menambahkan item baru ke array dan menulis ulang seluruh array
        const updatedAccounts = [...currentAccounts, newName];
        await set(accountRef, updatedAccounts);
        
        // Refresh UI
        renderList(`${type}AccountList`, updatedAccounts, type);
        inputElement.value = '';

    } catch (error) {
        console.error(`Error adding ${type} account:`, error);
        alert(`Failed to add account. Please try again.`);
    } finally {
        btn.disabled = false;
    }
}

async function handleDeleteAccount(e, type) {
    const deleteButton = e.target.closest('.delete-btn');
    if (!deleteButton) return;

    const accountName = deleteButton.dataset.name;
    if (!confirm(`Are you sure you want to delete the account "${accountName}"? This cannot be undone.`)) {
        return;
    }

    try {
        // PERBAIKAN: Path sekarang menunjuk ke node array
        const accountPath = `users/${userId}/accounts/${type}`;
        const accountRef = ref(database, accountPath);

        const snapshot = await get(accountRef);
        const currentAccounts = snapshot.val() || [];

        // PERBAIKAN: Membuat array baru tanpa item yang dihapus, lalu menulis ulang
        const updatedAccounts = currentAccounts.filter(acc => acc !== accountName);
        await set(accountRef, updatedAccounts);

        // Refresh UI
        renderList(`${type}AccountList`, updatedAccounts, type);

    } catch (error) {
        console.error(`Error deleting ${type} account:`, error);
        alert(`Failed to delete account. Please try again.`);
    }
}
