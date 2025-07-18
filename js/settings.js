// js/settings.js

// ============================================================================
// MODULE IMPORTS
// ============================================================================
import { 
    auth, 
    loadUserData, 
    saveAccentColor, 
    saveAccount, 
    deleteAccount 
} from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

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
        const userData = await loadUserData(userId);
        
        // Memuat aksen warna dari userData
        const savedAccentColor = (userData.settings && userData.settings.accentColor) || '#4CAF50';
        renderAccentColorUI(savedAccentColor);
        
        // Memuat data akun/kategori
        const incomeAccounts = (userData.accounts && userData.accounts.income) || [];
        const expenseAccounts = (userData.accounts && userData.accounts.expense) || [];
        renderAccountLists(incomeAccounts, expenseAccounts);

    } catch (error) {
        console.error("Error initializing settings page:", error);
        alert("Failed to load settings. Please refresh the page.");
    }
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

    // Listener untuk form akun
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
    
    // 3. Simpan ke Firebase menggunakan fungsi dari database.js
    saveAccentColor(userId, newColor)
        .then(() => {
            // Hitung dan terapkan variasi warna untuk gradien
            const rgbColor = hexToRgb(newColor);
            if (rgbColor) {
                // Variasi lebih terang untuk gradient-start
                const lighterColor = adjustBrightness(rgbColor, 20);
                // Variasi lebih gelap untuk gradient-end
                const darkerColor = adjustBrightness(rgbColor, -20);
                
                document.documentElement.style.setProperty('--gradient-start', rgbToHex(lighterColor));
                document.documentElement.style.setProperty('--gradient-end', rgbToHex(darkerColor));
                
                // Ekstrak nilai RGB untuk digunakan dalam rgba()
                document.documentElement.style.setProperty(
                    '--accent-color-rgb', 
                    `${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}`
                );
            }
        })
        .catch(error => {
            console.error("Failed to save accent color:", error);
            alert("Could not save your color preference.");
        });
}

// ============================================================================
// ACCOUNT MANAGEMENT
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
        await saveAccount(userId, newName, type);
        
        // Reload user data to get updated accounts
        const userData = await loadUserData(userId);
        const incomeAccounts = (userData.accounts && userData.accounts.income) || [];
        const expenseAccounts = (userData.accounts && userData.accounts.expense) || [];
        
        renderAccountLists(incomeAccounts, expenseAccounts);
        inputElement.value = '';

    } catch (error) {
        console.error(`Error adding ${type} account:`, error);
        alert(`Failed to add account: ${error.message}`);
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
        await deleteAccount(userId, accountName, type);
        
        // Reload user data to get updated accounts
        const userData = await loadUserData(userId);
        const incomeAccounts = (userData.accounts && userData.accounts.income) || [];
        const expenseAccounts = (userData.accounts && userData.accounts.expense) || [];
        
        renderAccountLists(incomeAccounts, expenseAccounts);

    } catch (error) {
        console.error(`Error deleting ${type} account:`, error);
        alert(`Failed to delete account: ${error.message}`);
    }
}

// ============================================================================
// COLOR UTILITY FUNCTIONS
// ============================================================================
function hexToRgb(hex) {
    // Pastikan format hex valid
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(rgb) {
    return "#" + ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1);
}

function adjustBrightness(rgb, percent) {
    const adjust = (value) => {
        return Math.max(0, Math.min(255, Math.round(value + (value * percent / 100))));
    };
    
    return {
        r: adjust(rgb.r),
        g: adjust(rgb.g),
        b: adjust(rgb.b)
    };
}
