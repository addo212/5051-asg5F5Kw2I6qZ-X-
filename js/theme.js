// js/theme.js

/**
 * Theme Manager Universal
 * File ini menangani semua logika tema untuk seluruh aplikasi.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Ambil elemen yang mungkin ada di halaman
    const themeToggle = document.getElementById('themeToggle'); // Toggle sederhana di header
    const themeOptionsContainer = document.getElementById('themeOptions'); // Opsi detail di settings

    /**
     * Fungsi pusat untuk menerapkan tema.
     * @param {string} theme - Nama tema yang akan diterapkan (e.g., 'light', 'dark', 'blue').
     */
    function applyTheme(theme) {
        // Terapkan tema ke elemen <html>
        document.documentElement.setAttribute('data-theme', theme);
        // Simpan pilihan ke localStorage
        localStorage.setItem('theme', theme);

        // Sinkronkan status toggle sederhana di header (jika ada)
        if (themeToggle) {
            // Toggle hanya merepresentasikan light/dark.
            // Untuk tema lain seperti 'blue', anggap sebagai mode terang.
            themeToggle.checked = (theme === 'dark');
        }

        // Sinkronkan pilihan aktif di halaman settings (jika ada)
        if (themeOptionsContainer) {
            themeOptionsContainer.querySelectorAll('.theme-option').forEach(opt => {
                opt.classList.remove('active');
            });
            const activeOption = themeOptionsContainer.querySelector(`.theme-option[data-theme="${theme}"]`);
            if (activeOption) {
                activeOption.classList.add('active');
            }
        }
    }

    // 2. Muat tema saat halaman dibuka
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // 3. Tambahkan event listener untuk toggle sederhana (akan berjalan di semua halaman)
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            const newTheme = this.checked ? 'dark' : 'light';
            applyTheme(newTheme);
        });
    }

    // 4. Tambahkan event listener untuk opsi tema di halaman settings (hanya jika ada)
    if (themeOptionsContainer) {
        themeOptionsContainer.addEventListener('click', function(e) {
            const themeOption = e.target.closest('.theme-option');
            if (themeOption) {
                const newTheme = themeOption.dataset.theme;
                if (newTheme) {
                    applyTheme(newTheme);
                }
            }
        });
    }

    // 5. Menangani toggle lain yang mungkin ada di halaman settings
    const notificationsToggle = document.getElementById('notificationsToggle');
    if (notificationsToggle) {
        notificationsToggle.checked = localStorage.getItem('notifications') === 'true';
        notificationsToggle.addEventListener('change', () => {
            localStorage.setItem('notifications', notificationsToggle.checked);
        });
    }
    
    const soundsToggle = document.getElementById('soundsToggle');
    if (soundsToggle) {
        soundsToggle.checked = localStorage.getItem('sounds') === 'true';
        soundsToggle.addEventListener('change', () => {
            localStorage.setItem('sounds', soundsToggle.checked);
        });
    }
});
