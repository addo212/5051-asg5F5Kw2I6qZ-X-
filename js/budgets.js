// budgets.js

// ============================================================================
// Module Imports
// ============================================================================
import { auth, loadUserData, loadTransactions, saveBudget, deleteBudget, loadBudgetPeriods } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { formatRupiah } from './utils.js';

// ============================================================================
// Global Variables
// ============================================================================
let userId;
let currentPeriod = ''; // Format: "YYYY-MM"
let availablePeriods = [];
// Variabel global untuk menyimpan instance chart
let budgetPieChart = null;
let budgetBarChart = null;

// ============================================================================
// Main Initialization
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        initializeBudgetsPage();
    } else {
        window.location.href = "index.html";
    }
});

async function initializeBudgetsPage() {
    try {
        const now = new Date();
        currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        populateYearDropdowns();
        
        document.getElementById('budgetPeriodMonth').value = currentPeriod.split('-')[1];
        document.getElementById('budgetPeriodYear').value = currentPeriod.split('-')[0];
        
        const userData = await loadUserData(userId);
        if (!userData) throw new Error("User data not found.");

        const expenseAccounts = userData.accounts?.expense || [];
        populateCategoryDropdown(expenseAccounts);
        
        availablePeriods = await loadBudgetPeriods(userId);
        
        await loadAndDisplayBudgetsForPeriod(currentPeriod);
        
        updateCurrentPeriodDisplay(currentPeriod);
        
        setupEventListeners();

    } catch (error) {
        console.error("Error initializing budgets page:", error);
        const tableBody = document.getElementById('budgetTableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">${error.message}</td></tr>`;
        }
    }
}

// ============================================================================
// Period Management
// ============================================================================
function populateYearDropdowns() {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    const endYear = currentYear + 1;
    
    const yearDropdowns = ['budgetPeriodYear', 'customBudgetYear'];
    
    yearDropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        
        dropdown.innerHTML = '';
        for (let year = startYear; year <= endYear; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.text = year;
            if (year === currentYear) {
                option.selected = true;
            }
            dropdown.appendChild(option);
        }
    });
}

function updateCurrentPeriodDisplay(period) {
    const displayElement = document.getElementById('currentPeriodDisplay');
    if (!displayElement) return;
    
    const [year, month] = period.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(month) - 1];
    displayElement.textContent = `${monthName} ${year}`;
}

async function loadAndDisplayBudgetsForPeriod(period) {
    try {
        const userData = await loadUserData(userId);
        const periodBudgets = userData?.budgets?.[period] || {};
        const allTransactions = await loadTransactions(userId) || {};
        
        const processedBudgets = processBudgets(periodBudgets, allTransactions, period);
        
        displayBudgets(processedBudgets, period);
    } catch (error) {
        console.error("Error loading budgets for period:", error);
        const tableBody = document.getElementById('budgetTableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Error loading budgets: ${error.message}</td></tr>`;
        }
    }
}

// ============================================================================
// Data Processing
// ============================================================================
function processBudgets(budgets, transactions, period) {
    const [year, month] = period.split('-').map(Number);
    
    // Buat salinan objek budgets agar tidak mengubah data asli
    const processedBudgets = JSON.parse(JSON.stringify(budgets));
    
    // Reset semua nilai spent
    for (const category in processedBudgets) {
        processedBudgets[category].spent = 0;
    }
    
    // Hitung pengeluaran untuk setiap kategori
    for (const txId in transactions) {
        const tx = transactions[txId];
        if (!tx.timestamp) continue;
        
        const txDate = new Date(tx.timestamp);
        
        if (tx.type === 'expense' && 
            txDate.getFullYear() === year && 
            txDate.getMonth() + 1 === month) {
            
            if (processedBudgets[tx.account]) {
                processedBudgets[tx.account].spent += tx.amount;
            }
        }
    }
    
    return processedBudgets;
}

// ============================================================================
// UI Display Functions
// ============================================================================
function populateCategoryDropdown(expenseAccounts) {
    const select = document.getElementById('budgetCategory');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select a category...</option>';
    
    // Urutkan kategori secara alfabetis untuk kemudahan penggunaan
    const sortedAccounts = [...expenseAccounts].sort();
    
    sortedAccounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.text = account;
        select.appendChild(option);
    });
}

/**
 * Fungsi utama untuk menampilkan semua visualisasi budget.
 */
function displayBudgets(budgets, period) {
    // Hitung total budget dan pengeluaran
    let totalLimit = 0;
    let totalSpent = 0;
    
    Object.values(budgets).forEach(budget => {
        totalLimit += budget.limit;
        totalSpent += budget.spent;
    });
    
    // Tampilkan total di bagian atas visualisasi
    displayBudgetSummary(totalLimit, totalSpent);
    
    // Tampilkan tabel dan chart
    displayBudgetTable(budgets, period, totalLimit, totalSpent);
    displayBudgetCharts(budgets);
}

/**
 * Fungsi untuk menampilkan ringkasan budget
 */
function displayBudgetSummary(totalLimit, totalSpent) {
    // Cek apakah elemen ringkasan sudah ada, jika belum, buat baru
    let summaryElement = document.getElementById('budgetSummary');
    if (!summaryElement) {
        const visualizationContainer = document.querySelector('.budget-visualization');
        if (visualizationContainer) {
            summaryElement = document.createElement('div');
            summaryElement.id = 'budgetSummary';
            summaryElement.className = 'budget-summary';
            visualizationContainer.parentNode.insertBefore(summaryElement, visualizationContainer);
        }
    }
    
    if (summaryElement) {
        const remaining = totalLimit - totalSpent;
        const percentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
        
        let statusClass = 'safe';
        if (percentage > 75) statusClass = 'warning';
        if (percentage >= 100) statusClass = 'danger';
        
        summaryElement.innerHTML = `
            <div class="summary-item">
                <h3>Total Budget</h3>
                <p>${formatRupiah(totalLimit)}</p>
            </div>
            <div class="summary-item">
                <h3>Total Spent</h3>
                <p>${formatRupiah(totalSpent)}</p>
            </div>
            <div class="summary-item">
                <h3>Remaining</h3>
                <p class="${statusClass}">${formatRupiah(remaining)}</p>
            </div>
            <div class="summary-item">
                <h3>Progress</h3>
                <div class="summary-progress">
                    <div class="table-progress-bar">
                        <div class="table-progress-fill ${statusClass}" style="width: ${Math.min(percentage, 100)}%;"></div>
                    </div>
                    <span>${percentage.toFixed(1)}%</span>
                </div>
            </div>
        `;
    }
}

/**
 * Fungsi untuk merender data budget ke dalam tabel.
 */
function displayBudgetTable(budgets, period, totalLimit, totalSpent) {
    const tableBody = document.getElementById('budgetTableBody');
    if (!tableBody) {
        console.error("Budget table body not found!");
        return;
    }

    if (Object.keys(budgets).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No budgets found for this period.</td></tr>';
        return;
    }

    // Konversi objek budgets menjadi array dan tambahkan properti percentage
    const budgetsArray = Object.entries(budgets).map(([category, budget]) => ({
        category,
        ...budget,
        percentage: budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0
    }));

    // Urutkan berdasarkan persentase penggunaan (dari tertinggi ke terendah)
    const sortedBudgets = budgetsArray.sort((a, b) => b.percentage - a.percentage);

    let html = '';
    sortedBudgets.forEach(budget => {
        const percentage = budget.percentage;
        const remaining = budget.limit - budget.spent;

        let progressBarClass = 'safe';
        if (percentage > 75) progressBarClass = 'warning';
        if (percentage >= 100) progressBarClass = 'danger';

        html += `
            <tr>
                <td>${budget.category}</td>
                <td>${formatRupiah(budget.limit)}</td>
                <td>${formatRupiah(budget.spent)}</td>
                <td>${formatRupiah(remaining)}</td>
                <td>
                    <div class="table-progress-bar">
                        <div class="table-progress-fill ${progressBarClass}" style="width: ${Math.min(percentage, 100)}%;"></div>
                    </div>
                    <small>${percentage.toFixed(1)}%</small>
                </td>
                <td class="table-actions">
                    <button class="delete-btn" data-period="${period}" data-category="${budget.category}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    // Tambahkan baris total di bagian bawah tabel
    const totalRemaining = totalLimit - totalSpent;
    const totalPercentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
    
    let totalProgressClass = 'safe';
    if (totalPercentage > 75) totalProgressClass = 'warning';
    if (totalPercentage >= 100) totalProgressClass = 'danger';
    
    html += `
        <tr class="budget-total-row">
            <td><strong>TOTAL</strong></td>
            <td><strong>${formatRupiah(totalLimit)}</strong></td>
            <td><strong>${formatRupiah(totalSpent)}</strong></td>
            <td><strong>${formatRupiah(totalRemaining)}</strong></td>
            <td>
                <div class="table-progress-bar">
                    <div class="table-progress-fill ${totalProgressClass}" style="width: ${Math.min(totalPercentage, 100)}%;"></div>
                </div>
                <small>${totalPercentage.toFixed(1)}%</small>
            </td>
            <td></td>
        </tr>
    `;

    tableBody.innerHTML = html;
    attachDeleteListeners();
}

/**
 * Fungsi untuk merender data budget ke dalam chart.
 */
function displayBudgetCharts(budgets) {
    if (Object.keys(budgets).length === 0) {
        // Jika tidak ada data, bersihkan chart yang ada
        if (budgetPieChart) budgetPieChart.destroy();
        if (budgetBarChart) budgetBarChart.destroy();
        budgetPieChart = null;
        budgetBarChart = null;
        return;
    }

    // Siapkan data untuk chart
    const budgetsArray = Object.entries(budgets)
        .map(([category, budget]) => ({
            category,
            ...budget,
            percentage: budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0
        }))
        .sort((a, b) => b.spent - a.spent); // Urutkan berdasarkan jumlah pengeluaran

    const categories = budgetsArray.map(b => b.category);
    const spentData = budgetsArray.map(b => b.spent);
    const limitData = budgetsArray.map(b => b.limit);

    // Warna untuk chart
    const chartColors = [
        '#3498db', '#e74c3c', '#9b59b6', '#2ecc71', '#f1c40f', 
        '#1abc9c', '#e67e22', '#34495e', '#16a085', '#d35400',
        '#8e44ad', '#27ae60', '#f39c12', '#2980b9', '#c0392b'
    ];

    try {
        // Pie Chart untuk distribusi pengeluaran
        const pieCtx = document.getElementById('budgetPieChart');
        if (pieCtx) {
            // Hancurkan chart lama jika ada
            if (budgetPieChart) budgetPieChart.destroy();
            
            budgetPieChart = new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: categories,
                    datasets: [{
                        data: spentData,
                        backgroundColor: chartColors.slice(0, categories.length),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            position: 'right',
                            labels: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                            }
                        },
                        title: { 
                            display: true, 
                            text: 'Spending Distribution',
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    return `${label}: ${formatRupiah(value)}`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Bar Chart untuk perbandingan limit vs pengeluaran
        const barCtx = document.getElementById('budgetBarChart');
        if (barCtx) {
            // Hancurkan chart lama jika ada
            if (budgetBarChart) budgetBarChart.destroy();
            
            budgetBarChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: categories,
                    datasets: [
                        {
                            label: 'Budget Limit',
                            data: limitData,
                            backgroundColor: 'rgba(52, 152, 219, 0.7)',
                            borderColor: 'rgba(52, 152, 219, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Spent',
                            data: spentData,
                            backgroundColor: 'rgba(231, 76, 60, 0.7)',
                            borderColor: 'rgba(231, 76, 60, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return formatRupiah(value);
                                },
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                            },
                            grid: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                            }
                        },
                        x: {
                            ticks: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                            },
                            grid: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                            }
                        },
                        title: {
                            display: true,
                            text: 'Budget vs Actual Spending',
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    const value = context.raw || 0;
                                    return `${label}: ${formatRupiah(value)}`;
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error("Error rendering charts:", error);
    }
}

// ============================================================================
// Event Listeners
// ============================================================================
function setupEventListeners() {
    const viewButton = document.getElementById('viewBudgetPeriodBtn');
    if (viewButton) {
        viewButton.addEventListener('click', () => {
            const month = document.getElementById('budgetPeriodMonth').value;
            const year = document.getElementById('budgetPeriodYear').value;
            currentPeriod = `${year}-${month}`;
            updateCurrentPeriodDisplay(currentPeriod);
            loadAndDisplayBudgetsForPeriod(currentPeriod);
        });
    }
    
    const periodSelect = document.getElementById('newBudgetPeriod');
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            const customFields = document.getElementById('customPeriodFields');
            if (customFields) {
                customFields.style.display = e.target.value === 'custom' ? 'block' : 'none';
            }
        });
    }
    
    const budgetForm = document.getElementById('addBudgetForm');
    if (budgetForm) {
        budgetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let period = currentPeriod;
            if (document.getElementById('newBudgetPeriod').value === 'custom') {
                const month = document.getElementById('customBudgetMonth').value;
                const year = document.getElementById('customBudgetYear').value;
                period = `${year}-${month}`;
            }
            
            const category = document.getElementById('budgetCategory').value;
            const limit = parseFloat(document.getElementById('budgetLimit').value);

            if (!category || isNaN(limit) || limit <= 0) {
                showError("Please select a category and enter a valid limit.");
                return;
            }

            try {
                await saveBudget(userId, period, category, limit);
                showSuccessMessage("Budget created successfully!");
                e.target.reset();
                
                // Reset custom period fields display
                document.getElementById('customPeriodFields').style.display = 'none';
                
                // Add period to available periods if it's new
                if (!availablePeriods.includes(period)) {
                    availablePeriods.push(period);
                }
                
                // If we're adding to the current displayed period, refresh the view
                if (period === currentPeriod) {
                    await loadAndDisplayBudgetsForPeriod(currentPeriod);
                }
            } catch (error) {
                console.error("Error saving budget:", error);
                showError("Failed to save budget.");
            }
        });
    }
}

function attachDeleteListeners() {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const period = button.dataset.period;
            const category = button.dataset.category;
            
            if (confirm(`Are you sure you want to delete the budget for "${category}"?`)) {
                try {
                    await deleteBudget(userId, period, category);
                    showSuccessMessage("Budget deleted successfully!");
                    await loadAndDisplayBudgetsForPeriod(currentPeriod);
                } catch (error) {
                    console.error("Error deleting budget:", error);
                    showError("Failed to delete budget.");
                }
            }
        });
    });
}

// ============================================================================
// UI Helper Functions
// ============================================================================
function showError(message) {
    const errorEl = document.getElementById('budgetError');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
    } else {
        console.error("Error element not found:", message);
    }
}

function showSuccessMessage(message) {
    alert(message);
}
