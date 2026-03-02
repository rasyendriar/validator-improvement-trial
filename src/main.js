/**
 * src/main.js
 * Entry point aplikasi. Menginisialisasi semua modul, memasang event listener,
 * mem-parsing konstanta, dan mengekspos fungsi-fungsi global ke window.appActions.
 */

// Import Config & State
import { MASTER_WC_CSV } from './config/constants.js';
import { appState, batcherState } from './state/store.js';
import { GameSystem } from './state/gamification.js';

// Import UI Modules
import { initTheme } from './ui/theme.js';
import { setupMainTabs, switchTab } from './ui/navigation.js';
import { initModals, showToast, toggleGuide } from './ui/modals.js';
import { initTableEvents, renderDisplayRingTable, renderErrorTable, renderTablePage, updatePaginationInfo, setLenFilter, isEditMode, toggleEditMode } from './ui/tables.js';
import { initVisualizerControls, generateSVG } from './ui/visualizer.js';

// Import Services
import { handleFiles, startBatchValidation, clearValidatorQueue, toggleForceStatus, updateTableRowVerifiedStatus, revalidateEditedData } from './services/validatorService.js';
import { initBatcher, viewMissingFiles, sendBatchToValidator } from './services/batcherService.js';
import { initConverter } from './services/converterService.js';

// Import Exports
import { downloadSapTxt, downloadSapMerge, downloadSapBatch, downloadBatch, downloadReport, downloadManifest, downloadSingleExcel } from './utils/fileExport.js';

// --- INISIALISASI ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Data & State
    GameSystem.init();
    parseMasterWorkCenterData();
    
    // 2. Init UI
    initTheme();
    setupMainTabs();
    initModals();
    initTableEvents();
    initVisualizerControls();
    
    // 3. Init Services
    initBatcher();
    initConverter();

    // 4. Setup Validator Drop Zone & Inputs
    setupValidatorEvents();

    // 5. Ekspos fungsi global untuk UI Event (onclick)
    exposeAppActions();
    
    // Setup Keyboard Shortcuts
    setupKeyboardShortcuts();
});

// --- FUNGSI SETUP INTERNAL ---

function parseMasterWorkCenterData() {
    const lines = MASTER_WC_CSV.split('\n');
    appState.workCenterData.clear();
    
    lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const stort = parts[0].trim();
            const arbpl = parts[1].trim();
            if (stort && stort !== 'STORT') {
                appState.workCenterData.set(stort, arbpl);
            }
        }
    });
    console.log(`Loaded ${appState.workCenterData.size} Work Center rules.`);
}

function setupValidatorEvents() {
    const dropArea = document.getElementById('drop-area');
    const fileElem = document.getElementById('fileElem');

    if (dropArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.add('border-mitratel-red', 'bg-red-50', 'dark:bg-red-900/10'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.remove('border-mitratel-red', 'bg-red-50', 'dark:bg-red-900/10'), false);
        });

        dropArea.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files), false);
        dropArea.addEventListener('click', () => fileElem.click());
    }

    if (fileElem) {
        fileElem.addEventListener('change', function() { handleFiles(this.files); }, false);
    }
}

function exposeAppActions() {
    window.appActions = window.appActions || {};
    
    // Validator Actions
    window.appActions.startBatchValidation = startBatchValidation;
    window.appActions.clearValidatorQueue = clearValidatorQueue;
    window.appActions.toggleForceStatus = toggleForceStatus;
    window.appActions.openVisualizer = openVisualizer;
    window.appActions.verifyStructure = verifyStructure;
    
    // Edit & Re-Validate Actions
    window.appActions.toggleEditMode = toggleEditMode;
    window.appActions.revalidateEditedData = revalidateEditedData;
    
    // Batcher Actions
    window.appActions.viewMissingFiles = viewMissingFiles;
    window.appActions.sendBatchToValidator = sendBatchToValidator;
    
    // Modal Actions
    window.appActions.toggleGuide = toggleGuide;
    
    // Download Actions
    window.appActions.downloadReport = downloadReport;
    window.appActions.downloadManifest = downloadManifest;
    window.appActions.downloadBatchAll = () => downloadBatch('all');
    window.appActions.downloadBatchPass = () => downloadBatch('pass');
    window.appActions.downloadBatchFail = () => downloadBatch('fail');
    window.appActions.downloadSapAll = () => downloadSapBatch('all');
    window.appActions.downloadSapPass = () => downloadSapBatch('pass');
    window.appActions.downloadSapMerge = downloadSapMerge;
    window.appActions.downloadSapTxt = downloadSapTxt;
    
    // Visualizer Tab Switching Actions
    const renderDataCallback = () => { renderTablePage(); updatePaginationInfo(); };
    window.appActions.switchTabViz = () => switchTab('viz');
    window.appActions.switchTabDisplay = () => switchTab('display');
    window.appActions.switchTabData = () => switchTab('data', renderDataCallback, updatePaginationInfo);
    window.appActions.switchTabErrors = () => switchTab('errors');
    
    // ... (Cari fungsi exposeAppActions(), tambahkan sebaris kode ini di dalamnya)
    window.appActions.downloadSingleExcel = downloadSingleExcel;

    // Hubungkan tombol HTML static ke fungsi global
    const binds = [
        ['btnStartValidation', 'startBatchValidation'],
        ['btnClearFiles', 'clearValidatorQueue'],
        ['btnDownloadReport', 'downloadReport'],
        ['btnDownloadBatchAll', 'downloadBatchAll'],
        ['btnDownloadBatchPass', 'downloadBatchPass'],
        ['btnDownloadBatchFail', 'downloadBatchFail'],
        ['btnDownloadSapAll', 'downloadSapAll'],
        ['btnDownloadSapPass', 'downloadSapPass'],
        ['btnDownloadSapMerge', 'downloadSapMerge'],
        ['btnViewMissing', 'viewMissingFiles'],
        ['btnDownloadManifest', 'downloadManifest'],
        ['btnDownloadManifestModal', 'downloadManifest'],
        ['btnSendAllBatch', () => sendBatchToValidator('all')],
        ['tab-viz', 'switchTabViz'],
        ['tab-display', 'switchTabDisplay'],
        ['tab-data', 'switchTabData'],
        ['tab-errors', 'switchTabErrors'],
        ['btnToggleEditViz', 'toggleEditMode'],
        ['btnRevalidateViz', 'revalidateEditedData']
    ];

    binds.forEach(([id, action]) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', typeof action === 'string' ? window.appActions[action] : action);
        }
    });
}

// --- FUNGSI MODAL VISUALIZER (LOGIKA PENGHUBUNG) ---

function openVisualizer(fileName) {
    const item = appState.processed[fileName];
    if (!item) return;

    appState.currentFileIndex = appState.processedKeys.indexOf(fileName);
    appState.targetPID = item.pid;
    
    // Update Header
    document.getElementById('modalFileName').innerText = item.fileName;
    document.getElementById('targetPidDisplay').innerText = item.pid || "NO_PID_DETECTED";

    const badge = document.getElementById('vizStatusBadge');
    if (item.status === 'PASS') {
        badge.className = "font-bold text-xs px-2 py-1 rounded uppercase bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    } else if (item.status === 'WARNING') {
        badge.className = "font-bold text-xs px-2 py-1 rounded uppercase bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    } else {
        badge.className = "font-bold text-xs px-2 py-1 rounded uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    }
    badge.innerText = item.status;

    // Update Verify Button
    const btnVerify = document.getElementById('btnVerifyStructure');
    if(btnVerify) {
        btnVerify.classList.remove('hidden');
        if(GameSystem.isVerified(item.pid)) {
            btnVerify.innerHTML = `<i class="fa-solid fa-check"></i> Verified`;
            btnVerify.className = "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400";
            btnVerify.onclick = () => verifyStructure(item.fileName);
        } else {
            btnVerify.innerHTML = `Verify Structure`;
            btnVerify.className = "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all bg-white text-slate-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700";
            btnVerify.onclick = () => verifyStructure(item.fileName);
        }
    }

    // Navigasi Prev/Next
    const btnPrev = document.getElementById('btnModalPrev');
    const btnNext = document.getElementById('btnModalNext');
    if(btnPrev && btnNext) {
        btnPrev.disabled = appState.currentFileIndex <= 0;
        btnNext.disabled = appState.currentFileIndex >= appState.processedKeys.length - 1;
        
        btnPrev.onclick = () => {
            if(appState.currentFileIndex > 0) openVisualizer(appState.processedKeys[appState.currentFileIndex - 1]);
        };
        btnNext.onclick = () => {
            if(appState.currentFileIndex < appState.processedKeys.length - 1) openVisualizer(appState.processedKeys[appState.currentFileIndex + 1]);
        };
    }

    // Force Toggle override
    const btnForce = document.getElementById('btnForceToggleViz');
    if(btnForce) {
        btnForce.classList.remove('hidden');
        btnForce.onclick = () => {
            toggleForceStatus(item.fileName);
            openVisualizer(item.fileName); // Refresh modal view
        };
    }

    // Render Data
    renderDisplayRingTable(item.displayData);
    renderErrorTable([...item.errors, ...(item.warnings || [])]);
    
    appState.currentData = item.belowData;
    appState.filteredData = [...appState.currentData];
    appState.currentPage = 1;
    
    // Reset Filter Text Search di modal Data
    const tableSearch = document.getElementById('tableSearch');
    if(tableSearch) tableSearch.value = "";
    
    // Reset Default Filter ke 'all' sebelum render
    setLenFilter('all');

    // Render Visualizer
    generateSVG(item.displayData, item.belowData, item.pid);

    document.getElementById('vizModal').classList.remove('hidden');
    window.appActions.switchTabViz();
}

function verifyStructure(fileName) {
    const item = appState.processed[fileName];
    if(!item || !item.pid) return;
    
    if(GameSystem.isVerified(item.pid)) {
        GameSystem.unmarkVerified(item.pid);
        showToast("Verification removed");
    } else {
        GameSystem.markVerified(item.pid);
    }
    
    updateTableRowVerifiedStatus(item.rowId, item.pid);
    openVisualizer(fileName); // Refresh modal button state
}

// --- KEYBOARD SHORTCUTS ---
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('vizModal');
        if (modal && !modal.classList.contains('hidden')) {
            // Abaikan shortcut jika sedang mengetik di input, tabel (contenteditable), atau Edit Mode aktif
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable || isEditMode) {
                if (e.key !== 'Escape') return; // Izinkan tombol Esc untuk menutup modal
            }

            switch(e.key.toLowerCase()) {
                case 'arrowleft':
                    document.getElementById('btnModalPrev')?.click(); break;
                case 'arrowright':
                    document.getElementById('btnModalNext')?.click(); break;
                case 'escape':
                    document.getElementById('btnCloseModal')?.click(); break;
                case '1':
                    window.appActions.switchTabViz(); break;
                case '2':
                    window.appActions.switchTabDisplay(); break;
                case '3':
                    window.appActions.switchTabData(); break;
                case '4':
                    window.appActions.switchTabErrors(); break;
                case 'w':
                    import('./ui/visualizer.js').then(m => m.panViz(0, -50)); break;
                case 's':
                    import('./ui/visualizer.js').then(m => m.panViz(0, 50)); break;
                case 'a':
                    import('./ui/visualizer.js').then(m => m.panViz(-50, 0)); break;
                case 'd':
                    import('./ui/visualizer.js').then(m => m.panViz(50, 0)); break;
                case '+':
                case '=':
                    import('./ui/visualizer.js').then(m => m.changeZoom(0.1)); break;
                case '-':
                case '_':
                    import('./ui/visualizer.js').then(m => m.changeZoom(-0.1)); break;
                case 'v':
                    document.getElementById('btnVerifyStructure')?.click(); break;
                case 'f':
                    document.getElementById('btnForceToggleViz')?.click(); break;
            }
        }
    });
}

