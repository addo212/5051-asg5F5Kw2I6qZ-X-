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
const presetColors = ['#4CAF50', '#3498db', '#9b59b6', '#e91e63', '#f44336', '#ff9800'];

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
        
        // Logika baru untuk memuat dan merender aksen warna
        const savedAccentColor = (userData.settings && userData.settings.accentColor) || '#4CAF50';
        renderAccentColorUI(savedAccentColor);
        
        // Memuat data akun/kategori seperti sebelumnya
        const incomeAccounts = (userData.accounts && userData.accounts.income) || [];
        const expenseAccounts = (userData.accounts && userData.accounts.expense) || [];
        renderAccountLists(incomeAccounts, expenseAccounts);

    } catch (error) {
        console.error("Error initializing settings page:", error);
        alert("Failed to load settings. Please refresh the page.");
    }
}

async function loadUserData() {
    const snapshot = await get(ref(database, `users/${userId}`));
    return snapshot.val() || {};
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
    // Listener untuk kustomisasi warna
    document.getElementById('accentColorPicker').addEventListener('input', (e) => updateAccentColor(e.target.value));
    document.getElementById('colorSwatches').addEventListener('click', (e) => {
        if (e.target.classList.contains('color-swatch')) {
            updateAccentColor(e.target.dataset.color);
        }
    });

    // Listener untuk form akun (tetap sama)
    document.getElementById('addIncomeAccountForm').addEventListener('submit', (e) => handleAddAccount(e, 'income'));
    document.getElementById('addExpenseAccountForm').addEventListener('submit', (e) => handleAddAccount(e, 'expense'));
    document.getElementById('incomeAccountList').addEventListener('click', (e) => handleDeleteAccount(e, 'income'));
    document.getElementById('expenseAccountList').addEventListener('click', (e) => handleDeleteAccount(e, 'expense'));
    
    // Placeholder untuk fitur lain
    document.getElementById('exportDataBtn').addEventListener('click', () => alert('Export data feature is coming soon!'));
    document.getElementById('importDataBtn').addEventListener('click', () => alert('Import data feature is coming soon!'));
}

// ============================================================================
// ACCENT COLOR MANAGEMENT
// ============================================================================
function renderAccentColorUI(color) {
    const colorPicker = document.getElementById('accentColorPicker');
    const colorValueText = document.getElementById('accentColorValue');
    const swatchesContainer = document.getElementById('colorSwatches');

    // Set nilai awal pada UI
    colorPicker.value = color;
    colorValueText.textContent = color.toUpperCase();

    // Buat swatch warna preset
    swatchesContainer.innerHTML = presetColors.map(presetColor => `
        <div class="color-swatch ${presetColor.toLowerCase() === color.toLowerCase() ? 'active' : ''}" 
             data-color="${presetColor}" 
             style="background-color: ${presetColor};">
        </div>
    `).join('');
}

function updateAccentColor(newColor) {
    // 1. Terapkan ke UI secara langsung untuk feedback instan
    document.documentElement.style.setProperty('--accent-color', newColor);
    
    // 2. Perbarui tampilan kontrol di halaman settings
    renderAccentColorUI(newColor);
    
    // 3. Simpan ke Firebase
    saveAccentColorToFirebase(newColor);
}

async function saveAccentColorToFirebase(color) {
    try {
        const colorRef = ref(database, `users/${userId}/settings/accentColor`);
        await set(colorRef, color);
    } catch (error) {
        console.error("Failed to save accent color:", error);
        alert("Could not save your color preference.");
    }
}

// ============================================================================
// ACCOUNT MANAGEMENT (Logika ini tetap sama seperti sebelumnya)
// ============================================================================
function renderAccountLists(incomeAccounts, expenseAccounts) {
    renderList('incomeAccountList', incomeAccounts, 'income');
    renderList('expenseAccountList', expenseAccounts, 'expense');
}

function renderList(containerId, accountsArray, type) {
    const listContainer = document.getElementById(containerId);
    if (!listContainer) return;

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

        const updatedAccounts = [...currentAccounts, newName];
        await set(accountRef, updatedAccounts);
        
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
        const accountPath = `users/${userId}/accounts/${type}`;
        const accountRef = ref(database, accountPath);

        const snapshot = await get(accountRef);
        const currentAccounts = snapshot.val() || [];

        const updatedAccounts = currentAccounts.filter(acc => acc !== accountName);
        await set(accountRef, updatedAccounts);

        renderList(`${type}AccountList`, updatedAccounts, type);

    } catch (error) {
        console.error(`Error deleting ${type} account:`, error);
        alert(`Failed to delete account. Please try again.`);
    }
}
