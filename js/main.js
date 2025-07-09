// main.js - Dashboard functionality
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User is logged in:", user.email);
    loadUserData(user.uid);
  } else {
    // Redirect to login if not logged in
    window.location.href = "index.html";
  }
});

// Load user data
function loadUserData(userId) {
  const userRef = ref(db, `users/${userId}`);
  onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      updateDashboard(data);
    } else {
      // First time user - initialize data
      console.log("New user - initializing data");
    }
  });
}

// Update dashboard with user data
function updateDashboard(userData) {
  // Example: Update total balance
  const totalBalanceElement = document.getElementById('totalBalance');
  if (totalBalanceElement && userData.totalBalance) {
    totalBalanceElement.textContent = `$${userData.totalBalance.toFixed(2)}`;
  }
}
// Menandai menu aktif berdasarkan halaman saat ini
function setActiveMenuItem() {
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  const menuItems = document.querySelectorAll('.dropdown-content a');
  
  menuItems.forEach(item => {
    const itemHref = item.getAttribute('href');
    if (itemHref === currentPage) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}
