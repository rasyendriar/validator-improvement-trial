/**
 * src/workers/excelWorker.js
 * Web Worker untuk memproses file Excel di background thread.
 * Menggunakan Classic Script dengan importScripts untuk kompatibilitas GitHub Pages.
 */

// 1. Import SheetJS
importScripts('https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js');

// 2. Import Rule Engine dari file eksternal
// Menggunakan trik sederhana untuk memuat file JS lokal ke dalam global scope worker
importScripts('../rules/coreRules.js');

// --- Helper Functions ---
const excelRow = (i) => i + 2;

function sanitizeForTsvCell(val) {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/\t/g, ' ')
        .replace(/\r?\n/g, ' ')
        .trim();
}

function buildSapTxtFromRows(rows, headerOrder) {
    if (!rows || rows.length === 0) return '';
    const cols = headerOrder && headerOrder.length ? headerOrder : Object.keys(rows[0]);
    const headerLine = cols.join('\t');
    const bodyLines = rows.map(r => cols.map(c => sanitizeForTsvCell(r[c])).join('\t'));
    return [headerLine, ...bodyLines].join('\r\n');
}

// --- Worker Message Receiver ---
self.onmessage = function(e) {
    const { fileBuffer, fileName, anchorPid, workCenterMap } = e.data;
    
    try {
        // Parsing Workbook
        const workbook = XLSX.read(fileBuffer, { type: 'array' });
        
        if (!workbook.SheetNames.includes('below_ring')) {
            throw new Error("Sheet 'below_ring' tidak ditemukan.");
        }
        
        let rawBelow = XLSX.utils.sheet_to_json(workbook.Sheets['below_ring'], { defval: "" });
        
        let belowData = rawBelow.map((r, idx) => {
            const newRow = {};
            Object.keys(r).forEach(k => {
                const upperK = k.toUpperCase().trim();
                if (['PID', 'RING_ID'].includes(upperK)) return; 
                newRow[upperK] = r[k];
            });
            return newRow;
        });

        const required = ['STRNO', 'PLTXT', 'ABCKZ'];
        const missing = required.filter(c => !Object.keys(belowData[0] || {}).includes(c));
        if (missing.length) throw new Error(`Kolom hilang di below_ring: ${missing.join(', ')}`);

        belowData.sort((a, b) => String(a.STRNO || "").localeCompare(String(b.STRNO || "")));

        let displayData = [];
        if (workbook.SheetNames.includes('display_ring')) {
            const rawDisplay = XLSX.utils.sheet_to_json(workbook.Sheets['display_ring'], { defval: "" });
            displayData = rawDisplay.map(r => {
                const newRow = {};
                Object.keys(r).forEach(k => newRow[k.toUpperCase().trim()] = r[k]);
                return newRow;
            });
        }

        // Persiapkan Konteks untuk Rule Engine
        const context = {
            anchorPid,
            workCenterMap,
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

        // Eksekusi Validasi via fungsi global dari coreRules.js
        belowData.forEach((r, idx) => {
            r._rowIndex = idx + 2; 
            const s = String(r.STRNO || "");
            const len = (s.toLowerCase() === "<na>" || s === "") ? 0 : s.length;
            r.STRNO_LENGTH = len;
            if (len === 17) r.PLTXT = s; 

            // Panggil fungsi engine dari coreRules.js (sudah masuk ke self/global worker)
            if(self.runRowRules) self.runRowRules(r, context);
        });

        if(self.runPostProcessRules) self.runPostProcessRules(belowData, displayData, context);

        // Tentukan Status Akhir
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

        postMessage({
            success: true,
            fileName: fileName,
            pid: anchorPid,
            belowData: belowData,
            displayData: displayData,
            status: statusStr,
            errors: context.errors,
            warnings: context.warnings,
            sapTxt: sapTxt
        });

    } catch (err) {
        postMessage({
            success: false,
            fileName: fileName,
            error: err.message
        });
    }
};
