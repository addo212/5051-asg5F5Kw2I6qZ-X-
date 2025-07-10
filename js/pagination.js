// js/pagination.js

/**
 * Memotong array besar menjadi bagian-bagian (halaman).
 * @param {Array} items - Array lengkap yang akan dipaginasi.
 * @param {number} currentPage - Halaman saat ini (dimulai dari 1).
 * @param {number} itemsPerPage - Jumlah item per halaman.
 * @returns {Object} Objek yang berisi item untuk halaman saat ini dan total halaman.
 */
export function paginate(items, currentPage, itemsPerPage) {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = items.slice(startIndex, endIndex);

    return {
        paginatedItems,
        totalPages,
    };
}

/**
 * Merender tombol-tombol kontrol pagination ke dalam elemen HTML.
 * @param {string} containerId - ID dari elemen div untuk menampung tombol.
 * @param {number} currentPage - Halaman yang sedang aktif.
 * @param {number} totalPages - Jumlah total halaman.
 * @param {Function} onPageChange - Fungsi callback yang akan dipanggil saat tombol halaman diklik, dengan nomor halaman baru sebagai argumen.
 */
export function renderPaginationControls(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ''; // Kosongkan kontrol lama

    if (totalPages <= 1) return; // Jangan tampilkan jika hanya ada 1 halaman

    // Tombol "Previous"
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '« Prev';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => onPageChange(currentPage - 1));
    container.appendChild(prevButton);

    // Tombol Halaman (misal: 1, 2, 3, ...)
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        if (i === currentPage) {
            pageButton.classList.add('active');
        }
        pageButton.addEventListener('click', () => onPageChange(i));
        container.appendChild(pageButton);
    }

    // Tombol "Next"
    const nextButton = document.createElement('button');
    nextButton.innerHTML = 'Next »';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => onPageChange(currentPage + 1));
    container.appendChild(nextButton);
}
