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
 * Merender tombol-tombol kontrol pagination dengan sistem "sliding window".
 * @param {string} containerId - ID dari elemen div untuk menampung tombol.
 * @param {number} currentPage - Halaman yang sedang aktif.
 * @param {number} totalPages - Jumlah total halaman.
 * @param {Function} onPageChange - Fungsi callback yang akan dipanggil saat tombol halaman diklik.
 */
export function renderPaginationControls(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    if (totalPages <= 1) return;

    const pageWindow = 5; // Jumlah tombol halaman yang ditampilkan sekaligus

    // Fungsi untuk membuat tombol
    const createButton = (text, page, isDisabled = false, isActive = false) => {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.dataset.page = page;
        button.disabled = isDisabled;
        if (isActive) button.classList.add('active');
        button.addEventListener('click', () => onPageChange(page));
        return button;
    };

    // Fungsi untuk membuat elipsis (...)
    const createEllipsis = () => {
        const span = document.createElement('span');
        span.className = 'pagination-ellipsis';
        span.textContent = '...';
        return span;
    };

    // Tombol "Previous"
    container.appendChild(createButton('« Prev', currentPage - 1, currentPage === 1));

    // Logika untuk menentukan halaman awal dan akhir dari "jendela" paginasi
    let startPage = Math.max(1, currentPage - Math.floor(pageWindow / 2));
    let endPage = Math.min(totalPages, startPage + pageWindow - 1);

    if (endPage === totalPages) {
        startPage = Math.max(1, totalPages - pageWindow + 1);
    }

    // Menampilkan tombol halaman pertama dan elipsis (...) jika perlu
    if (startPage > 1) {
        container.appendChild(createButton('1', 1));
        if (startPage > 2) {
            container.appendChild(createEllipsis());
        }
    }

    // Menampilkan tombol-tombol halaman di dalam "jendela"
    for (let i = startPage; i <= endPage; i++) {
        container.appendChild(createButton(i, i, false, i === currentPage));
    }

    // Menampilkan elipsis (...) dan tombol halaman terakhir jika perlu
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            container.appendChild(createEllipsis());
        }
        container.appendChild(createButton(totalPages, totalPages));
    }

    // Tombol "Next"
    container.appendChild(createButton('Next »', currentPage + 1, currentPage === totalPages));
}
