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
    totalBalanceElement.textContent = `Rp${userData.totalBalance.toFixed(2)}`;
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
// Panggil fungsi saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
  setActiveMenuItem();
});
// Tambahkan fungsi ini di main.js
function loadRecentTransactions(userId) {
  const transactionsRef = ref(db, `users/${userId}/transactions`);
  onValue(transactionsRef, (snapshot) => {
    const transactionsData = snapshot.val();
    if (transactionsData) {
      // Convert to array and sort by date (newest first)
      const transactionsArray = Object.values(transactionsData);
      transactionsArray.sort((a, b) => b.timestamp - a.timestamp);
      
      // Take only the 5 most recent transactions
      const recentTransactions = transactionsArray.slice(0, 5);
      
      // Display in the UI
      displayRecentTransactions(recentTransactions);
    } else {
      // No transactions yet
      document.getElementById('recentTransactions').innerHTML = 
        '<p class="empty-state">No recent transactions</p>';
    }
  });
}

function displayRecentTransactions(transactions) {
  const container = document.getElementById('recentTransactions');
  if (!container) return;
  
  if (transactions.length === 0) {
    container.innerHTML = '<p class="empty-state">No recent transactions</p>';
    return;
  }
  
  let html = '';
  transactions.forEach(transaction => {
    const isIncome = transaction.type === 'income';
    const iconClass = isIncome ? 'income' : 'expense';
    const amountClass = isIncome ? 'amount-income' : 'amount-expense';
    const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
    const sign = isIncome ? '+' : '-';
    
    const date = new Date(transaction.timestamp);
    const formattedDate = date.toLocaleDateString();
    
    html += `
      <div class="transaction-item">
        <div class="transaction-details">
          <div class="transaction-icon ${iconClass}">
            <i class="fas ${icon}"></i>
          </div>
          <div class="transaction-info">
            <h4>${transaction.description || 'Transaction'}</h4>
            <p>${formattedDate}</p>
          </div>
        </div>
        <div class="transaction-amount ${amountClass}">
          ${sign}$${Math.abs(transaction.amount).toFixed(2)}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Modify loadUserData to also load transactions
function loadUserData(userId) {
  const userRef = ref(db, `users/${userId}`);
  onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      updateDashboard(data);
    } else {
      // First time user - initialize data
      console.log("New user - initializing data");
      initializeUserData(userId);
    }
  });
  
  // Load transactions separately
  loadRecentTransactions(userId);
}

// Initialize data for new users
function initializeUserData(userId) {
  const initialData = {
    totalBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    wallets: {
      default: {
        name: "Default Wallet",
        balance: 0
      }
    }
  };
  
  set(ref(db, `users/${userId}`), initialData)
    .then(() => {
      console.log("Initial user data created");
    })
    .catch(error => {
      console.error("Error creating initial data:", error);
    });
}
