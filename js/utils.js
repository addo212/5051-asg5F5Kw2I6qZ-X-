// js/utils.js

/**
 * Memformat angka menjadi format mata uang Rupiah (Rp xxx.xxx).
 * @param {number} number - Angka yang akan diformat.
 * @returns {string} String yang sudah diformat, contoh: "Rp 1.500.000".
 */
export function formatRupiah(number) {
    // Jika input bukan angka atau null/undefined, anggap sebagai 0.
    if (typeof number !== 'number' || isNaN(number)) {
        number = 0;
    }

    // Menggunakan toLocaleString('id-ID') untuk mendapatkan format Indonesia (pemisah titik).
    // Math.round() digunakan untuk menghilangkan desimal, karena Rupiah jarang menggunakannya.
    const formattedNumber = Math.round(number).toLocaleString('id-ID');
    
    return `Rp ${formattedNumber}`;
}
