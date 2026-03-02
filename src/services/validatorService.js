/**
 * src/services/validatorService.js
 * Menangani antrean file, proses validasi, dan pengecekan Rules.
 * Update Phase 3: Integrasi Dynamic Rule Engine & Module Worker.
 */

import { appState, recalculateStats, clearValidatorState } from '../state/store.js';
import { GameSystem } from '../state/gamification.js';
import { extractAnchorPid, excelRow, buildSapTxtFromRows } from '../utils/helpers.js';
import { showToast } from '../ui/modals.js';
import { filterQueueTable } from '../ui/tables.js';
import { appEventBus } from '../utils/eventBus.js'; 
import { runRowRules, runPostProcessRules } from '../rules/coreRules.js'; // IMPORT RULE ENGINE

// --- UI UPDATERS (Khusus Validator) ---

export function updateDashboardUI() {
    const elTotal = document.getElementById('stat-total');
    const elPass = document.getElementById('stat-pass');
    const elFail = document.getElementById('stat-fail');
    const elWarn = document.getElementById('stat-warning');

    if(elTotal) elTotal.innerText = appState.stats.total;
    if(elPass) elPass.innerText = appState.stats.pass;
    if(elFail) elFail.innerText = appState.stats.fail;
    if(elWarn) elWarn.innerText = appState.stats.warning;
    
    const badgeAll = document.getElementById('badge-all');
    const badgePass = document.getElementById('badge-pass');
    const badgeFail = document.getElementById('badge-fail');
    
    if(badgeAll) badgeAll.innerText = appState.stats.total;
    if(badgePass) badgePass.innerText = appState.stats.pass;
    if(badgeFail) badgeFail.innerText = appState.stats.fail;

    const sapAll = document.getElementById('badge-sap-all');
    const sapPass = document.getElementById('badge-sap-pass');
    if (sapAll) sapAll.innerText = appState.stats.total;
    if (sapPass) sapPass.innerText = appState.stats.pass;
}

export function updateTableRowVerifiedStatus(rowId, pid) {
    const row = document.getElementById(rowId);
    if(!row) return;
    const cell = row.cells[3]; 
    if(GameSystem.isVerified(pid)) {
        cell.innerHTML = `<span class="text-emerald-500 text-lg" title="Manually Verified"><i class="fa-solid fa-circle-check"></i></span>`;
    } else {
        cell.innerHTML = `<span class="text-gray-300 text-lg"><i class="fa-regular fa-circle"></i></span>`;
    }
}

export function updateRowStatusUI(rowId, item) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const statusCell = row.cells[2];
    const actionCell = row.cells[5];

    let statusClass = "";
    if (item.status === 'PASS') {
        statusClass = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    } else if (item.status === 'WARNING') {
        statusClass = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    } else {
        statusClass = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    }
    
    let statusHtml = `<span class="${statusClass} py-1 px-3 rounded-md text-xs font-bold uppercase tracking-wider">${item.status}</span>`;
    if (item.isManuallyOverridden) {
        statusHtml += `<div class="text-[9px] text-gray-500 mt-1"><i class="fa-solid fa-gavel"></i> Manual</div>`;
    }
    statusCell.innerHTML = statusHtml;

    const toggleIcon = item.status === 'PASS' ? 'fa-thumbs-down' : 'fa-thumbs-up';
    const toggleTitle = item.status === 'PASS' ? 'Force Fail' : 'Force Pass';
    const toggleColor = item.status === 'PASS' ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50';

    actionCell.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <button onclick="window.appActions.openVisualizer('${item.fileName}')" class="bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-slate-700 dark:text-white p-2 rounded-lg transition" title="Visualize">
               <i class="fa-solid fa-eye"></i>
            </button>
            <button onclick="window.appActions.toggleForceStatus('${item.fileName}')" class="bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-600 ${toggleColor} p-2 rounded-lg transition" title="${toggleTitle}">
               <i class="fa-solid ${toggleIcon}"></i>
            </button>
            <button onclick="window.appActions.downloadSingleExcel('${item.fileName}')" class="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-300 p-2 rounded-lg transition" title="Download XLSX">
               <i class="fa-solid fa-file-excel"></i>
            </button>
            <button onclick="window.appActions.downloadSapTxt('${item.fileName}')" class="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 p-2 rounded-lg transition" title="Download SAP TXT">
               <i class="fa-solid fa-file-code"></i>
            </button>
        </div>
    `;
}

// --- FUNGSI ANTREAN & PEMROSESAN FILE AWAL ---

export function handleFiles(files) {
    const tbody = document.getElementById('result-body');
    if (!tbody) return;

    let added = false;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = `file-${Date.now()}-${i}`;
        appState.queue.push({ file, id: fileId });
        added = true;

        const targetPid = extractAnchorPid(file.name);

        const tr = document.createElement('tr');
        tr.id = fileId;
        tr.className = "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition border-b border-gray-50 dark:border-gray-800";
        
        tr.innerHTML = `
            <td class="py-4 px-6 text-sm text-gray-400 font-mono">${tbody.children.length + 1}</td>
            <td class="py-4 px-6 text-sm font-semibold text-slate-700 dark:text-gray-200">
                ${file.name}
                <br><span class="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-1.5 py-0.5 rounded tracking-wide mt-1 inline-block">ID: ${targetPid}</span>
            </td>
            <td class="py-4 px-6 text-center text-xs font-bold text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">Pending</td>
            <td class="py-4 px-6 text-center text-gray-300">-</td>
            <td class="py-4 px-6 text-sm text-gray-400 italic">Ready to process...</td>
            <td class="py-4 px-6 text-center text-gray-300">-</td>
        `;
        tbody.appendChild(tr);
    }

    if (added) {
        document.getElementById('btnStartValidation').classList.remove('hidden');
        document.getElementById('btnClearFiles').classList.remove('hidden');
        document.getElementById('summary-dashboard').classList.remove('hidden');
        
        if(appState.currentQueueFilter && appState.currentQueueFilter !== 'all') {
            filterQueueTable();
        } else if(document.getElementById('queueSearch') && document.getElementById('queueSearch').value.trim() !== "") {
            filterQueueTable();
        }
    }
}

export function clearValidatorQueue() {
    if(!confirm("Are you sure you want to clear all files from the queue?")) return;

    clearValidatorState();
    
    const tbody = document.getElementById('result-body');
    if(tbody) tbody.innerHTML = '';
    
    document.getElementById('btnStartValidation').classList.add('hidden');
    document.getElementById('summary-dashboard').classList.add('hidden');
    document.getElementById('groupActions').classList.add('hidden');
    document.getElementById('btnClearFiles').classList.add('hidden');
    
    const fileElem = document.getElementById('fileElem');
    if(fileElem) fileElem.value = '';
}

// 🚀 FUNGSI BATCH UTAMA DENGAN WORKER POOL
export async function startBatchValidation() {
    const btn = document.getElementById('btnStartValidation');
    if (!btn) return;

    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    btn.innerHTML = `<span class="loader border-t-white mr-2" style="width:16px;height:16px;border-width:2px;"></span> Processing...`;

    appState.stats.total = 0;
    appState.stats.pass = 0;
    appState.stats.fail = 0;
    appState.stats.warning = 0;
    updateDashboardUI();

    const CONCURRENCY_LIMIT = Math.min(navigator.hardwareConcurrency || 4, 6);
    const workers = [];
    const pendingResolvers = new Map(); 

    // PHASE 3: Inisialisasi dengan { type: 'module' }
    for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
        const workerUrl = new URL('../workers/excelWorker.js', import.meta.url);
        const w = new Worker(workerUrl, { type: 'module' }); 
        
        w.onmessage = (e) => {
            const data = e.data;
            if (data && data.fileName && pendingResolvers.has(data.fileName)) {
                pendingResolvers.get(data.fileName)(data);
            }
        };
        
        w.onerror = (err) => console.error(`Worker [${i}] Global Error:`, err);
        workers.push(w);
    }

    let currentIndex = 0;
    const queue = [...appState.queue];
    
    const processNextInPool = async (workerId) => {
        const worker = workers[workerId];
        
        while (currentIndex < queue.length) {
            const itemIndex = currentIndex++;
            const item = queue[itemIndex];
            
            await processFileWithWorker(item.file, item.id, worker, pendingResolvers);
        }
    };

    const threads = [];
    for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
        threads.push(processNextInPool(i));
    }

    await Promise.all(threads);

    workers.forEach(w => w.terminate());
    pendingResolvers.clear();
    
    appState.queue = []; 
    btn.innerHTML = "<i class='fa-solid fa-check mr-2'></i> Done";
    document.getElementById('groupActions').classList.remove('hidden');

    setTimeout(() => { 
        btn.classList.add('hidden'); 
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.innerHTML = `<i class='fa-solid fa-play mr-2 text-xs'></i> Start Validation`;
    }, 2000);
}

// Mengeksekusi 1 file spesifik ke Worker yang di-assign
async function processFileWithWorker(file, rowId, worker, pendingResolvers) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const statusCell = row.cells[2];
    const msgCell = row.cells[4];
    const verifiedCell = row.cells[3];
    const actionCell = row.cells[5];

    statusCell.innerHTML = `<span class="loader"></span>`;
    msgCell.innerText = "Processing via Worker...";

    try {
        const arrayBuffer = await file.arrayBuffer();
        const anchorPid = extractAnchorPid(file.name);
        
        const workCenterMapObj = {};
        if (appState.workCenterData) {
            appState.workCenterData.forEach((val, key) => {
                workCenterMapObj[key] = val;
            });
        }

        const workerResult = await new Promise((resolve) => {
            pendingResolvers.set(file.name, resolve);
            
            worker.postMessage({
                fileBuffer: arrayBuffer,
                fileName: file.name,
                anchorPid: anchorPid,
                workCenterMap: workCenterMapObj
            });
        });

        if (!workerResult.success) {
            throw new Error(workerResult.error);
        }

        appState.stats.total++;
        if(workerResult.status === "PASS") {
            appState.stats.pass++;
            GameSystem.addXP(10, "Validation Passed");
        } else if (workerResult.status === "FAIL") {
            appState.stats.fail++;
        } else {
            appState.stats.warning++; 
        }

        appState.processed[workerResult.fileName] = {
            fileName: workerResult.fileName,
            belowData: workerResult.belowData,
            displayData: workerResult.displayData,
            pid: workerResult.pid, 
            status: workerResult.status,
            errors: workerResult.errors,
            warnings: workerResult.warnings, 
            sapTxt: workerResult.sapTxt,
            rowId: rowId,
            isManuallyOverridden: false 
        };
        
        appState.processedKeys = Object.keys(appState.processed);

        updateDashboardUI();
        updateRowStatusUI(rowId, appState.processed[workerResult.fileName]);
        updateTableRowVerifiedStatus(rowId, anchorPid);

        if (workerResult.status === "PASS") {
            msgCell.innerHTML = "<span class='text-green-600 dark:text-green-400 font-medium'><i class='fa-solid fa-check-circle mr-1'></i> Validated Successfully</span>";
        } else if (workerResult.status === "WARNING") {
            msgCell.innerHTML = `<span class='text-orange-600 dark:text-orange-400 font-medium'><i class='fa-solid fa-triangle-exclamation mr-1'></i> Found ${workerResult.warnings.length} warnings</span>`;
        } else {
            msgCell.innerHTML = `<span class='text-red-600 dark:text-red-400 font-medium'><i class='fa-solid fa-xmark mr-1'></i> Found ${workerResult.errors.length} errors</span>`;
        }

        if(appState.currentQueueFilter && appState.currentQueueFilter !== 'all') {
            filterQueueTable();
        } else if(document.getElementById('queueSearch') && document.getElementById('queueSearch').value.trim() !== "") {
            filterQueueTable();
        }

    } catch (err) {
        console.error("processFile Error:", err);
        statusCell.innerHTML = `<span class="bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 py-1 px-3 rounded-md text-xs font-bold uppercase">Error</span>`;
        msgCell.innerText = err.message || "Failed processing in worker";
        verifiedCell.innerHTML = "-";
        actionCell.innerHTML = "-";
        appState.stats.total++;
        appState.stats.fail++;
        updateDashboardUI();
    } finally {
        pendingResolvers.delete(file.name);
    }
}

// --- LOGIKA RE-VALIDASI (SYNCHRONOUS MENGGUNAKAN RULE ENGINE) ---

async function executeValidation(fileName, anchorPid, belowData, displayData, rowId, isRevalidation = false) {
    const row = document.getElementById(rowId);
    let statusCell, msgCell;
    
    if (row) {
        statusCell = row.cells[2];
        msgCell = row.cells[4];
        if (isRevalidation) {
            statusCell.innerHTML = `<span class="loader"></span>`;
            msgCell.innerText = "Re-validating...";
        }
    }

    try {
        const workCenterMapObj = {};
        if (appState.workCenterData) {
            appState.workCenterData.forEach((val, key) => {
                workCenterMapObj[key] = val;
            });
        }

        // Persiapkan Konteks State (Sama seperti Worker)
        const context = {
            anchorPid,
            workCenterMap: workCenterMapObj,
            seenStrno: new Set(),
            duplicates: new Set(),
            segmentMap: {},
            segmentOrder: [],
            r16Segments: {},
            r17MaterialGroups: {},
            r18Occupancy: {},
            errors: [],
            warnings: []
        };

        // Eksekusi Logika lewat Engine
        belowData.forEach((r, idx) => {
            r._rowIndex = idx + 2; 
            const s = String(r.STRNO || "");
            const len = (s.toLowerCase() === "<na>" || s === "") ? 0 : s.length;
            r.STRNO_LENGTH = len;
            if (len === 17) r.PLTXT = s; 

            runRowRules(r, context);
        });

        runPostProcessRules(belowData, displayData, context);

        let statusStr = "PASS";
        if (context.errors.length > 0) statusStr = "FAIL";
        else if (context.warnings.length > 0) statusStr = "WARNING";

        const exportBelowData = belowData.map(r => {
            const { STRNO_LENGTH, _rowIndex, ...rest } = r;
            return rest;
        });

        const allKeys = Object.keys(exportBelowData[0] || {});
        const headerOrder = ['STRNO', ...allKeys.filter(k => k!=='STRNO')]; 
        const sapTxt = buildSapTxtFromRows(exportBelowData, headerOrder);

        appState.processed[fileName] = {
            fileName: fileName,
            belowData: belowData,
            displayData: displayData,
            pid: anchorPid, 
            status: statusStr,
            errors: context.errors,
            warnings: context.warnings, 
            sapTxt: sapTxt,
            rowId: rowId,
            isManuallyOverridden: false 
        };
        
        recalculateStats();
        updateDashboardUI();
        updateRowStatusUI(rowId, appState.processed[fileName]);
        updateTableRowVerifiedStatus(rowId, anchorPid);

        if (row) {
            if (statusStr === "PASS") {
                 msgCell.innerHTML = "<span class='text-green-600 dark:text-green-400 font-medium'><i class='fa-solid fa-check-circle mr-1'></i> Validated Successfully</span>";
            } else if (statusStr === "WARNING") {
                 msgCell.innerHTML = `<span class='text-orange-600 dark:text-orange-400 font-medium'><i class='fa-solid fa-triangle-exclamation mr-1'></i> Found ${context.warnings.length} warnings</span>`;
            } else {
                 msgCell.innerHTML = `<span class='text-red-600 dark:text-red-400 font-medium'><i class='fa-solid fa-xmark mr-1'></i> Found ${context.errors.length} errors</span>`;
            }
        }

        if(appState.currentQueueFilter && appState.currentQueueFilter !== 'all') {
            filterQueueTable();
        } else if(document.getElementById('queueSearch') && document.getElementById('queueSearch').value.trim() !== "") {
            filterQueueTable();
        }

        return appState.processed[fileName];

    } catch (err) {
        console.error("Validation Logic Error:", err);
        throw err;
    }
}

// --- FUNGSI RE-VALIDATE (FITUR EDIT) ---

export async function revalidateEditedData() {
    const fileName = appState.processedKeys[appState.currentFileIndex];
    if (!fileName) return;

    const item = appState.processed[fileName];
    if (!item) return;

    showToast("Memproses ulang validasi...", "info");

    try {
        const updatedItem = await executeValidation(item.fileName, item.pid, item.belowData, item.displayData, item.rowId, true);
        
        const badge = document.getElementById('vizStatusBadge');
        if (badge) {
            if (updatedItem.status === 'PASS') {
                badge.className = "font-bold text-xs px-2 py-1 rounded uppercase bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
            } else if (updatedItem.status === 'WARNING') {
                badge.className = "font-bold text-xs px-2 py-1 rounded uppercase bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
            } else {
                badge.className = "font-bold text-xs px-2 py-1 rounded uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
            }
            badge.innerText = updatedItem.status;
        }

        appEventBus.emit('DATA_REVALIDATED', updatedItem);
        showToast("Data berhasil divalidasi dan di-update!", "success");

    } catch (err) {
        showToast("Terjadi kesalahan saat re-validasi: " + err.message, "error");
    }
}

export function toggleForceStatus(fileName) {
    const item = appState.processed[fileName];
    if(!item) return;

    if (item.status === 'PASS' || item.status === 'WARNING') {
        item.status = 'FAIL';
        item.isManuallyOverridden = true;
        item.originalStatus = item.originalStatus || 'PASS';
    } else {
        item.status = 'PASS';
        item.isManuallyOverridden = true;
        item.originalStatus = item.originalStatus || 'FAIL';
    }

    recalculateStats();
    updateDashboardUI();
    updateRowStatusUI(item.rowId, item);
    
    showToast(`Status updated to ${item.status}`, item.status === 'PASS' ? 'success' : 'error');
}

window.appActions = window.appActions || {};
window.appActions.revalidateEditedData = revalidateEditedData;
