// dropdown.js - Mengelola dropdown menu
document.addEventListener('DOMContentLoaded', () => {
    const dropbtn = document.querySelector('.dropbtn');
    const dropdownContent = document.querySelector('.dropdown-content');
    
    // Toggle dropdown saat tombol diklik
    dropbtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownContent.classList.toggle('show');
        dropbtn.classList.toggle('active');
    });
    
    // Tutup dropdown jika user mengklik di luar dropdown
    document.addEventListener('click', (e) => {
        if (!dropdownContent.contains(e.target) && !dropbtn.contains(e.target)) {
            dropdownContent.classList.remove('show');
            dropbtn.classList.remove('active');
        }
    });
    
    // Mencegah dropdown tertutup saat mengklik kontennya
    dropdownContent.addEventListener('click', (e) => {
        // Jika mengklik link, biarkan default behavior
        if (e.target.tagName === 'A' || e.target.closest('a')) {
            return;
        }
        // Jika tidak, cegah event bubbling
        e.stopPropagation();
    });
});
