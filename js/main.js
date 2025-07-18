// main.js

// ============================================================================
// Module Imports
// ============================================================================
import { auth, loadUserData, loadTransactions } from './database.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { formatRupiah } from './utils.js';

// ============================================================================
// Global Variables
// ============================================================================
let userId;
// Variabel global untuk melacak mode tampilan budget
let budgetViewMode = 'percentage'; // 'percentage' atau 'amount'

// ============================================================================
// Main Initialization on Auth State Change
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeDashboard();
        setupEventListeners();
    } else {
        window.location.href = "index.html";
    }
});

// ============================================================================
// Event Listeners
// ============================================================================
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to logout?')) {
                try {
                    await signOut(auth);
                    console.log('User signed out successfully.');
                } catch (error) {
                    console.error('Error signing out:', error);
                    alert('Failed to sign out. Please try again.');
                }
            }
        });
    }

    // Quick action buttons
    document.getElementById('quickAddIncome')?.addEventListener('click', () => {
        window.location.href = 'transactions.html?type=income';
    });

    document.getElementById('quickAddExpense')?.addEventListener('click', () => {
        window.location.href = 'transactions.html?type=expense';
    });

    document.getElementById('quickTransfer')?.addEventListener('click', () => {
        window.location.href = 'wallets.html?action=transfer';
    });

    document.getElementById('quickBudget')?.addEventListener('click', () => {
        window.location.href = 'budgets.html';
    });
    
    // Fungsi setupBudgetViewToggle() akan dipanggil di akhir initializeDashboard()
}

// Fungsi untuk mengatur toggle view budget (diperbaiki)
function setupBudgetViewToggle() {
    const percentageBtn = document.getElementById('viewByPercentage');
    const amountBtn = document.getElementById('viewByAmount');
    
    console.log("Setting up budget view toggle buttons:", { 
        percentageBtn: !!percentageBtn, 
        amountBtn: !!amountBtn 
    });
    
    if (percentageBtn && amountBtn) {
        percentageBtn.addEventListener('click', function() {
            console.log("Percentage button clicked");
            if (budgetViewMode !== 'percentage') {
                budgetViewMode = 'percentage';
                percentageBtn.classList.add('active');
                amountBtn.classList.remove('active');
                
                // Langsung perbarui tampilan budget dengan menghitung ulang nilai spent
                Promise.all([
                    loadUserData(userId),
                    loadTransactions(userId)
                ]).then(([userData, transactionsData]) => {
                    if (userData && userData.budgets) {
                        calculateBudgetSpending(userData.budgets, transactionsData)
                            .then(updatedBudgets => {
                                displayTopBudgets(updatedBudgets);
                            });
                    }
                }).catch(err => {
                    console.error("Error reloading budget data:", err);
                });
            }
        });
        
        amountBtn.addEventListener('click', function() {
            console.log("Amount button clicked");
            if (budgetViewMode !== 'amount') {
                budgetViewMode = 'amount';
                amountBtn.classList.add('active');
                percentageBtn.classList.remove('active');
                
                // Langsung perbarui tampilan budget dengan menghitung ulang nilai spent
                Promise.all([
                    loadUserData(userId),
                    loadTransactions(userId)
                ]).then(([userData, transactionsData]) => {
                    if (userData && userData.budgets) {
                        calculateBudgetSpending(userData.budgets, transactionsData)
                            .then(updatedBudgets => {
                                displayTopBudgets(updatedBudgets);
                            });
                    }
                }).catch(err => {
                    console.error("Error reloading budget data:", err);
                });
            }
        });
        
        console.log("Budget view toggle buttons set up successfully");
    } else {
        console.error("Budget view toggle buttons not found in DOM");
    }
}

// ============================================================================
// Core Dashboard Logic
// ============================================================================
async function initializeDashboard() {
    try {
        console.log("Initializing dashboard...");
        
        // Tampilkan loading state
        document.getElementById('recentTransactionsList').innerHTML = '<p class="empty-state">Loading recent transactions...</p>';
        
        // Memuat data pengguna dan transaksi secara bersamaan
        const [userData, transactionsData] = await Promise.all([
            loadUserData(userId),
            loadTransactions(userId)
        ]);

        console.log("Data loaded:", { 
            userData: !!userData, 
            transactionsData: !!transactionsData,
            transactionsCount: transactionsData ? Object.keys(transactionsData).length : 0
        });

        if (!userData) {
            console.error("User data not found!");
            return;
        }

        // Hitung ringkasan bulanan dari semua transaksi
        const monthlySummary = calculateMonthlySummary(transactionsData);
        
        // Hitung perbandingan dengan bulan sebelumnya
        const monthlyComparison = calculateMonthlyComparison(transactionsData);

        // Perbarui kartu ringkasan di UI dengan data perbandingan
        updateDashboardCards(
            userData.totalBalance, 
            monthlySummary.monthlyIncome, 
            monthlySummary.monthlyExpenses,
            monthlyComparison
        );

        // Tampilkan transaksi terbaru di UI
        displayRecentTransactions(transactionsData);

        // Tampilkan tren mingguan
        displayWeeklyTrends(transactionsData);

        // Tampilkan dompet teratas
        displayTopWallets(userData.wallets || {});

        // PENTING: Hitung ulang nilai spent untuk setiap budget berdasarkan transaksi
        const updatedBudgets = await calculateBudgetSpending(userData.budgets || {}, transactionsData);
        
        // Tampilkan anggaran teratas dengan data yang sudah diperbarui
        displayTopBudgets(updatedBudgets);

        // Tampilkan tip keuangan harian
        showDailyTip();
        
        // PENTING: Setup event listeners untuk toggle budget view SETELAH semua data dimuat
        setupBudgetViewToggle();

    } catch (error) {
        console.error("Error initializing dashboard:", error);
        document.getElementById('recentTransactionsList').innerHTML = 
            '<p class="empty-state">Error loading transactions. Please try refreshing the page.</p>';
    }
}

// ============================================================================
// Data Processing Functions
// ============================================================================
// Fungsi untuk menghitung perbandingan bulan ini dengan bulan sebelumnya
function calculateMonthlyComparison(transactions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Hitung bulan dan tahun sebelumnya
    let previousMonth = currentMonth - 1;
    let previousYear = currentYear;
    if (previousMonth < 0) {
        previousMonth = 11; // Desember
        previousYear = currentYear - 1;
    }
    
    // Inisialisasi data
    let currentMonthIncome = 0;
    let currentMonthExpense = 0;
    let previousMonthIncome = 0;
    let previousMonthExpense = 0;
    
    if (!transactions) {
        return {
            incomeChange: 0,
            expenseChange: 0,
            balanceChange: 0
        };
    }
    
    // Konversi objek transaksi menjadi array
    const transactionsArray = typeof transactions === 'object' && !Array.isArray(transactions) 
        ? Object.values(transactions) 
        : transactions;
    
    // Proses setiap transaksi
    transactionsArray.forEach(tx => {
        if (!tx || !tx.timestamp) return;
        
        const txDate = new Date(tx.timestamp);
        const txMonth = txDate.getMonth();
        const txYear = txDate.getFullYear();
        
        // Transaksi bulan ini
        if (txMonth === currentMonth && txYear === currentYear) {
            if (tx.type === 'income') {
                currentMonthIncome += tx.amount;
            } else if (tx.type === 'expense') {
                currentMonthExpense += tx.amount;
            }
        }
        // Transaksi bulan sebelumnya
        else if (txMonth === previousMonth && txYear === previousYear) {
            if (tx.type === 'income') {
                previousMonthIncome += tx.amount;
            } else if (tx.type === 'expense') {
                previousMonthExpense += tx.amount;
            }
        }
    });
    
    // Hitung perubahan persentase
    const currentBalance = currentMonthIncome - currentMonthExpense;
    const previousBalance = previousMonthIncome - previousMonthExpense;
    
    // Hitung persentase perubahan
    let incomeChange = 0;
    let expenseChange = 0;
    let balanceChange = 0;
    
    if (previousMonthIncome > 0) {
        incomeChange = ((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100;
    } else if (currentMonthIncome > 0) {
        incomeChange = 100; // Jika bulan lalu 0, dan bulan ini ada, maka naik 100%
    }
    
    if (previousMonthExpense > 0) {
        expenseChange = ((currentMonthExpense - previousMonthExpense) / previousMonthExpense) * 100;
    } else if (currentMonthExpense > 0) {
        expenseChange = 100; // Jika bulan lalu 0, dan bulan ini ada, maka naik 100%
    }
    
    if (previousBalance !== 0) {
        balanceChange = ((currentBalance - previousBalance) / Math.abs(previousBalance)) * 100;
    } else if (currentBalance !== 0) {
        balanceChange = currentBalance > 0 ? 100 : -100;
    }
    
    return {
        incomeChange,
        expenseChange,
        balanceChange
    };
}

// Fungsi untuk menghitung ulang nilai spent untuk setiap budget berdasarkan transaksi
async function calculateBudgetSpending(budgets, transactions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    
    // Jika tidak ada budget untuk bulan ini, return saja
    if (!budgets || !budgets[currentPeriod]) {
        return budgets;
    }
    
    // Buat salinan budget untuk bulan ini
    const currentBudgets = JSON.parse(JSON.stringify(budgets[currentPeriod]));
    
    // Reset nilai spent untuk semua budget
    Object.keys(currentBudgets).forEach(category => {
        currentBudgets[category].spent = 0;
    });
    
    // Jika tidak ada transaksi, return budget dengan spent = 0
    if (!transactions) {
        budgets[currentPeriod] = currentBudgets;
        return budgets;
    }
    
    // Konversi transaksi menjadi array jika perlu
    const transactionsArray = typeof transactions === 'object' && !Array.isArray(transactions) 
        ? Object.values(transactions) 
        : transactions;
    
    // Hitung spent untuk setiap budget berdasarkan transaksi bulan ini
    transactionsArray.forEach(tx => {
        if (!tx || !tx.timestamp || tx.type !== 'expense') return;
        
        const txDate = new Date(tx.timestamp);
        
        // Hanya proses transaksi dari bulan dan tahun saat ini
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
            // Gunakan account sebagai kategori budget
            const category = tx.account;
            
            // Jika kategori ada di budget, tambahkan amount ke spent
            if (category && currentBudgets[category]) {
                currentBudgets[category].spent = (currentBudgets[category].spent || 0) + tx.amount;
            }
        }
    });
    
    // Update budget untuk bulan ini dengan nilai spent yang baru
    budgets[currentPeriod] = currentBudgets;
    
    return budgets;
}

function calculateMonthlySummary(transactions) {
    let monthlyIncome = 0;
    let monthlyExpenses = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (!transactions) {
        return { monthlyIncome, monthlyExpenses };
    }

    // Konversi objek transaksi menjadi array
    const transactionsArray = typeof transactions === 'object' && !Array.isArray(transactions) 
        ? Object.values(transactions) 
        : transactions;

    transactionsArray.forEach(tx => {
        if (!tx || !tx.timestamp) return;
        
        const txDate = new Date(tx.timestamp);
        
        // Hanya proses transaksi dari bulan dan tahun saat ini
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
            if (tx.type === 'income') {
                monthlyIncome += tx.amount;
            } else if (tx.type === 'expense') {
                monthlyExpenses += tx.amount;
            }
        }
    });

    return { monthlyIncome, monthlyExpenses };
}

function getWeeklyData(transactions) {
    // Get dates for the last 7 days
    const dates = [];
    const incomeData = [];
    const expenseData = [];
    
    // Initialize with zeros
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        incomeData.push(0);
        expenseData.push(0);
    }
    
    if (!transactions) return { labels: dates, income: incomeData, expense: expenseData, totalIncome: 0, totalExpense: 0 };
    
    // Convert transactions object to array if needed
    const transactionsArray = typeof transactions === 'object' && !Array.isArray(transactions) 
        ? Object.values(transactions) 
        : transactions;
    
    // Process transactions
    transactionsArray.forEach(tx => {
        if (!tx || !tx.timestamp) return;
        
        const txDate = new Date(tx.timestamp);
        const today = new Date();
        const diffTime = today - txDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < 7) {
            const index = 6 - diffDays;
            if (tx.type === 'income') {
                incomeData[index] += tx.amount;
            } else if (tx.type === 'expense') {
                expenseData[index] += tx.amount;
            }
        }
    });
    
    // Calculate totals
    const totalIncome = incomeData.reduce((sum, val) => sum + val, 0);
    const totalExpense = expenseData.reduce((sum, val) => sum + val, 0);
    
    return {
        labels: dates,
        income: incomeData,
        expense: expenseData,
        totalIncome,
        totalExpense
    };
}

// ============================================================================
// UI Update Functions
// ============================================================================
function updateDashboardCards(totalBalance, monthlyIncome, monthlyExpenses, comparison = { balanceChange: 0, incomeChange: 0, expenseChange: 0 }) {
    const totalBalanceElement = document.getElementById('totalBalance');
    const monthlyIncomeElement = document.getElementById('monthlyIncome');
    const monthlyExpensesElement = document.getElementById('monthlyExpenses');

    if (totalBalanceElement) {
        totalBalanceElement.textContent = formatRupiah(totalBalance || 0);
    }
    if (monthlyIncomeElement) {
        monthlyIncomeElement.textContent = formatRupiah(monthlyIncome || 0);
    }
    if (monthlyExpensesElement) {
        monthlyExpensesElement.textContent = formatRupiah(monthlyExpenses || 0);
    }
    
    // Update trends dengan data perbandingan yang sebenarnya
    updateTrendIndicator(document.getElementById('balanceTrend'), comparison.balanceChange);
    updateTrendIndicator(document.getElementById('incomeTrend'), comparison.incomeChange);
    updateTrendIndicator(document.getElementById('expenseTrend'), comparison.expenseChange);
}

function updateTrendIndicator(element, percentage) {
    if (!element) return;
    
    const isPositive = percentage > 0;
    const isNeutral = percentage === 0;
    
    // Remove all classes first
    element.classList.remove('positive', 'negative', 'neutral');
    
    // Add appropriate class
    if (isPositive) {
        element.classList.add('positive');
        element.innerHTML = `<i class="fas fa-arrow-up"></i> ${Math.abs(percentage).toFixed(1)}%`;
    } else if (isNeutral) {
        element.classList.add('neutral');
        element.innerHTML = `<i class="fas fa-minus"></i> ${Math.abs(percentage).toFixed(1)}%`;
    } else {
        element.classList.add('negative');
        element.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(percentage).toFixed(1)}%`;
    }
}

function displayRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactionsList');
    if (!container) {
        console.error("Recent transactions container not found!");
        return;
    }

    console.log("Displaying recent transactions...");

    if (!transactions || Object.keys(transactions).length === 0) {
        container.innerHTML = '<p class="empty-state">No recent transactions found.</p>';
        return;
    }

    // Konversi objek transaksi menjadi array dengan ID
    let transactionsArray = [];
    
    if (Array.isArray(transactions)) {
        transactionsArray = transactions;
    } else {
        // Konversi dari objek ke array dengan ID
        transactionsArray = Object.entries(transactions).map(([id, tx]) => ({
            id,
            ...tx
        }));
    }
    
    console.log(`Found ${transactionsArray.length} transactions total`);

    // Filter transaksi yang valid (memiliki timestamp dan type)
    const validTransactions = transactionsArray.filter(tx => 
        tx && tx.timestamp && tx.type && (tx.type === 'income' || tx.type === 'expense')
    );
    
    console.log(`Found ${validTransactions.length} valid transactions`);

    // Pastikan timestamp adalah angka untuk pengurutan yang benar
    validTransactions.forEach(tx => {
        if (typeof tx.timestamp === 'string') {
            tx.timestamp = parseInt(tx.timestamp);
        }
    });

    // SOLUSI: Urutkan berdasarkan kombinasi timestamp dan ID untuk memastikan urutan yang konsisten
    // Ini akan memastikan bahwa jika ada beberapa transaksi dengan timestamp yang sama,
    // mereka akan diurutkan berdasarkan ID (yang biasanya berisi timestamp pembuatan)
    validTransactions.sort((a, b) => {
        // Jika timestamp berbeda, urutkan berdasarkan timestamp
        if (b.timestamp !== a.timestamp) {
            return b.timestamp - a.timestamp;
        }
        // Jika timestamp sama, urutkan berdasarkan ID (yang mungkin berisi timestamp pembuatan)
        return b.id.localeCompare(a.id);
    });
    
    // Tambahkan log untuk debugging
    console.log("Sorted transactions (first 5):", validTransactions.slice(0, 5).map(tx => ({
        id: tx.id,
        date: new Date(tx.timestamp).toLocaleDateString(),
        description: tx.description
    })));
    
    // Ambil 5 transaksi teratas
    const recentTransactions = validTransactions.slice(0, 5);
    
    console.log(`Displaying ${recentTransactions.length} recent transactions`);

    if (recentTransactions.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent transactions found.</p>';
        return;
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let html = '';
    recentTransactions.forEach(transaction => {
        const isIncome = transaction.type === 'income';
        const iconClass = isIncome ? 'income' : 'expense';
        const amountClass = isIncome ? 'amount-income' : 'amount-expense';
        const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
        const sign = isIncome ? '+' : '-';
        
        // Pastikan timestamp adalah angka
        const timestamp = typeof transaction.timestamp === 'number' 
            ? transaction.timestamp 
            : parseInt(transaction.timestamp);
            
        const date = new Date(timestamp);
        
        html += `
            <div class="transaction-item enhanced">
                <div class="transaction-date">
                    <span class="day">${date.getDate()}</span>
                    <span class="month">${monthNames[date.getMonth()]}</span>
                </div>
                <div class="transaction-details">
                    <div class="transaction-icon ${iconClass}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="transaction-info">
                        <h4>${transaction.description || 'Transaction'}</h4>
                        <p>${transaction.account || 'Unknown'} • ${transaction.wallet || 'Unknown'}</p>
                    </div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${sign} ${formatRupiah(transaction.amount)}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    console.log("Recent transactions displayed successfully");
}

function displayWeeklyTrends(transactions) {
    const weeklyData = getWeeklyData(transactions);
    
    // Update totals
    document.getElementById('weeklyIncomeTotal').textContent = formatRupiah(weeklyData.totalIncome);
    document.getElementById('weeklyExpenseTotal').textContent = formatRupiah(weeklyData.totalExpense);
    
    // Create income sparkline
    const incomeCtx = document.getElementById('incomeSparkline');
    if (incomeCtx) {
        new Chart(incomeCtx, {
            type: 'line',
            data: {
                labels: weeklyData.labels,
                datasets: [{
                    data: weeklyData.income,
                    borderColor: 'rgba(76, 175, 80, 0.8)',
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: 'rgba(76, 175, 80, 1)'
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { 
                    x: { 
                        display: true,
                        grid: { display: false }
                    }, 
                    y: { 
                        display: false,
                        beginAtZero: true
                    } 
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Create expense sparkline
    const expenseCtx = document.getElementById('expenseSparkline');
    if (expenseCtx) {
        new Chart(expenseCtx, {
            type: 'line',
            data: {
                labels: weeklyData.labels,
                datasets: [{
                    data: weeklyData.expense,
                    borderColor: 'rgba(244, 67, 54, 0.8)',
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: 'rgba(244, 67, 54, 1)'
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { 
                    x: { 
                        display: true,
                        grid: { display: false }
                    }, 
                    y: { 
                        display: false,
                        beginAtZero: true
                    } 
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

function displayTopWallets(wallets) {
    const container = document.getElementById('topWallets');
    if (!container) return;
    
    if (!wallets || Object.keys(wallets).length === 0) {
        container.innerHTML = '<p class="empty-state">No wallets found. Create a wallet to get started.</p>';
        return;
    }
    
    // Convert wallets object to array
    const walletsArray = Object.entries(wallets).map(([id, wallet]) => ({
        id,
        ...wallet
    }));
    
    // Sort by balance (highest first)
    walletsArray.sort((a, b) => (b.balance || 0) - (a.balance || 0));
    
    // Take top 3
    const topWallets = walletsArray.slice(0, 3);
    
    let html = '';
    topWallets.forEach(wallet => {
        // Default color if not set
        const color = wallet.color || '#6c5ce7';
        
        // Create a darker shade for gradient
        const darkerColor = adjustColor(color, -30);
        
        html += `
            <div class="wallet-card" style="background: linear-gradient(135deg, ${color}, ${darkerColor})">
                <div class="wallet-icon">
                    <i class="fas ${wallet.icon || 'fa-wallet'}"></i>
                </div>
                <h3>${wallet.name}</h3>
                <p class="wallet-balance">${formatRupiah(wallet.balance || 0)}</p>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Fungsi displayTopBudgets yang diperbarui untuk mengurutkan dan menampilkan dengan benar
function displayTopBudgets(budgets) {
    const container = document.getElementById('topBudgets');
    if (!container) return;
    
    // Get current month's budgets
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const currentBudgets = budgets[currentPeriod] || {};
    
    if (Object.keys(currentBudgets).length === 0) {
        container.innerHTML = '<p class="empty-state">No budgets found for this month.</p>';
        return;
    }
    
    console.log("Raw budget data:", currentBudgets);
    
    // Convert to array and calculate percentages
    const budgetsArray = Object.entries(currentBudgets).map(([category, budget]) => {
        // Pastikan nilai spent dan limit adalah angka
        const spent = parseFloat(budget.spent || 0);
        const limit = parseFloat(budget.limit || 1); // Hindari pembagian dengan nol
        
        // Hitung persentase penggunaan budget (progress)
        const percentage = (spent / limit) * 100;
        
        console.log(`Budget: ${category}, Spent: ${spent}, Limit: ${limit}, Percentage: ${percentage.toFixed(1)}%`);
        
        return {
            category,
            spent: spent,
            limit: limit,
            percentage: percentage
        };
    });
    
    console.log(`Displaying budgets in ${budgetViewMode} mode`);
    
    // Sort based on current view mode
    if (budgetViewMode === 'percentage') {
        // Sort by percentage (highest first) - ini adalah progress
        budgetsArray.sort((a, b) => b.percentage - a.percentage);
        console.log("Sorted by progress (percentage):", budgetsArray.map(b => `${b.category}: ${b.percentage.toFixed(1)}%`));
    } else {
        // Sort by limit (highest first)
        budgetsArray.sort((a, b) => b.limit - a.limit);
        console.log("Sorted by limit:", budgetsArray.map(b => `${b.category}: ${formatRupiah(b.limit)}`));
    }
    
    // Take top 3
    const topBudgets = budgetsArray.slice(0, 3);
    console.log("Top 3 budgets:", topBudgets);
    
    let html = '';
    topBudgets.forEach(budget => {
        const percentage = budget.percentage;
        let statusClass = 'safe';
        
        if (percentage >= 90) statusClass = 'danger';
        else if (percentage >= 75) statusClass = 'warning';
        
        html += `
            <div class="budget-item">
                <div class="budget-info">
                    <h4>${budget.category}</h4>
                    <p>${formatRupiah(budget.spent)} / ${formatRupiah(budget.limit)}</p>
                </div>
                <div class="budget-bar">
                    <div class="budget-progress ${statusClass}" style="width: ${Math.min(percentage, 100)}%;"></div>
                </div>
                <div class="budget-percentage ${statusClass}">
                    ${budgetViewMode === 'percentage' 
                        ? `${percentage.toFixed(0)}%` 
                        : formatRupiah(budget.limit)}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function showDailyTip() {
    const tips = [
        "Save 20% of your income for long-term goals.",
        "Track every expense to identify spending patterns.",
        "Pay yourself first - automate your savings.",
        "Review your budget regularly to stay on track.",
        "Avoid impulse purchases by waiting 24 hours before buying.",
        "Use the 50/30/20 rule: 50% needs, 30% wants, 20% savings.",
        "Eliminate high-interest debt first.",
        "Build an emergency fund covering 3-6 months of expenses.",
        "Invest early and regularly for compound growth.",
        "Use cash for discretionary spending to be more mindful.",
        "Negotiate bills and subscriptions annually.",
        "Cook at home more often to reduce food expenses.",
        "Set specific financial goals with deadlines.",
        "Use cashback and rewards programs strategically.",
        "Review your credit report annually for errors."
    ];
    
    // Choose tip based on date
    const today = new Date();
    const tipIndex = (today.getDate() + today.getMonth()) % tips.length;
    
    document.getElementById('dailyTip').textContent = tips[tipIndex];
}

// ============================================================================
// Helper Functions
// ============================================================================
function adjustColor(hex, percent) {
    // Convert hex to RGB
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);

    // Adjust color
    r = Math.max(0, Math.min(255, r + percent));
    g = Math.max(0, Math.min(255, g + percent));
    b = Math.max(0, Math.min(255, b + percent));

    // Convert back to hex
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Fungsi untuk memuat data awal
async function loadInitialData() {
    try {
        return await loadUserData(userId);
    } catch (error) {
        console.error("Error loading initial data:", error);
        throw error;
    }
}
