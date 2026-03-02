/**
 * src/workers/excelWorker.js
 * Web Worker untuk memproses file Excel di background thread.
 * Mencegah UI / Browser freeze saat memproses puluhan/ratusan file sekaligus.
 */

// Import SheetJS di dalam worker
importScripts('https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js');

// --- Helper Functions (Di-copy ke dalam worker agar mandiri) ---
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
        // 1. Parsing Workbook
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

        // Sort Data pada pemrosesan AWAL
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

        // 2. Eksekusi Validasi (Rules R5 - R20)
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

            if (len === 26) {
                const match = strno.match(/^(.+?)([A-Z]+)(\d+)$/); 
                if (match) {
                    const groupKey = match[1] + match[2]; 
                    const numVal = parseInt(match[3], 10);
                    if (!r17MaterialGroups[groupKey]) r17MaterialGroups[groupKey] = [];
                    r17MaterialGroups[groupKey].push({ num: numVal, row: r._rowIndex, strno: strno });
                }
            }

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

            // Validasi dengan Map yang dikirim dari main thread
            if (workCenterMap && Object.keys(workCenterMap).length > 0) {
                const stort = String(r.STORT || "").trim();
                const arbpl = String(r.ARBPL || "").trim();
                if (stort && workCenterMap[stort]) {
                    const expectedArbpl = workCenterMap[stort];
                    if (arbpl !== expectedArbpl) {
                        errors.push({ Rule: "R12_WORK_CENTER", Row: r._rowIndex, Message: `STORT '${stort}' requires ARBPL '${expectedArbpl}', but found '${arbpl}'` });
                    }
                }
            }
        });

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

        let statusStr = "PASS";
        if (errors.length > 0) statusStr = "FAIL";
        else if (warnings.length > 0) statusStr = "WARNING";

        // Generate SAP TXT Data di Worker
        const exportBelowData = belowData.map(r => {
            const { STRNO_LENGTH, _rowIndex, ...rest } = r;
            return rest;
        });
        const allKeys = Object.keys(exportBelowData[0] || {});
        const headerOrder = ['STRNO', ...allKeys.filter(k => k!=='STRNO')]; 
        const sapTxt = buildSapTxtFromRows(exportBelowData, headerOrder);

        // 3. Kembalikan Hasil ke Main Thread (TANPA OBJEK WORKBOOK)
        postMessage({
            success: true,
            fileName: fileName,
            pid: anchorPid,
            belowData: belowData,
            displayData: displayData,
            status: statusStr,
            errors: errors,
            warnings: warnings,
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
