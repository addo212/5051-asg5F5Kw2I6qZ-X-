// wallets.js

// ============================================================================
// Module Imports
// ============================================================================
// Impor fungsi dan instance yang dibutuhkan dari file database.js terpusat
import { auth, db, loadUserData } from './database.js';
// Impor fungsi spesifik dari Firebase SDK
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// ============================================================================
// Global Variables
// ============================================================================
let userId;
let userWallets = {}; // Variabel untuk menyimpan data dompet pengguna secara lokal

// ============================================================================
// Authentication State Listener (Titik Awal Eksekusi)
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        // Memulai proses memuat data dompet setelah pengguna terautentikasi
        initializeWalletPage(); 
    } else {
        // Jika tidak ada pengguna, arahkan kembali ke halaman login
        window.location.href = "index.html";
    }
});

// ============================================================================
// Main Initialization Function for the Wallet Page
// ============================================================================
async function initializeWalletPage() {
    try {
        const userData = await loadUserData(userId);
        
        if (!userData) {
            console.error("User data not found!");
            document.getElementById('walletsList').innerHTML = '<p class="empty-state error-message">Could not load user data.</p>';
            return;
        }

        userWallets = userData.wallets || {};

        // Memuat dan menampilkan daftar dompet
        displayWallets();
        // Memuat opsi untuk form transfer
        loadTransferFormOptions(); 

    } catch (error) {
        console.error("Error initializing wallet page:", error);
        document.getElementById('walletsList').innerHTML = '<p class="empty-state error-message">Failed to initialize page.</p>';
    }
}

// ============================================================================
// Function to Display Wallets on the Page
// ============================================================================
function displayWallets() {
    const walletsListElement = document.getElementById('walletsList');
    if (!walletsListElement) return;

    // Definisikan palet warna dan ikon kita
    const palette = [
        { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: 'fa-credit-card' },
        { gradient: 'linear-gradient(135deg, #2af598 0%, #009efd 100%)', icon: 'fa-piggy-bank' },
        { gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)', icon: 'fa-university' },
        { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: 'fa-briefcase' },
        { gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: 'fa-leaf' },
        { gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', icon: 'fa-heart' },
        { gradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)', icon: 'fa-seedling' }
    ];

    const walletIds = Object.keys(userWallets);

    if (walletIds.length === 0) {
        walletsListElement.innerHTML = '<p class="empty-state">No wallets found. Add one in Settings.</p>';
        return;
    }

    let html = '<ul class="wallet-list-container">'; 
    
    walletIds.forEach((walletId, index) => {
        const wallet = userWallets[walletId];
        const currency = localStorage.getItem('currency') || 'USD';
        const currencySymbol = getCurrencySymbol(currency);
        
        // Mengambil gaya dari palet secara bergiliran
        const styleIndex = index % palette.length;
        const currentStyle = palette[styleIndex];

        // Struktur HTML baru dengan inline style untuk background dan class untuk ikon
        html += `
            <li class="wallet-item" style="background: ${currentStyle.gradient};">
                <div class="wallet-info">
                    <i class="fas ${currentStyle.icon} wallet-icon"></i>
                    <h3>${wallet.name}</h3>
                </div>
                <p class="wallet-balance">${currencySymbol}${wallet.balance.toFixed(2)}</p>
            </li>
        `;
    });

    html += '</ul>';
    walletsListElement.innerHTML = html;
}

// ============================================================================
// Function to Load Wallet Options for the Transfer Form
// ============================================================================
function loadTransferFormOptions() {
    const fromWalletSelect = document.getElementById('fromWallet');
    const toWalletSelect = document.getElementById('toWallet');

    fromWalletSelect.innerHTML = '<option value="">Select From Wallet</option>';
    toWalletSelect.innerHTML = '<option value="">Select To Wallet</option>';

    for (const walletId in userWallets) {
        const wallet = userWallets[walletId];
        const currencySymbol = getCurrencySymbol(localStorage.getItem('currency') || 'USD');

        // Opsi untuk dropdown "From", menampilkan saldo
        const fromOption = document.createElement('option');
        fromOption.value = walletId;
        fromOption.text = `${wallet.name} (${currencySymbol}${wallet.balance.toFixed(2)})`;
        fromWalletSelect.appendChild(fromOption);

        // Opsi untuk dropdown "To"
        const toOption = document.createElement('option');
        toOption.value = walletId;
        toOption.text = wallet.name;
        toWalletSelect.appendChild(toOption);
    }
}

// ============================================================================
// Function to Handle the Balance Transfer Logic
// ============================================================================
async function handleBalanceTransfer(fromWalletId, toWalletId, amount) {
    try {
        const fromWallet = userWallets[fromWalletId];
        const toWallet = userWallets[toWalletId];

        if (!fromWallet || !toWallet) {
            throw new Error("Invalid wallet selected. Please try again.");
        }
        if (fromWallet.balance < amount) {
            throw new Error("Insufficient balance in the source wallet.");
        }

        const newFromBalance = fromWallet.balance - amount;
        const newToBalance = toWallet.balance + amount;

        // Membuat satu objek update untuk memastikan operasi atomik (semua berhasil atau semua gagal)
        const updates = {};
        updates[`/users/${userId}/wallets/${fromWalletId}/balance`] = newFromBalance;
        updates[`/users/${userId}/wallets/${toWalletId}/balance`] = newToBalance;

        // Menjalankan update ke database
        await update(ref(db), updates);

        // Update data lokal untuk pembaruan UI instan
        userWallets[fromWalletId].balance = newFromBalance;
        userWallets[toWalletId].balance = newToBalance;
        
        // Tampilkan ulang data yang sudah diperbarui
        displayWallets();
        loadTransferFormOptions(); // Perbarui saldo di dropdown juga

        showSuccessMessage('Transfer successful!');

    } catch (error) {
        console.error("Error transferring balance:", error);
        showError(error.message);
    }
}

// ============================================================================
// UI Helper Functions
// ============================================================================
function getCurrencySymbol(currency) {
    switch (currency) {
        case 'USD': return '$';
        case 'IDR': return 'Rp';
        case 'EUR': return '€';
        case 'GBP': return '£';
        default: return '$';
    }
}

function showSuccessMessage(message) {
    // Untuk sementara menggunakan alert, bisa diganti dengan notifikasi yang lebih baik
    alert(message);
}

function showError(message) {
    const errorElement = document.getElementById('transferError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 3000);
    }
}

// ============================================================================
// Event Listener for the Transfer Form
// ============================================================================
document.getElementById('transferForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fromWalletId = document.getElementById('fromWallet').value;
    const toWalletId = document.getElementById('toWallet').value;
    const amount = parseFloat(document.getElementById('amount').value);

    // Validasi input
    if (!fromWalletId || !toWalletId) {
        showError('Please select both "From" and "To" wallets.');
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        showError('Please enter a valid positive amount.');
        return;
    }
    if (fromWalletId === toWalletId) {
        showError('Cannot transfer to the same wallet.');
        return;
    }

    // Panggil fungsi logika transfer
    await handleBalanceTransfer(fromWalletId, toWalletId, amount);
    
    // Reset form setelah transfer
    e.target.reset();
    // Muat ulang opsi dropdown untuk menampilkan saldo terbaru
    loadTransferFormOptions();
});
