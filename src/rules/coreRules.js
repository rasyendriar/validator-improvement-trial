/**
 * src/rules/coreRules.js
 * Kumpulan fungsi validasi (Rule Engine).
 * Dimodifikasi agar kompatibel dipanggil via `importScripts` di Worker,
 * sekaligus bisa di-import biasa di validatorService.js.
 */

const RuleEngine = {};

RuleEngine.validateR5Length = (row) => {
    const s = String(row.STRNO || "").trim();
    const len = row.STRNO_LENGTH;
    const allowed = [17, 21, 26, 30];
    
    if (!allowed.includes(len)) {
        return { isValid: false, isError: true, Rule: "R5_LENGTH", Message: `Panjang ${len} tidak valid. STRNO: ${s}` };
    }
    return { isValid: true };
};

RuleEngine.validateR7Abckz = (row) => {
    const s = String(row.STRNO || "").trim();
    const len = row.STRNO_LENGTH;
    const abckz = String(row.ABCKZ || "").trim().toUpperCase();
    
    const baseMap = { 17: "P", 21: "S", 30: "O" };
    if (baseMap[len]) {
        if (abckz !== baseMap[len]) {
            return { isValid: false, isError: true, Rule: "R7_ABCKZ", Message: `Len ${len} harus ABCKZ='${baseMap[len]}', tapi tertulis '${abckz}'` };
        }
    } else if (len === 26) {
        if (s.length >= 4) {
            const code = s.slice(-4, -2).toUpperCase();
            const suffixMap = {"KU": "U", "JC": "R", "OB": "B", "OP": "L", "OC": "M", "OL": "J", "KT": "N", "TP": "H"};
            if (suffixMap[code] && abckz !== suffixMap[code]) {
                return { isValid: false, isError: true, Rule: "R7_ABCKZ", Message: `Len 26 (Code ${code}) harus ABCKZ='${suffixMap[code]}', tapi tertulis '${abckz}'` };
            }
        }
    }
    return { isValid: true };
};

RuleEngine.validateR9Duplicate = (row, context) => {
    const s = String(row.STRNO || "").trim();
    if (context.seenStrno.has(s)) {
        context.duplicates.add(s);
        return { isValid: false, isError: true, Rule: "R9_DUPLICATE", Message: `Duplikat STRNO: ${s}` };
    }
    context.seenStrno.add(s);
    return { isValid: true };
};

RuleEngine.validateR12WorkCenter = (row, context) => {
    const workCenterMap = context.workCenterMap;
    if (!workCenterMap || Object.keys(workCenterMap).length === 0) return { isValid: true };
    
    const stort = String(row.STORT || "").trim();
    const arbpl = String(row.ARBPL || "").trim();
    
    if (stort && workCenterMap[stort]) {
        const expectedArbpl = workCenterMap[stort];
        if (arbpl !== expectedArbpl) {
            return { isValid: false, isError: true, Rule: "R12_WORK_CENTER", Message: `STORT '${stort}' requires ARBPL '${expectedArbpl}', but found '${arbpl}'` };
        }
    }
    return { isValid: true };
};

RuleEngine.collectR16AndR18Data = (row, context) => {
    const strno = String(row.STRNO || "").trim();
    const pltxt = String(row.PLTXT || "").trim();
    const len = row.STRNO_LENGTH;
    
    if (len === 30) {
        const segId = strno.substring(0, 26);
        
        if (!context.segmentMap.hasOwnProperty(segId)) {
            context.segmentMap[segId] = false;
            context.segmentOrder.push(segId);
        }
        if (pltxt.toUpperCase().includes(context.anchorPid)) {
            context.segmentMap[segId] = true;
        }

        if (!context.r16Segments[segId]) context.r16Segments[segId] = { sequence: [] };
        const segState = context.r16Segments[segId];
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
                        context.errors.push({ Rule: "R16_ANTI_SPLIT", Row: row._rowIndex, Message: `Error: PID '${pltxt}' terputus oleh core kosong di segmen ${segId}.` });
                    } else {
                        context.warnings.push({ Rule: "R16_ANTI_SPLIT_WARN", Row: row._rowIndex, Message: `Peringatan: PID '${pltxt}' diselingi oleh project lain di segmen ${segId}.` });
                    }
                }
            }
            segState.sequence.push({ pid: normPid, row: row._rowIndex });
        }

        if (pltxt && !pltxt.toUpperCase().includes("KABEL")) {
            const basePid = pltxt.replace(/\[R\]|\(R\)/gi, '').trim().toUpperCase();
            if (!context.r18Occupancy[segId]) context.r18Occupancy[segId] = {};
            context.r18Occupancy[segId][basePid] = (context.r18Occupancy[segId][basePid] || 0) + 1;
        }
    }
    return { isValid: true };
};

RuleEngine.collectR17Data = (row, context) => {
    const strno = String(row.STRNO || "").trim();
    if (row.STRNO_LENGTH === 26) {
        const match = strno.match(/^(.+?)([A-Z]+)(\d+)$/); 
        if (match) {
            const groupKey = match[1] + match[2]; 
            const numVal = parseInt(match[3], 10);
            if (!context.r17MaterialGroups[groupKey]) context.r17MaterialGroups[groupKey] = [];
            context.r17MaterialGroups[groupKey].push({ num: numVal, row: row._rowIndex, strno: strno });
        }
    }
    return { isValid: true };
};

// ==========================================
// ENGINE UTAMA 
// ==========================================

RuleEngine.runRowRules = function(row, context) {
    const rulesToRun = [
        RuleEngine.validateR5Length,
        RuleEngine.validateR7Abckz,
        RuleEngine.validateR9Duplicate,
        RuleEngine.validateR12WorkCenter,
        RuleEngine.collectR16AndR18Data,
        RuleEngine.collectR17Data
    ];

    for (const ruleFunc of rulesToRun) {
        const result = ruleFunc(row, context);
        if (!result.isValid) {
            const report = { Rule: result.Rule, Row: row._rowIndex, Message: result.Message };
            if (result.isError) context.errors.push(report);
            else context.warnings.push(report);
        }
    }
};

RuleEngine.runPostProcessRules = function(belowData, displayData, context) {
    Object.keys(context.r17MaterialGroups).forEach(key => {
        const items = context.r17MaterialGroups[key].sort((a,b) => a.num - b.num);
        if (items.length > 0) {
            if (items[0].num !== 1) {
                context.errors.push({ Rule: "R17_SEQUENTIAL_START", Row: items[0].row, Message: `Urutan aset '${key}' dimulai dari nomor ${items[0].num}, seharusnya 01.` });
            }
            for (let k = 1; k < items.length; k++) {
                const diff = items[k].num - items[k-1].num;
                if (diff > 1) {
                    context.errors.push({ Rule: "R17_SEQUENTIAL_GAP", Row: items[k].row, Message: `Lompatan urutan aset '${key}'. Dari ${items[k-1].strno} langsung ke ${items[k].strno} (Gap detected).` });
                }
            }
        }
    });

    Object.keys(context.r18Occupancy).forEach(segId => {
        const pidCounts = context.r18Occupancy[segId];
        Object.keys(pidCounts).forEach(pid => {
            if (pidCounts[pid] > 4) {
                context.warnings.push({ Rule: "R18_HIGH_OCCUPANCY", Row: `SEGMENT ${segId}`, Message: `PID '${pid}' menggunakan ${pidCounts[pid]} core dalam satu segmen. (Threshold > 4).` });
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
                context.warnings.push({ Rule: "R19_CONNECTIVITY", Row: curr._rowIndex, Message: `Connectivity Terputus: End-Point '${currEndPoint}' pada segmen '${curr.PLTXT}' tidak menyambung dengan Start-Point '${nextStartPoint}' pada segmen '${next.PLTXT}' di baris bawahnya.` });
            }
        } else if (currTxt === "" || nextTxt === "") {
             context.warnings.push({ Rule: "R19_CONNECTIVITY", Row: curr._rowIndex, Message: `Connectivity Terputus: Terdapat kolom PLTXT (Segmen) yang kosong.` });
        }
    }

    if (context.segmentOrder.length > 0) {
        const firstSegId = context.segmentOrder[0];
        if (context.segmentMap[firstSegId] === false) {
            context.errors.push({ Rule: "R14_ANCHOR_START", Row: "FIRST_SEGMENT", Message: `Anchor PID '${context.anchorPid}' wajib ada di Segmen Pertama (${firstSegId}). File ini dimulai dengan project lain/kosong.` });
        }
    }

    context.segmentOrder.forEach(segId => {
        if (context.segmentMap[segId] === false) {
            context.errors.push({ Rule: "R15_ANCHOR_SEGMENT_MISSING", Row: "SEGMENT_CHECK", Message: `Segmen ${segId} tidak memuat Anchor PID '${context.anchorPid}' sama sekali.` });
        }
    });

    let anchorPidFound = false;
    for (const r of belowData) {
        if (r.STRNO_LENGTH === 30 && String(r.PLTXT || "").toUpperCase().trim().includes(context.anchorPid)) {
            anchorPidFound = true;
            break;
        }
    }
    if (!anchorPidFound) {
        context.errors.push({ Rule: "R13_ANCHOR_PID_MISSING", Row: "GLOBAL", Message: `Anchor PID '${context.anchorPid}' (dari Nama File) tidak ditemukan sama sekali pada data Core.` });
    }

    if (displayData && displayData.length) {
        let lastPidCounts = null; 
        let lastCableId = null;
        const colsCheck = ["LINK_DESCRIPTION", "LINK_FRM_FLOC", "LINK_TO_FLOC", "FUNCTIONAL_LOCATION_LINK_OBJECT"];
        
        displayData.forEach((r, i) => {
            const actualRow = i + 2;
            colsCheck.forEach(col => {
                if (r[col]) { 
                    const val = String(r[col] || "").trim();
                    if (val && !context.seenStrno.has(val)) {
                        context.errors.push({ Rule: "R10_CROSS_CHECK", Row: actualRow, Message: `Sheet 'display_ring' kol '${col}': Nilai '${val}' tidak ditemukan di 'below_ring'.` });
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
                                context.errors.push({ Rule: "R11_PID_CONSISTENCY", Row: actualRow, Message: `Inkonsistensi PID ${pid} antar Segmen: ${lastCableId} (${countLast} core) -> ${cableId} (${countCurr} core).` });
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
                context.warnings.push({ Rule: "R20_DISPLAY_CHAIN", Row: i + 2, Message: `Chain Break: 'LINK_FROM_DESC' (${currFrom}) tidak menyambung dari 'LINK_TO_DESC' baris sebelumnya (${prevTo}).` });
            }
        }
    }
};

// Ekspor untuk digunakan di validatorService.js (Main Thread)
export const { runRowRules, runPostProcessRules } = RuleEngine;

// Tempelkan ke global jika dieksekusi di Worker via importScripts
if (typeof self !== 'undefined') {
    self.runRowRules = RuleEngine.runRowRules;
    self.runPostProcessRules = RuleEngine.runPostProcessRules;
}
