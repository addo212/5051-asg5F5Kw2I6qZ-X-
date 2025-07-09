// Theme management
document.addEventListener('DOMContentLoaded', () => {
    // Load saved theme or use default
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Check if we're on the settings page
    const themeOptions = document.querySelectorAll('.theme-option');
    if (themeOptions.length > 0) {
        // Mark active theme
        themeOptions.forEach(option => {
            if (option.getAttribute('data-theme') === savedTheme) {
                option.classList.add('active');
            }
            
            // Add click event
            option.addEventListener('click', () => {
                const theme = option.getAttribute('data-theme');
                
                // Update theme
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('theme', theme);
                
                // Update active option
                themeOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
            });
        });
    }
    
    // Toggle switches
    const notificationsToggle = document.getElementById('notificationsToggle');
    const soundsToggle = document.getElementById('soundsToggle');
    
    if (notificationsToggle) {
        notificationsToggle.checked = localStorage.getItem('notifications') === 'true';
        notificationsToggle.addEventListener('change', () => {
            localStorage.setItem('notifications', notificationsToggle.checked);
        });
    }
    
    if (soundsToggle) {
        soundsToggle.checked = localStorage.getItem('sounds') === 'true';
        soundsToggle.addEventListener('change', () => {
            localStorage.setItem('sounds', soundsToggle.checked);
        });
    }
});
