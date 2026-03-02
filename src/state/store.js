/**
 * src/state/store.js
 * Menyimpan seluruh state/data global yang sedang berjalan di aplikasi.
 * Dengan memisahkannya ke sini, file UI dan Validator tidak akan berebut variabel global.
 */

// State untuk tab Validator
export const appState = {
    queue: [],
    processed: {}, 
    processedKeys: [], 
    currentData: [],
    filteredData: [],
    currentPage: 1,
    rowsPerPage: 100,
    targetPID: "",
    currentFileIndex: -1, 
    stats: { total: 0, pass: 0, fail: 0, warning: 0 },
    workCenterData: new Map(),
    currentLenFilter: 'all'
};

// State untuk tab Batcher
export const batcherState = {
    targetFiles: new Set(),
    folderMap: new Map(),
    batches: [],
    matchCount: 0,
    missingCount: 0,
    missingFiles: [] 
};

// Fungsi helper untuk mereset data validator secara aman
export function clearValidatorState() {
    appState.queue = [];
    appState.processed = {};
    appState.processedKeys = [];
    appState.stats = { total: 0, pass: 0, fail: 0, warning: 0 };
}

// Fungsi helper untuk menghitung ulang statistik (dipakai saat Force Override Status)
export function recalculateStats() {
    let total = 0, pass = 0, fail = 0, warning = 0;
    Object.values(appState.processed).forEach(item => {
        total++;
        if (item.status === 'PASS') pass++;
        else if (item.status === 'WARNING') warning++;
        else fail++;
    });
    appState.stats = { total, pass, fail, warning };
}