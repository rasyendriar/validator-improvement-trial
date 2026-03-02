/**
 * src/ui/modals.js
 * Mengatur fungsi untuk menampilkan pesan popup (Toast),
 * membuka/menutup modal panduan (Guide), visualizer, dan dropdown menus.
 */

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    let bgClass = type === 'success' ? 'bg-emerald-500' : 'bg-blue-500';
    if (type === 'error') bgClass = 'bg-red-500';

    toast.className = `toast ${bgClass} text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2`;
    toast.innerHTML = `<i class="fa-solid fa-bell"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (container.contains(toast)) container.removeChild(toast);
        }, 300);
    }, 3000);
}

export function toggleGuide() { 
    const modal = document.getElementById('guideModal');
    if(modal) modal.classList.toggle('hidden'); 
}

export function closeModal() { 
    const modal = document.getElementById('vizModal');
    if(modal) modal.classList.add('hidden'); 
}

export function closeMissingFiles() { 
    const modal = document.getElementById('missingFilesModal');
    if(modal) modal.classList.add('hidden'); 
}

export function toggleBatchMenu(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('batchMenu');
    if(menu) menu.classList.toggle('hidden');
}

export function toggleSapMenu(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('sapMenu');
    if(menu) menu.classList.toggle('hidden');
}

export function closeDropdowns(e) {
    // Tutup Batch menu jika klik di luar
    if (!e.target.closest('#batchMenu') && !e.target.closest('#btnToggleBatchMenu')) {
        const batchMenu = document.getElementById('batchMenu');
        if(batchMenu) batchMenu.classList.add('hidden');
    }
    // Tutup SAP menu jika klik di luar
    if (!e.target.closest('#sapMenu') && !e.target.closest('#btnToggleSapMenu')) {
        const sapMenu = document.getElementById('sapMenu');
        if(sapMenu) sapMenu.classList.add('hidden');
    }
}

// Inisialisasi event listener dasar untuk menutup dropdown saat klik body
export function initModals() {
    document.body.addEventListener('click', closeDropdowns);

    const btnCloseGuide = document.getElementById('btnCloseGuide');
    if(btnCloseGuide) btnCloseGuide.addEventListener('click', toggleGuide);

    const btnToggleGuide = document.getElementById('btnToggleGuide');
    if(btnToggleGuide) btnToggleGuide.addEventListener('click', toggleGuide);

    const btnCloseModal = document.getElementById('btnCloseModal');
    if(btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

    const btnCloseMissingFiles = document.getElementById('btnCloseMissingFiles');
    if(btnCloseMissingFiles) btnCloseMissingFiles.addEventListener('click', closeMissingFiles);

    const btnToggleBatchMenu = document.getElementById('btnToggleBatchMenu');
    if(btnToggleBatchMenu) btnToggleBatchMenu.addEventListener('click', toggleBatchMenu);

    const btnToggleSapMenu = document.getElementById('btnToggleSapMenu');
    if(btnToggleSapMenu) btnToggleSapMenu.addEventListener('click', toggleSapMenu);
}