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
// Transaction Operations
// ============================================================================
export async function saveTransaction(userId, transaction) {
    try {
        const newTransactionRef = push(ref(db, `users/${userId}/transactions`));
        // Simpan transaksi bersama dengan ID uniknya
        await set(newTransactionRef, { ...transaction, id: newTransactionRef.key });
        console.log("Transaction saved successfully!");
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

export function saveWallet(userId, walletName) {
    return get(ref(db, `users/${userId}/wallets`)).then((snapshot) => {
        const wallets = snapshot.val() || {};
        if (Object.values(wallets).some(wallet => wallet.name === walletName)) {
            throw new Error('Wallet with this name already exists.');
        }
        const newWalletRef = push(ref(db, `users/${userId}/wallets`));
        return set(newWalletRef, { name: walletName, balance: 0 });
    });
}

export function deleteWallet(userId, walletId) {
    return remove(ref(db, `users/${userId}/wallets/${walletId}`));
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
            expense: ['Other Will', 'Daycare', 'Ayah', 'Save for Emergency', 'Internet', 'Cell Services', 'Diapers', 'Milk', 'Water & Electrics', 'CC Bill', 'Iuran', 'Gas Ad', 'Gas An', 'Food & Groceries', 'Snack Ad', 'Snack An', 'Homecare', 'Parkir Kantor', 'Personal Care', 'Other Expense', 'Transfer', 'Save', 'Save Aldric', 'Cicilan', 'Pajak Kendaraan', 'Pakaian', 'Laundry', 'Medicine', 'Gas Mobil', 'Hiburan - Wisata Dll']
        },
        wallets: {
            defaultWallet: { name: "Default Wallet", balance: 0 }
        },
        transactions: {}
    };
    try {
        await set(ref(db, `users/${userId}`), initialData);
        console.log("Initial user data created");
    } catch (error) {
        console.error("Error creating initial data:", error);
        throw error;
    }
}
