/**
 * src/utils/fileExport.js
 * Menangani semua logika pengunduhan file (Excel & TXT) dari tab Validator dan Batcher.
 */

import { appState, batcherState } from '../state/store.js';
import { showToast } from '../ui/modals.js';
import { GameSystem } from '../state/gamification.js';

// --- Helper Internal untuk Memicu Download ---
function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- FUNGSI EXPORT SAP TXT ---

export function downloadSapTxt(fileName) {
    const item = appState.processed[fileName];
    if (!item || !item.sapTxt) {
        showToast("Error: Data SAP TXT tidak ditemukan untuk file ini.", "error");
        return;
    }
    const blob = new Blob([item.sapTxt], { type: "text/plain" });
    const outName = fileName.replace(/\.[^/.]+$/, "") + "_SAP.txt";
    triggerDownload(blob, outName);
    showToast(`SAP TXT downloaded: ${outName}`, "success");
}

export function downloadSapMerge() {
    const pKeys = appState.processedKeys;
    if (pKeys.length === 0) return showToast("Antrean kosong.", "error");

    let combinedTxt = "";
    let count = 0;
    
    // Merge hanya mengambil data dari baris ke-2 (menghilangkan header) untuk file ke-2 dst.
    pKeys.forEach((key, idx) => {
        const item = appState.processed[key];
        if (item && item.status === 'PASS' && item.sapTxt) {
            const lines = item.sapTxt.split('\r\n');
            if (count === 0) {
                // File pertama: Ambil semua termasuk header
                combinedTxt += lines.join('\r\n') + '\r\n';
            } else {
                // File berikutnya: Ambil data mulai baris ke-2 (index 1)
                if (lines.length > 1) {
                    combinedTxt += lines.slice(1).join('\r\n') + '\r\n';
                }
            }
            count++;
        }
    });

    if (count === 0) {
        return showToast("Tidak ada file berstatus PASS untuk di-merge.", "error");
    }

    const customNameEl = document.getElementById('sapMergedFilename');
    let outName = customNameEl && customNameEl.value.trim() !== "" ? customNameEl.value.trim() : "SAP_MERGED_PASS.txt";
    if (!outName.toLowerCase().endsWith('.txt')) outName += '.txt';

    const blob = new Blob([combinedTxt.trimEnd()], { type: "text/plain" });
    triggerDownload(blob, outName);
    showToast(`Merged ${count} files into ${outName}`, "success");
}

export function downloadSapBatch(mode) {
    const pKeys = appState.processedKeys;
    if(pKeys.length === 0) return showToast("Queue is empty", "error");

    let count = 0;
    pKeys.forEach(key => {
        const item = appState.processed[key];
        if(!item || !item.sapTxt) return;
        
        if (mode === 'all' || (mode === 'pass' && item.status === 'PASS')) {
            const blob = new Blob([item.sapTxt], { type: "text/plain" });
            const outName = key.replace(/\.[^/.]+$/, "") + "_SAP.txt";
            // Beri jeda sedikit agar browser tidak memblokir multiple download
            setTimeout(() => triggerDownload(blob, outName), count * 300);
            count++;
        }
    });

    if(count > 0) showToast(`Started downloading ${count} SAP TXT files`, "success");
    else showToast("No matching files found to download", "error");
}

// --- FUNGSI EXPORT EXCEL VALIDATOR (BATCH DOWNLOAD) ---

export function downloadBatch(mode) {
    const pKeys = appState.processedKeys;
    if(pKeys.length === 0) return showToast("Queue is empty", "error");

    let count = 0;
    pKeys.forEach(key => {
        const item = appState.processed[key];
        if(!item || !item.wb) return;

        let shouldDownload = false;
        if(mode === 'all') shouldDownload = true;
        else if(mode === 'pass' && item.status === 'PASS') shouldDownload = true;
        else if(mode === 'fail' && item.status === 'FAIL') shouldDownload = true;

        if (shouldDownload) {
            const wbOut = window.XLSX.write(item.wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbOut], { type: "application/octet-stream" });
            setTimeout(() => triggerDownload(blob, `VALIDATED_v4_${key}`), count * 300);
            count++;
        }
    });

    if(count > 0) showToast(`Started downloading ${count} Excel files`, "success");
    else showToast("No matching files found to download", "error");
}

export function downloadReport() {
    const pKeys = appState.processedKeys;
    if(pKeys.length === 0) return showToast("Queue is empty", "error");

    const reportData = [];
    pKeys.forEach((key, idx) => {
        const item = appState.processed[key];
        
        // Setup Cek Asset
        const cekAsset = item.status === 'PASS' ? "Done Upload SAP" : "NY OK";
        
        // Setup Verify Status
        const verifyStatus = GameSystem.isVerified(item.pid) ? "Verified" : "Unverified";
        
        // Setup Remarks (Concatenate error and warning messages)
        let remarksArr = [];
        if (item.errors && item.errors.length > 0) {
            item.errors.forEach(e => remarksArr.push(`[${e.Rule}] ${e.Message}`));
        }
        if (item.warnings && item.warnings.length > 0) {
            item.warnings.forEach(w => remarksArr.push(`[${w.Rule}] ${w.Message}`));
        }
        const remarks = remarksArr.length > 0 ? remarksArr.join(" | ") : "OK";

        reportData.push({
            "No": idx + 1,
            "Project ID": item.pid || "-",
            "Cek Asset": cekAsset,
            "Status": item.status,
            "Total Error": item.errors ? item.errors.length : 0,
            "Total Warning": item.warnings ? item.warnings.length : 0,
            "Manually": item.isManuallyOverridden ? "YES" : "NO",
            "Verify Status": verifyStatus,
            "Original Status": item.originalStatus || "-",
            "Remarks": remarks
        });
    });

    const ws = window.XLSX.utils.json_to_sheet(reportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Summary_Report");
    
    const wbOut = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: "application/octet-stream" });
    triggerDownload(blob, "Validation_Summary_Report.xlsx");
}

// --- FUNGSI EXPORT BATCHER MANIFEST ---

export function downloadManifest() {
    if (batcherState.targetFiles.size === 0 && batcherState.folderMap.size === 0) {
        showToast("No data to report.", "error");
        return;
    }

    const wb = window.XLSX.utils.book_new();
    
    // 1. Matched Files Sheet
    const matchedData = [];
    batcherState.batches.forEach((batch, bIdx) => {
        batch.forEach(f => {
            matchedData.push({
                "Batch Number": bIdx + 1,
                "Filename": f.name,
                "Size (KB)": (f.size / 1024).toFixed(1)
            });
        });
    });
    
    if(matchedData.length > 0) {
        const wsMatched = window.XLSX.utils.json_to_sheet(matchedData);
        window.XLSX.utils.book_append_sheet(wb, wsMatched, "Matched_Files");
    }

    // 2. Missing Files Sheet
    if(batcherState.missingFiles && batcherState.missingFiles.length > 0) {
        const missingData = batcherState.missingFiles.map(name => ({ "Target File / PID": name, "Status": "MISSING" }));
        const wsMissing = window.XLSX.utils.json_to_sheet(missingData);
        window.XLSX.utils.book_append_sheet(wb, wsMissing, "Missing_Files");
    }

    if(wb.SheetNames.length === 0) {
        showToast("No data to generate manifest.", "error");
        return;
    }

    const wbOut = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: "application/octet-stream" });
    triggerDownload(blob, "Batcher_Manifest_Report.xlsx");
}
