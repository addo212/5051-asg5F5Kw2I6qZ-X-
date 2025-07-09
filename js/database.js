import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

const db = getDatabase();

// Example function to save data
export function saveUserData(userId, data) {
  set(ref(db, 'users/' + userId), data);
}

// Example function to load data
export function loadUserData(userId) {
  return get(ref(db, 'users/' + userId));
}
