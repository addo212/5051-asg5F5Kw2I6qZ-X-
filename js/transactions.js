import firebaseConfig from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { updateUserData } from './database.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
let userId;

// Autentikasi
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        loadAccounts();
        loadWallets();
        loadTransactions();
    } else {
        window.location.href = "index.html";
    }
});

// Fungsi untuk memuat akun
function loadAccounts() {
    const accountsSelect = document.getElementById('account');
    // Ganti dengan data akun dari database atau sumber lainnya
    const accounts = {
        income: ['Gaji Addo', 'Gaji Anne', 'Bonus Addo', 'Bonus Anne', 'Other Revenue'],
        expense: ['Other Will', 'Daycare', 'Ayah', 'Save for Emergency', 'Internet', 'Cell Services', 'Diapers', 'Milk', 'Water & Electrics', 'CC Bill', 'Iuran', 'Gas Ad', 'Gas An', 'Food & Groceries', 'Snack Ad', 'Snack An', 'Homecare', 'Parkir Kantor', 'Personal Care', 'Other Expense', 'Transfer', 'Save', 'Save Aldric', 'Cicilan', 'Pajak Kendaraan', 'Pakaian', 'Laundry', 'Medicine', 'Gas Mobil', 'Hiburan - Wisata Dll']
    };

    accountsSelect.innerHTML = '<option value="">Select Account</option>';
    const selectedType = document.getElementById('type').value || 'income';
    accounts[selectedType].forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        accountsSelect.appendChild(option);
    });

    document.getElementById('type').addEventListener('change', () => {
        loadAccounts();
    });
}

// Fungsi untuk memuat dompet
function loadWallets() {
    const walletsSelect = document.getElementById('wallet');
    // Ganti dengan data dompet dari database atau sumber lainnya
    const wallets = ['Aldric', 'Kas Ado', 'Kas Ane', 'BCA', 'Livin Mandiri', 'Bank Jatim', 'Seabank', 'Jago', 'Celengan', 'Saving', 'KSI', 'Blu', 'KUR', 'other'];

    walletsSelect.innerHTML = '<option value="">Select Wallet</option>';
    wallets.forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet;
        option.text = wallet;
        walletsSelect.appendChild(option);
    });
}

// Fungsi untuk menyimpan transaksi
async function saveTransaction(transaction) {
    try {
        await push(ref(db, `users/${userId}/transactions`), transaction);
        // Bersihkan form setelah menyimpan transaksi
        document.getElementById('transactionForm').reset();
        // Update saldo dan data lain di database
        updateUserData(userId, { totalBalance: 0 }); // Contoh: Update total balance
        loadTransactions();
        // Tampilkan pesan sukses
        showSuccessMessage('Transaction saved successfully!');
    } catch (error) {
        console.error("Error saving transaction:", error);
        showError('Failed to save transaction. Please try again.');
    }
}

// Fungsi untuk memuat transaksi
function loadTransactions() {
    const transactionsRef = ref(db, `users/${userId}/transactions`);
    onValue(transactionsRef, (snapshot) => {
        const transactionsData = snapshot.val();
        displayTransactions(transactionsData);
    });
}

// Fungsi untuk menampilkan transaksi
function displayTransactions(transactionsData) {
    const container = document.getElementById('transactionHistory');
    if (!container) return;

    if (!transactionsData || Object.keys(transactionsData).length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions yet.</p>';
        return;
    }

    let html = '<ul>';
    for (const transactionId in transactionsData) {
        const transaction = transactionsData[transactionId];
        const isIncome = transaction.type === 'income';
        const amountClass = isIncome ? 'amount-income' : 'amount-expense';
        const sign = isIncome ? '+' : '-';
        const date = new Date(transaction.timestamp);
        const formattedDate = date.toLocaleDateString();

        html += `
            <li class="transaction-item">
                <div class="transaction-details">
                    <div class="transaction-info">
                        <h4>${transaction.description || 'Transaction'}</h4>
                        <p>${formattedDate} - ${transaction.account} - ${transaction.wallet}</p>
                    </div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${sign}$${Math.abs(transaction.amount).toFixed(2)}
                </div>
                <button class="delete-btn" data-transaction-id="${transactionId}"><i class="fas fa-trash"></i></button>
            </li>
        `;
    }
    html += '</ul>';
    container.innerHTML = html;

    // Tambahkan event listener untuk tombol hapus
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const transactionId = button.dataset.transactionId;
            deleteTransaction(transactionId);
        });
    });
}

// Fungsi untuk menghapus transaksi
async function deleteTransaction(transactionId) {
    try {
        await remove(ref(db, `users/${userId}/transactions/${transactionId}`));
        loadTransactions(); // Muat ulang transaksi setelah dihapus
        showSuccessMessage('Transaction deleted successfully!');
    } catch (error) {
        console.error("Error deleting transaction:", error);
        showError('Failed to delete transaction. Please try again.');
    }
}

// Fungsi untuk menampilkan pesan sukses
function showSuccessMessage(message) {
    const successMessage = document.createElement('p');
    successMessage.textContent = message;
    successMessage.classList.add('success-message');
    document.body.appendChild(successMessage);

    setTimeout(() => {
        successMessage.remove();
    }, 3000);
}

// Fungsi untuk menampilkan pesan error
function showError(message) {
    const errorElement = document.getElementById('formError');
    errorElement.textContent = message;
    errorElement.style.display = 'block';

    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 3000);
}

// Event listener untuk form transaksi
document.getElementById('transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const date = document.getElementById('date').value;
    const type = document.getElementById('type').value;
    const account = document.getElementById('account').value;
    const description = document.getElementById('description').value;
    const wallet = document.getElementById('wallet').value;
    const amount = parseFloat(document.getElementById('amount').value);

    if (isNaN(amount) || amount <= 0) {
        showError('Please enter a valid amount');
        return;
    }

    const transaction = {
        date,
        type,
        account,
        description,
        wallet,
        amount,
        timestamp: new Date(date).getTime() // Simpan timestamp untuk pengurutan
    };

    await saveTransaction(transaction);
});
