import { getDatabase, ref, set, get, update, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { auth } from "./firebase-config.js"; // Optional: Link to auth if needed

const db = getDatabase();

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
  await update(ref(db, `users/${userId}`), updates);
}

export async function deleteUserData(userId) {
  await remove(ref(db, `users/${userId}`));
}

// Optional: Auto-bind to authenticated user
export async function saveDataForCurrentUser(data) {
  if (!auth.currentUser) throw new Error("User not logged in");
  await saveUserData(auth.currentUser.uid, data);
}
