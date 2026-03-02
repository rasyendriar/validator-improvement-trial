/**
 * src/utils/helpers.js
 * Kumpulan fungsi-fungsi murni (pure functions) yang dipakai untuk pengolahan string,
 * regex, dan pembersihan data.
 */

// Cek apakah string kosong
export const isEmpty = (x) => (x === null || x === undefined || String(x).trim() === "");

// Helper untuk offset baris Excel (header = row 1, data mulai row 2)
export const excelRow = (i) => i + 2;

/**
 * Mengekstrak Anchor PID (ex: 22IS12T0097) dari nama file Excel (Rule 13)
 * @param {string} filename 
 * @returns {string} PID bersih
 */
export function extractAnchorPid(filename) {
    const nameBase = filename.replace(/\.[^/.]+$/, ""); // Hapus ekstensi
    
    // Coba gunakan Regex standar PID Mitratel (misal: 22IS12T0097)
    const pidMatch = nameBase.match(/\b\d{2}[A-Z]{2}\d{2}[A-Z]\d{4}\b/i);
    if (pidMatch) {
        return pidMatch[0].toUpperCase();
    }
    
    // Fallback: Jika tidak cocok regex, bersihkan suffix/prefix secara manual
    let clean = nameBase.toUpperCase();
    clean = clean.replace(/^VALIDATED_/, '');
    clean = clean.replace(/^REVISI_/, '');
    clean = clean.replace(/_VALIDATED$/, '');
    clean = clean.replace(/_REVISI$/, '');
    clean = clean.replace(/_FINAL$/, '');

    return clean;
}

/**
 * Membersihkan karakter Enter atau Tab agar tidak merusak format TSV/TXT (SAP Text)
 */
export function sanitizeForTsvCell(val) {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/\t/g, ' ')
        .replace(/\r?\n/g, ' ')
        .trim();
}

/**
 * Membangun format string TXT (Tab Separated) untuk SAP
 * @param {Array} rows - Data array of object
 * @param {Array} headerOrder - Urutan kolom header
 */
export function buildSapTxtFromRows(rows, headerOrder) {
    if (!rows || rows.length === 0) return '';
    const cols = headerOrder && headerOrder.length ? headerOrder : Object.keys(rows[0]);
    const headerLine = cols.join('\t');
    const bodyLines = rows.map(r => cols.map(c => sanitizeForTsvCell(r[c])).join('\t'));
    return [headerLine, ...bodyLines].join('\r\n');
}