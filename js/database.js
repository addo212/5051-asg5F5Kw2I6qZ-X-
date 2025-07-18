// database.js
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, get, update, remove, push, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// ============================================================================
// Firebase Initialization (HANYA DI FILE INI)
// ============================================================================
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);


// ============================================================================
// User Data Operations
// ============================================================================
export async function loadUserData(userId) {
    try {
        const snapshot = await get(ref(db, `users/${userId}`));
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error("Error loading user data:", error);
        throw error;
    }
}

export async function updateUserData(userId, updates) {
    try {
        await update(ref(db, `users/${userId}`), updates);
        console.log("Data updated successfully!");
    } catch (error) {
        console.error("Error updating data:", error);
        throw error;
    }
}

// ============================================================================
// Theme & Appearance Settings
// ============================================================================
export async function saveAccentColor(userId, colorHex) {
    try {
        await set(ref(db, `users/${userId}/settings/accentColor`), colorHex);
        console.log("Accent color saved successfully!");
        return true;
    } catch (error) {
        console.error("Error saving accent color:", error);
        throw error;
    }
}

export async function loadAccentColor(userId) {
    try {
        const snapshot = await get(ref(db, `users/${userId}/settings/accentColor`));
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error("Error loading accent color:", error);
        return null;
    }
}

// ============================================================================
// Transaction Operations
// ============================================================================
export async function saveTransaction(userId, transaction) {
    try {
        const newTransactionRef = push(ref(db, `users/${userId}/transactions`));
        // Simpan transaksi bersama dengan ID uniknya (key) di dalam objek itu sendiri
        await set(newTransactionRef, { ...transaction, id: newTransactionRef.key });
        console.log("Transaction saved successfully!");
        
        // Kembalikan referensi transaksi yang baru dibuat
        return newTransactionRef;

    } catch (error) {
        console.error("Error saving transaction:", error);
        throw error;
    }
}

export function loadTransactions(userId) {
    return new Promise((resolve, reject) => {
        const transactionsRef = ref(db, `users/${userId}/transactions`);
        onValue(transactionsRef, (snapshot) => {
            resolve(snapshot.val() || {});
        }, (error) => {
            console.error("Error loading transactions:", error);
            reject(error);
        });
    });
}

export async function deleteTransaction(userId, transactionId) {
    try {
        await remove(ref(db, `users/${userId}/transactions/${transactionId}`));
        console.log("Transaction deleted successfully!");
    } catch (error) {
        console.error("Error deleting transaction:", error);
        throw error;
    }
}

export async function updateTransaction(userId, transactionId, updates) {
    try {
        await set(ref(db, `users/${userId}/transactions/${transactionId}`), updates);
        console.log("Transaction updated successfully!");
    } catch (error) {
        console.error("Error updating transaction:", error);
        throw error;
    }
}

// ============================================================================
// Account and Wallet Operations
// ============================================================================
export function saveAccount(userId, accountName, accountType) {
    return get(ref(db, `users/${userId}/accounts`)).then((snapshot) => {
        const accounts = snapshot.val() || { income: [], expense: [] };
        if (accounts[accountType].includes(accountName)) {
            throw new Error('Account with this name already exists.');
        }
        accounts[accountType].push(accountName);
        return set(ref(db, `users/${userId}/accounts`), accounts);
    });
}

export function deleteAccount(userId, accountName, accountType) {
    return get(ref(db, `users/${userId}/accounts`)).then((snapshot) => {
        const accounts = snapshot.val() || { income: [], expense: [] };
        accounts[accountType] = accounts[accountType].filter(account => account !== accountName);
        return set(ref(db, `users/${userId}/accounts`), accounts);
    });
}

export function saveWallet(userId, walletName, color, icon) {
    return get(ref(db, `users/${userId}/wallets`)).then((snapshot) => {
        const wallets = snapshot.val() || {};
        if (Object.values(wallets).some(wallet => wallet.name === walletName)) {
            throw new Error('Wallet with this name already exists.');
        }
        const newWalletRef = push(ref(db, `users/${userId}/wallets`));
        return set(newWalletRef, { 
            name: walletName, 
            balance: 0,
            color: color || '#6c5ce7', // Warna default ungu
            icon: icon || 'fa-wallet'  // Ikon default dompet
        });
    });
}

export function deleteWallet(userId, walletId) {
    return remove(ref(db, `users/${userId}/wallets/${walletId}`));
}

// ============================================================================
// Budget Operations
// ============================================================================
export function saveBudget(userId, period, category, limit) {
    console.log(`Saving budget: period=${period}, category=${category}, limit=${limit}`);
    // Format periode: "YYYY-MM" (contoh: "2023-07" untuk Juli 2023)
    const budgetRef = ref(db, `users/${userId}/budgets/${period}/${category}`);
    return set(budgetRef, {
        category: category,
        limit: limit,
        spent: 0,
        period: period
    }).then(() => {
        console.log("Budget saved successfully at path:", `users/${userId}/budgets/${period}/${category}`);
    }).catch(error => {
        console.error("Error saving budget:", error);
        throw error;
    });
}

export function deleteBudget(userId, period, category) {
    console.log(`Deleting budget: period=${period}, category=${category}`);
    const budgetRef = ref(db, `users/${userId}/budgets/${period}/${category}`);
    return remove(budgetRef).then(() => {
        console.log("Budget deleted successfully");
    }).catch(error => {
        console.error("Error deleting budget:", error);
        throw error;
    });
}

export function loadBudgetPeriods(userId) {
    console.log("Loading budget periods for user:", userId);
    return get(ref(db, `users/${userId}/budgets`)).then(snapshot => {
        if (snapshot.exists()) {
            const periods = Object.keys(snapshot.val());
            console.log("Found budget periods:", periods);
            return periods;
        }
        console.log("No budget periods found");
        return [];
    }).catch(error => {
        console.error("Error loading budget periods:", error);
        throw error;
    });
}

// ============================================================================
// Initial Data Setup
// ============================================================================
export async function initializeUserData(userId) {
    const initialData = {
        totalBalance: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        accounts: {
            income: ['Gaji Addo', 'Gaji Anne', 'Bonus Addo', 'Bonus Anne', 'Other Revenue'],
            expense: ['Transfer','Other Will', 'Daycare', 'Ayah', 'Save for Emergency', 'Internet', 'Cell Services', 'Diapers', 'Milk', 'Water & Electrics', 'CC Bill', 'Iuran', 'Gas Ad', 'Gas An', 'Food & Groceries', 'Snack Ad', 'Snack An', 'Homecare', 'Parkir Kantor', 'Personal Care', 'Other Expense', 'Transfer', 'Save', 'Save Aldric', 'Cicilan', 'Pajak Kendaraan', 'Pakaian', 'Laundry', 'Medicine', 'Gas Mobil', 'Hiburan - Wisata Dll']
        },
        wallets: {
            defaultWallet: { 
                name: "Default Wallet", 
                balance: 0,
                color: '#4CAF50', // Warna hijau untuk dompet default
                icon: 'fa-piggy-bank' // Ikon celengan untuk dompet default
            }
        },
        transactions: {},
        budgets: {},
        settings: {
            accentColor: '#4CAF50' // Warna aksen default
        }
    };
    try {
        await set(ref(db, `users/${userId}`), initialData);
        console.log("Initial user data created");
    } catch (error) {
        console.error("Error creating initial data:", error);
        throw error;
    }
}

// ============================================================================
// Debug Helper Functions
// ============================================================================
export async function debugViewUserData(userId) {
    try {
        const userData = await loadUserData(userId);
        console.log("=== USER DATA DEBUG VIEW ===");
        console.log("User ID:", userId);
        console.log("Total Balance:", userData.totalBalance);
        
        console.log("\n=== WALLETS ===");
        const wallets = userData.wallets || {};
        Object.keys(wallets).forEach(walletId => {
            console.log(`Wallet: ${wallets[walletId].name}, Balance: ${wallets[walletId].balance}`);
        });
        
        console.log("\n=== BUDGETS ===");
        const budgets = userData.budgets || {};
        Object.keys(budgets).forEach(period => {
            console.log(`\nPeriod: ${period}`);
            const periodBudgets = budgets[period];
            Object.keys(periodBudgets).forEach(category => {
                const budget = periodBudgets[category];
                console.log(`  Category: ${category}, Limit: ${budget.limit}, Spent: ${budget.spent}`);
            });
        });

        console.log("\n=== SETTINGS ===");
        const settings = userData.settings || {};
        console.log("Accent Color:", settings.accentColor || "Not set");
        
        return userData;
    } catch (error) {
        console.error("Error in debug view:", error);
        return null;
    }
}
