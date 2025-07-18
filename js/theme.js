// js/theme.js

import { auth, loadAccentColor } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

/**
 * Theme Manager Universal
 * File ini menangani semua logika tema untuk seluruh aplikasi.
 * - Memuat dan menerapkan tema light/dark dari localStorage
 * - Memuat dan menerapkan warna aksen dari Firebase
 */

document.addEventListener('DOMContentLoaded', function() {
    // Elemen toggle tema
    const themeToggle = document.getElementById('themeToggle');
    
    // Fungsi untuk menerapkan tema light/dark
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update status checkbox toggle jika ada
        if (themeToggle) {
            themeToggle.checked = theme === 'dark';
        }
    }
    
    // Memuat tema dari localStorage atau gunakan default
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    
    // Menangani perubahan tema saat toggle diubah
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            const newTheme = this.checked ? 'dark' : 'light';
            applyTheme(newTheme);
        });
    }
    
    // Memuat dan menerapkan warna aksen dari Firebase
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadAccentColor(user.uid)
                .then(color => {
                    if (color) {
                        // Terapkan warna aksen ke variabel CSS
                        document.documentElement.style.setProperty('--accent-color', color);
                        
                        // Hitung variasi warna untuk gradien
                        const rgbColor = hexToRgb(color);
                        if (rgbColor) {
                            // Variasi lebih terang untuk gradient-start
                            const lighterColor = adjustBrightness(rgbColor, 20);
                            // Variasi lebih gelap untuk gradient-end
                            const darkerColor = adjustBrightness(rgbColor, -20);
                            
                            document.documentElement.style.setProperty('--gradient-start', rgbToHex(lighterColor));
                            document.documentElement.style.setProperty('--gradient-end', rgbToHex(darkerColor));
                            
                            // Ekstrak nilai RGB untuk digunakan dalam rgba()
                            document.documentElement.style.setProperty(
                                '--accent-color-rgb', 
                                `${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}`
                            );
                        }
                    }
                })
                .catch(error => {
                    console.error("Error loading accent color:", error);
                });
        }
    });
});

/**
 * Mengkonversi warna hex (#RRGGBB) ke objek RGB {r, g, b}
 */
function hexToRgb(hex) {
    // Pastikan format hex valid
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Mengkonversi objek RGB {r, g, b} ke format hex (#RRGGBB)
 */
function rgbToHex(rgb) {
    return "#" + ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1);
}

/**
 * Menyesuaikan kecerahan warna RGB
 * @param {Object} rgb - Objek RGB {r, g, b}
 * @param {number} percent - Persentase perubahan (-100 hingga 100)
 * @returns {Object} - Objek RGB baru dengan kecerahan yang disesuaikan
 */
function adjustBrightness(rgb, percent) {
    const adjust = (value) => {
        return Math.max(0, Math.min(255, Math.round(value + (value * percent / 100))));
    };
    
    return {
        r: adjust(rgb.r),
        g: adjust(rgb.g),
        b: adjust(rgb.b)
    };
}
