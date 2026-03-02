/**
 * src/services/validatorService.js
 * Menangani antrean file, proses validasi, dan pengecekan Rules (R5-R20).
 * Update Phase 1.1: Fix Worker Path & Mencegah Thread Bombing (Browser Crash).
 */

import { appState, recalculateStats, clearValidatorState } from '../state/store.js';
import { GameSystem } from '../state/gamification.js';
import { extractAnchorPid, isEmpty, excelRow, buildSapTxtFromRows } from '../utils/helpers.js';
import { showToast } from '../ui/modals.js';
import { filterQueueTable } from '../ui/tables.js';

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

    // FIXED: Sequential Processing.
    // Memproses file secara berurutan agar hanya ada 1 Web Worker yang aktif pada satu waktu.
    // Ini mencegah browser crash jika user mengunggah ratusan file sekaligus.
    for (const item of appState.queue) {
        await processFile(item.file, item.id);
    }
    
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

// Membaca file dan mengirim data ke Web Worker
async function processFile(file, rowId) {
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

        const workerResult = await new Promise((resolve, reject) => {
            // FIXED PATH: Menggunakan ./src/excelWorker.js sesuai struktur repo yang diunggah
            const worker = new Worker('./src/excelWorker.js');
            
            worker.onmessage = function(e) {
                resolve(e.data);
                worker.terminate(); 
            };
            
            worker.onerror = function(err) {
                reject(err);
                worker.terminate();
            };
            
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
        console.error(err);
        statusCell.innerHTML = `<span class="bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 py-1 px-3 rounded-md text-xs font-bold uppercase">Error</span>`;
        msgCell.innerText = err.message || "Failed processing in worker";
        verifiedCell.innerHTML = "-";
        actionCell.innerHTML = "-";
        appState.stats.total++;
        appState.stats.fail++;
        updateDashboardUI();
    }
}

// --- LOGIKA VALIDASI MURNI (RULES R5 - R20) ---
// Digunakan khusus untuk Re-Validate di dalam tab Edit (Visualizer).

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
        belowData.forEach((r, idx) => {
            r._rowIndex = idx + 2; 
            const s = String(r.STRNO || "");
            const len = (s.toLowerCase() === "<na>" || s === "") ? 0 : s.length;
            r.STRNO_LENGTH = len;
            if (len === 17) r.PLTXT = s; 
        });

        const errors = [];
        const warnings = []; 
        const rule5_Allowed = [17, 21, 26, 30];
        const seenStrno = new Set();
        const duplicates = new Set();

        const segmentMap = {}; 
        let segmentOrder = []; 

        const r16Segments = {}; 
        const r17MaterialGroups = {}; 
        const r18Occupancy = {}; 

        belowData.forEach((r, i) => {
            const strno = String(r.STRNO || "").trim();
            const pltxt = String(r.PLTXT || "").trim();
            const abckz = String(r.ABCKZ || "").trim().toUpperCase();
            const len = r.STRNO_LENGTH;
            
            // --- CORE RULES (R13, R14, R15, R16, R18) ---
            if (len === 30) {
                 const segId = strno.substring(0, 26);
                 if (!segmentMap.hasOwnProperty(segId)) {
                     segmentMap[segId] = false;
                     segmentOrder.push(segId);
                 }
                 if (pltxt.toUpperCase().includes(anchorPid)) {
                     segmentMap[segId] = true;
                 }

                 if (!r16Segments[segId]) r16Segments[segId] = { sequence: [] };
                 const segState = r16Segments[segId];
                 const normPid = pltxt ? pltxt : "EMPTY_CORE"; 
                 
                 const seqLen = segState.sequence.length;
                 const lastPidInSeq = seqLen > 0 ? segState.sequence[seqLen - 1].pid : null;

                 if (normPid !== lastPidInSeq) {
                     if (normPid !== "EMPTY_CORE") {
                         const prevIndex = segState.sequence.map(s => s.pid).lastIndexOf(normPid);
                         if (prevIndex !== -1) {
                             const gapSlice = segState.sequence.slice(prevIndex + 1);
                             const hasEmptyCore = gapSlice.some(s => s.pid === "EMPTY_CORE");

                             if (hasEmptyCore) {
                                 errors.push({ Rule: "R16_ANTI_SPLIT", Row: r._rowIndex, Message: `Error: PID '${pltxt}' terputus oleh core kosong di segmen ${segId}.` });
                             } else {
                                 warnings.push({ Rule: "R16_ANTI_SPLIT_WARN", Row: r._rowIndex, Message: `Peringatan: PID '${pltxt}' diselingi oleh project lain di segmen ${segId}.` });
                             }
                         }
                     }
                     segState.sequence.push({ pid: normPid, row: r._rowIndex });
                 }

                 if (pltxt && !pltxt.toUpperCase().includes("KABEL")) {
                     const basePid = pltxt.replace(/\[R\]|\(R\)/gi, '').trim().toUpperCase();
                     if (!r18Occupancy[segId]) r18Occupancy[segId] = {};
                     r18Occupancy[segId][basePid] = (r18Occupancy[segId][basePid] || 0) + 1;
                 }
            }

            // --- R17 (Sequential) ---
            if (len === 26) {
                const match = strno.match(/^(.+?)([A-Z]+)(\d+)$/); 
                if (match) {
                    const groupKey = match[1] + match[2]; 
                    const numVal = parseInt(match[3], 10);
                    if (!r17MaterialGroups[groupKey]) r17MaterialGroups[groupKey] = [];
                    r17MaterialGroups[groupKey].push({ num: numVal, row: r._rowIndex, strno: strno });
                }
            }

            // --- Basic Rules (R5, R9, R7) ---
            if (!rule5_Allowed.includes(len)) {
                errors.push({ Rule: "R5_LENGTH", Row: r._rowIndex, Message: `Panjang ${len} tidak valid. STRNO: ${strno}` });
            }
            if (seenStrno.has(strno)) {
                duplicates.add(strno);
                errors.push({ Rule: "R9_DUPLICATE", Row: r._rowIndex, Message: `Duplikat STRNO: ${strno}` });
            } else {
                seenStrno.add(strno);
            }
            
            const baseMap = { 17: "P", 21: "S", 30: "O" };
            if (baseMap[len]) {
                if (abckz !== baseMap[len]) {
                    errors.push({ Rule: "R7_ABCKZ", Row: r._rowIndex, Message: `Len ${len} harus ABCKZ='${baseMap[len]}', tapi tertulis '${abckz}'` });
                }
            } else if (len === 26) {
                if (strno.length >= 4) {
                    const code = strno.slice(-4, -2).toUpperCase();
                    const suffixMap = {"KU": "U", "JC": "R", "OB": "B", "OP": "L", "OC": "M", "OL": "J", "KT": "N", "TP": "H"};
                    if (suffixMap[code] && abckz !== suffixMap[code]) {
                        errors.push({ Rule: "R7_ABCKZ", Row: r._rowIndex, Message: `Len 26 (Code ${code}) harus ABCKZ='${suffixMap[code]}', tapi tertulis '${abckz}'` });
                    }
                }
            }

            // --- R12 WORK CENTER ---
            if (appState.workCenterData && appState.workCenterData.size > 0) {
                const stort = String(r.STORT || "").trim();
                const arbpl = String(r.ARBPL || "").trim();
                if (stort && appState.workCenterData.has(stort)) {
                    const expectedArbpl = appState.workCenterData.get(stort);
                    if (arbpl !== expectedArbpl) {
                        errors.push({ Rule: "R12_WORK_CENTER", Row: r._rowIndex, Message: `STORT '${stort}' requires ARBPL '${expectedArbpl}', but found '${arbpl}'` });
                    }
                }
            }
        });

        // --- Post-Process Rules ---
        Object.keys(r17MaterialGroups).forEach(key => {
            const items = r17MaterialGroups[key].sort((a,b) => a.num - b.num);
            if (items.length > 0) {
                if (items[0].num !== 1) {
                    errors.push({ Rule: "R17_SEQUENTIAL_START", Row: items[0].row, Message: `Urutan aset '${key}' dimulai dari nomor ${items[0].num}, seharusnya 01.` });
                }
                for (let k = 1; k < items.length; k++) {
                    const diff = items[k].num - items[k-1].num;
                    if (diff > 1) {
                        errors.push({ Rule: "R17_SEQUENTIAL_GAP", Row: items[k].row, Message: `Lompatan urutan aset '${key}'. Dari ${items[k-1].strno} langsung ke ${items[k].strno} (Gap detected).` });
                    }
                }
            }
        });

        Object.keys(r18Occupancy).forEach(segId => {
            const pidCounts = r18Occupancy[segId];
            Object.keys(pidCounts).forEach(pid => {
                if (pidCounts[pid] > 4) {
                    warnings.push({ Rule: "R18_HIGH_OCCUPANCY", Row: `SEGMENT ${segId}`, Message: `PID '${pid}' menggunakan ${pidCounts[pid]} core dalam satu segmen. (Threshold > 4).` });
                }
            });
        });

        const segments = belowData.filter(r => r.STRNO_LENGTH === 21);
        for(let k=0; k < segments.length - 1; k++) {
            const curr = segments[k];
            const next = segments[k+1];
            const currTxt = String(curr.PLTXT || "").toUpperCase().trim();
            const nextTxt = String(next.PLTXT || "").toUpperCase().trim();
            const currParts = currTxt.split('-').map(p => p.trim()).filter(p => p.length > 0);
            const nextParts = nextTxt.split('-').map(p => p.trim()).filter(p => p.length > 0);

            if (currParts.length > 0 && nextParts.length > 0) {
                const currEndPoint = currParts[currParts.length - 1];
                const nextStartPoint = nextParts[0];
                if (currEndPoint !== nextStartPoint) {
                    warnings.push({ Rule: "R19_CONNECTIVITY", Row: curr._rowIndex, Message: `Connectivity Terputus: End-Point '${currEndPoint}' pada segmen '${curr.PLTXT}' tidak menyambung dengan Start-Point '${nextStartPoint}' pada segmen '${next.PLTXT}' di baris bawahnya.` });
                }
            } else if (currTxt === "" || nextTxt === "") {
                 warnings.push({ Rule: "R19_CONNECTIVITY", Row: curr._rowIndex, Message: `Connectivity Terputus: Terdapat kolom PLTXT (Segmen) yang kosong.` });
            }
        }

        if (segmentOrder.length > 0) {
            const firstSegId = segmentOrder[0];
            if (segmentMap[firstSegId] === false) {
                errors.push({ Rule: "R14_ANCHOR_START", Row: "FIRST_SEGMENT", Message: `Anchor PID '${anchorPid}' wajib ada di Segmen Pertama (${firstSegId}). File ini dimulai dengan project lain/kosong.` });
            }
        }

        segmentOrder.forEach(segId => {
            if (segmentMap[segId] === false) {
                errors.push({ Rule: "R15_ANCHOR_SEGMENT_MISSING", Row: "SEGMENT_CHECK", Message: `Segmen ${segId} tidak memuat Anchor PID '${anchorPid}' sama sekali.` });
            }
        });

        let anchorPidFound = false;
        for (const r of belowData) {
            if (r.STRNO_LENGTH === 30 && String(r.PLTXT || "").toUpperCase().trim().includes(anchorPid)) {
                anchorPidFound = true;
                break;
            }
        }

        if (!anchorPidFound) {
            errors.push({ Rule: "R13_ANCHOR_PID_MISSING", Row: "GLOBAL", Message: `Anchor PID '${anchorPid}' (dari Nama File) tidak ditemukan sama sekali pada data Core.` });
        }

        if (displayData.length) {
            let lastPidCounts = null; 
            let lastCableId = null;
            const colsCheck = ["LINK_DESCRIPTION", "LINK_FRM_FLOC", "LINK_TO_FLOC", "FUNCTIONAL_LOCATION_LINK_OBJECT"];
            
            displayData.forEach((r, i) => {
                colsCheck.forEach(col => {
                    if (r[col]) { 
                        const val = String(r[col] || "").trim();
                        if (val && !seenStrno.has(val)) {
                            errors.push({ Rule: "R10_CROSS_CHECK", Row: excelRow(i), Message: `Sheet 'display_ring' kol '${col}': Nilai '${val}' tidak ditemukan di 'below_ring'.` });
                        }
                    }
                });

                const cableId = r['LINK_DESCRIPTION'];
                if (cableId) {
                    const cores = belowData.filter(b => {
                        const s = String(b.STRNO || "");
                        const p = String(b.PLTXT || "");
                        return s.startsWith(cableId) && s.length >= 30 && p && p.trim() !== "";
                    });
                    
                    const currentPidCounts = {};
                    cores.forEach(c => {
                        const pid = c.PLTXT;
                        if (!pid.toUpperCase().includes("KABEL")) {
                            currentPidCounts[pid] = (currentPidCounts[pid] || 0) + 1;
                        }
                    });

                    if (lastPidCounts) {
                        for (const pid in lastPidCounts) {
                            if (currentPidCounts.hasOwnProperty(pid)) {
                                const countLast = lastPidCounts[pid];
                                const countCurr = currentPidCounts[pid];
                                if (countLast !== countCurr) {
                                    errors.push({ Rule: "R11_PID_CONSISTENCY", Row: excelRow(i), Message: `Inkonsistensi PID ${pid} antar Segmen: ${lastCableId} (${countLast} core) -> ${cableId} (${countCurr} core).` });
                                }
                            }
                        }
                    }
                    lastPidCounts = currentPidCounts;
                    lastCableId = cableId;
                }
            });

            for (let i = 1; i < displayData.length; i++) {
                const prevTo = String(displayData[i - 1]['LINK_TO_FUNCTIONAL_LOCATION_DESC'] || "").trim();
                const currFrom = String(displayData[i]['LINK_FROM_FUNCTIONAL_LOCATION_DESC'] || "").trim();
                if (prevTo !== currFrom) {
                    warnings.push({ Rule: "R20_DISPLAY_CHAIN", Row: excelRow(i), Message: `Chain Break: 'LINK_FROM_DESC' (${currFrom}) tidak menyambung dari 'LINK_TO_DESC' baris sebelumnya (${prevTo}).` });
                }
            }
        }

        // --- FINAL STATUS DETERMINATION ---
        let statusStr = "PASS";
        if (errors.length > 0) statusStr = "FAIL";
        else if (warnings.length > 0) statusStr = "WARNING";

        const exportBelowData = belowData.map(r => {
            const { STRNO_LENGTH, _rowIndex, ...rest } = r;
            return rest;
        });

        const allKeys = Object.keys(exportBelowData[0] || {});
        const headerOrder = ['STRNO', ...allKeys.filter(k => k!=='STRNO')]; 
        const sapTxt = buildSapTxtFromRows(exportBelowData, headerOrder);

        // Update state saat revalidasi (tidak simpan wb lagi)
        appState.processed[fileName] = {
            fileName: fileName,
            belowData: belowData,
            displayData: displayData,
            pid: anchorPid, 
            status: statusStr,
            errors: errors,
            warnings: warnings, 
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
                 msgCell.innerHTML = `<span class='text-orange-600 dark:text-orange-400 font-medium'><i class='fa-solid fa-triangle-exclamation mr-1'></i> Found ${warnings.length} warnings</span>`;
            } else {
                 msgCell.innerHTML = `<span class='text-red-600 dark:text-red-400 font-medium'><i class='fa-solid fa-xmark mr-1'></i> Found ${errors.length} errors</span>`;
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

        import('../ui/tables.js').then(m => {
            m.renderErrorTable([...updatedItem.errors, ...(updatedItem.warnings || [])]);
            m.renderDisplayRingTable(updatedItem.displayData);
            m.filterTable(true);
        });

        import('../ui/visualizer.js').then(m => {
            m.generateSVG(updatedItem.displayData, updatedItem.belowData, updatedItem.pid);
        });

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
