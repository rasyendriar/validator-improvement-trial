/**
 * src/ui/theme.js
 * Mengatur logika Dark Mode dan Light Mode beserta penyimpanannya di localStorage.
 */

export function toggleDarkMode() {
    const html = document.documentElement;
    const icon = document.getElementById('themeIcon');
    
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.theme = 'light';
        if (icon) icon.className = 'fa-regular fa-moon';
    } else {
        html.classList.add('dark');
        localStorage.theme = 'dark';
        if (icon) icon.className = 'fa-regular fa-sun';
    }
}

export function initTheme() {
    // Inisialisasi status Dark Mode saat aplikasi pertama kali dimuat
    const icon = document.getElementById('themeIcon');
    
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        if (icon) icon.className = 'fa-regular fa-sun';
    } else {
        document.documentElement.classList.remove('dark');
        if (icon) icon.className = 'fa-regular fa-moon';
    }

    // Pasang Event Listener ke tombol toggle
    const btnToggle = document.getElementById('btnToggleTheme');
    if (btnToggle) {
        btnToggle.addEventListener('click', toggleDarkMode);
    }
}