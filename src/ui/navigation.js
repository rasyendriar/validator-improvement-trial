/**
 * src/ui/navigation.js
 * Mengatur perpindahan antar tab utama (Validator, Batcher, Converter) 
 * dan sub-tab di dalam modal Visualizer.
 */

// Panggil fungsi ini saat aplikasi dimuat untuk memasang Event Listeners
export function setupMainTabs() {
    const btnV = document.getElementById('tabBtnValidator');
    const btnB = document.getElementById('tabBtnBatcher');
    const btnC = document.getElementById('tabBtnConverter');
    const tabV = document.getElementById('tab-validator');
    const tabB = document.getElementById('tab-batcher');
    const tabC = document.getElementById('tab-converter');

    if (!btnV || !btnB || !btnC || !tabV || !tabB || !tabC) return;

    function setActive(which) {
        const isV = which === 'validator';
        const isB = which === 'batcher';
        const isC = which === 'converter';
        
        tabV.classList.toggle('hidden', !isV);
        tabB.classList.toggle('hidden', !isB);
        tabC.classList.toggle('hidden', !isC);

        // Helper untuk mengatur style tombol
        const setStyle = (btn, active) => {
            if(active) {
                btn.classList.add('bg-gray-50', 'text-slate-900', 'shadow-sm', 'dark:bg-gray-700', 'dark:text-white');
                btn.classList.remove('text-slate-500', 'hover:text-slate-900', 'dark:text-gray-400', 'dark:hover:text-white');
            } else {
                btn.classList.add('text-slate-500', 'hover:text-slate-900', 'dark:text-gray-400', 'dark:hover:text-white');
                btn.classList.remove('bg-gray-50', 'text-slate-900', 'shadow-sm', 'dark:bg-gray-700', 'dark:text-white');
            }
        };

        setStyle(btnV, isV);
        setStyle(btnB, isB);
        setStyle(btnC, isC);
    }

    btnV.addEventListener('click', () => setActive('validator'));
    btnB.addEventListener('click', () => setActive('batcher'));
    btnC.addEventListener('click', () => setActive('converter'));
}

// Fungsi untuk navigasi di dalam modal Detail View (Visualizer)
export function switchTab(tab, renderTableCallback = null, updatePaginationCallback = null) {
    const btnViz = document.getElementById('tab-viz');
    const btnDisplay = document.getElementById('tab-display');
    const btnData = document.getElementById('tab-data');
    const btnErrors = document.getElementById('tab-errors');
    
    const divViz = document.getElementById('content-viz');
    const divDisplay = document.getElementById('content-display');
    const divData = document.getElementById('content-data');
    const divErrors = document.getElementById('content-errors');

    // Reset Styles semua tombol dan sembunyikan semua konten
    [btnViz, btnDisplay, btnData, btnErrors].forEach(btn => {
        if(btn) {
            btn.className = "nav-btn py-4 text-sm font-medium text-gray-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition whitespace-nowrap";
            btn.classList.remove('active', 'text-mitratel-red', 'font-semibold');
        }
    });
    [divViz, divDisplay, divData, divErrors].forEach(div => {
        if(div) div.classList.add('hidden');
    });

    // Aktifkan tombol dan tab yang dipilih
    let activeBtn;
    if (tab === 'viz') {
        activeBtn = btnViz;
        if(divViz) divViz.classList.remove('hidden');
    } else if (tab === 'display') {
        activeBtn = btnDisplay;
        if(divDisplay) divDisplay.classList.remove('hidden');
    } else if (tab === 'data') {
        activeBtn = btnData;
        if(divData) divData.classList.remove('hidden');
        // Jika callback disediakan dari main.js / table.js, eksekusi untuk render tabel
        if (renderTableCallback) renderTableCallback();
        if (updatePaginationCallback) updatePaginationCallback(); 
    } else if (tab === 'errors') {
        activeBtn = btnErrors;
        if(divErrors) divErrors.classList.remove('hidden');
    }

    if (activeBtn) {
        activeBtn.classList.add('active', 'text-mitratel-red', 'font-semibold');
        activeBtn.classList.remove('text-gray-500');
    }
}