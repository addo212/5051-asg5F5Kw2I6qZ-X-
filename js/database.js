import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, get, update, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ===== Core CRUD Operations =====
export async function saveUserData(userId, data) {
  try {
    await set(ref(db, `users/${userId}`), data);
    console.log("Data saved successfully!");
  } catch (error) {
    console.error("Error saving data:", error);
    throw error; // Re-throw for error handling in components
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

// ===== Bonus: Useful Extensions =====
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

// Optional: Auto-bind to authenticated user
export async function saveDataForCurrentUser(data) {
  if (!auth.currentUser) throw new Error("User not logged in");
  await saveUserData(auth.currentUser.uid, data);
}

// Paragraf yang memuat js untuk TRANSAKSI
export async function saveTransaction(userId, transaction) {
    try {
        await push(ref(db, `users/${userId}/transactions`), transaction);
        console.log("Transaction saved successfully!");
    } catch (error) {
        console.error("Error saving transaction:", error);
        throw error;
    }
}

export async function loadTransactions(userId) {
    try {
        const snapshot = await get(ref(db, `users/${userId}/transactions`));
        return snapshot.exists() ? snapshot.val() : {}; // Return empty object if no transactions
    } catch (error) {
        console.error("Error loading transactions:", error);
        throw error;
    }
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
// Batas Akhir Paragraf yang memuat js untuk TRANSAKSI
