import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, get, update, remove, push, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ===== User Data Operations =====

export async function saveUserData(userId, data) {
    try {
        await set(ref(db, `users/${userId}`), data);
        console.log("Data saved successfully!");
    } catch (error) {
        console.error("Error saving data:", error);
        throw error;
    }
}

export async function loadUserData(userId) {
    try {
        const snapshot = await get(ref(db, `users/${userId}`));
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error("Error loading data:", error);
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

export async function deleteUserData(userId) {
    try {
        await remove(ref(db, `users/${userId}`));
        console.log("Data deleted successfully!");
    } catch (error) {
        console.error("Error deleting data:", error);
        throw error;
    }
}


// ===== Transaction Operations =====

export async function saveTransaction(userId, transaction) {
    try {
        await push(ref(db, `users/${userId}/transactions`), transaction);
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
            const transactionsData = snapshot.val();
            resolve(transactionsData || {}); // Resolve with empty object if no transactions
        }, (error) => {
            console.error("Error loading transactions:", error);
            reject(error);
        });
    });
}

export async function updateTransaction(userId, transactionId, updates) {
    try {
        await update(ref(db, `users/${userId}/transactions/${transactionId}`), updates);
        console.log("Transaction updated successfully!");
    } catch (error) {
        console.error("Error updating transaction:", error);
        throw error;
    }
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

// ===== Account and Wallet Operations =====

export function getAccounts(userId) {
    return get(ref(db, `users/${userId}/accounts`)).then((snapshot) => {
        return snapshot.val() || { income: [], expense: [] };
    });
}

export function getWallets(userId) {
    return get(ref(db, `users/${userId}/wallets`)).then((snapshot) => {
        return snapshot.val() || {};
    });
}

export function saveAccount(userId, accountName, accountType) {
    return get(ref(db, `users/${userId}/accounts`)).then((snapshot) => {
        const accounts = snapshot.val() || { income: [], expense: [] };
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
    return push(ref(db, `users/${userId}/wallets`)).then(newWalletRef => {
        return set(newWalletRef, { name: walletName, balance: 0 });
    });
}

export function deleteWallet(userId, walletId) {
    return remove(ref(db, `users/${userId}/wallets/${walletId}`));
}

// ===== Initial Data =====

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
            default: {
                name: "Default Wallet",
                balance: 0
            }
        },
        transactions: {} // Add empty transactions object
    };

    try {
        await set(ref(db, `users/${userId}`), initialData);
        console.log("Initial user data created");
    } catch (error) {
        console.error("Error creating initial data:", error);
        throw error;
    }
}
