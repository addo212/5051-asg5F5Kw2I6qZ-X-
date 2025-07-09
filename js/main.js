// main.js - Dashboard functionality
import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { initializeUserData, loadUserData } from './database.js'; // Impor fungsi dari database.js

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User is logged in:", user.email);
        loadUserData(user.uid).then((userData) => {
            if (!userData) {
                initializeUserData(user.uid);
            } else {
                updateDashboard(userData);
            }
        });
    } else {
        // Redirect to login if not logged in
        window.location.href = "index.html";
    }
});

// Update dashboard with user data
function updateDashboard(userData) {
    const currency = localStorage.getItem('currency') || 'USD'; // Ambil mata uang dari localStorage
    const currencySymbol = getCurrencySymbol(currency); // Fungsi untuk mendapatkan simbol mata uang

    const totalBalanceElement = document.getElementById('totalBalance');
    if (totalBalanceElement && userData.totalBalance) {
        totalBalanceElement.textContent = `${currencySymbol}${userData.totalBalance.toFixed(2)}`;
    }

    const monthlyIncomeElement = document.getElementById('monthlyIncome');
    if (monthlyIncomeElement && userData.monthlyIncome) {
        monthlyIncomeElement.textContent = `${currencySymbol}${userData.monthlyIncome.toFixed(2)}`;
    }

    const monthlyExpensesElement = document.getElementById('monthlyExpenses');
    if (monthlyExpensesElement && userData.monthlyExpenses) {
        monthlyExpensesElement.textContent = `${currencySymbol}${userData.monthlyExpenses.toFixed(2)}`;
    }
}

function getCurrencySymbol(currency) {
    switch (currency) {
        case 'USD': return '$';
        case 'IDR': return 'Rp';
        case 'EUR': return '€';
        case 'GBP': return '£';
        default: return '$';
    }
}


// Menandai menu aktif berdasarkan halaman saat ini
function setActiveMenuItem() {
    // ... (kode tetap sama)
}

// Panggil fungsi saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    setActiveMenuItem();
});
