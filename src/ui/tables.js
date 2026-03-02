/**
 * src/ui/tables.js
 * Mengatur semua logika yang berkaitan dengan tabel:
 * - Filter & Pencarian Tabel Antrean Utama
 * - Rendering Tabel Data Display Ring
 * - Rendering Tabel Data Tenant (beserta Pagination)
 * - Rendering Tabel Error/Warning Log
 * - FITUR BARU: Edit Mode & Smart Group Drag-and-Drop Reordering
 */

import { appState } from '../state/store.js';
import { showToast } from './modals.js';

// --- STATE EDIT MODE ---
export let isEditMode = false;
let dragSrcIndex = -1;

export function toggleEditMode() {
    isEditMode = !isEditMode;
    const btnViz = document.getElementById('btnToggleEditViz');
    
    if (btnViz) {
        if (isEditMode) {
            btnViz.classList.add('bg-blue-100', 'border-blue-300', 'shadow-inner', 'dark:bg-blue-900/40');
            btnViz.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Exit Edit Mode`;
            showToast("Edit Mode Aktif. Anda dapat mengetik di dalam tabel dan men-drag baris.", "info");
        } else {
            btnViz.classList.remove('bg-blue-100', 'border-blue-300', 'shadow-inner', 'dark:bg-blue-900/40');
            btnViz.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Toggle Edit Mode`;
            showToast("Edit Mode Dinonaktifkan.", "info");
        }
    }
    
    // Render ulang tabel agar masuk/keluar dari mode edit secara visual
    const currentFileName = appState.processedKeys[appState.currentFileIndex];
    if (currentFileName && appState.processed[currentFileName]) {
        const item = appState.processed[currentFileName];
        renderDisplayRingTable(item.displayData);
        renderTablePage();
    }
}

// --- DRAG AND DROP HELPERS ---
function handleDragStart(e, idx) {
    if (!isEditMode) return;
    dragSrcIndex = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    e.currentTarget.classList.add('dragging');
}

function handleDragOver(e) {
    if (!isEditMode) return;
    if (e.preventDefault) e.preventDefault(); // Diperlukan agar bisa di-drop
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (!isEditMode) return;
    e.currentTarget.classList.add('drag-over-bottom');
}

function handleDragLeave(e) {
    if (!isEditMode) return;
    e.currentTarget.classList.remove('drag-over-bottom', 'drag-over-top');
}

function handleDragEnd(e) {
    if (!isEditMode) return;
    e.currentTarget.classList.remove('dragging');
    const rows = e.currentTarget.parentNode.querySelectorAll('tr');
    rows.forEach(r => r.classList.remove('drag-over-bottom', 'drag-over-top'));
}

// --- LOGIKA TABEL ANTREAN UTAMA ---

export function setQueueFilter(status) {
    appState.currentQueueFilter = status; 
    
    ['all', 'pass', 'fail', 'warning'].forEach(s => {
        const btn = document.getElementById(`filter-btn-${s.toLowerCase()}`);
        if(!btn) return;

        if (s.toUpperCase() === status.toUpperCase() || (s === 'all' && status === 'all')) {
            if(s === 'all') btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-white shadow-md transform scale-105 transition-all";
            if(s === 'pass') btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg bg-green-500 text-white shadow-md transform scale-105 transition-all";
            if(s === 'fail') btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg bg-mitratel-red text-white shadow-md transform scale-105 transition-all";
            if(s === 'warning') btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-500 text-white shadow-md transform scale-105 transition-all";
        } else {
            btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-all";
        }
    });

    filterQueueTable();
}

export function filterQueueTable() {
    const input = document.getElementById('queueSearch');
    if (!input) return;
    
    const filter = input.value.toUpperCase();
    const table = document.getElementById('result-body');
    if (!table) return;
    
    const tr = table.getElementsByTagName('tr');
    const currentQueueFilter = appState.currentQueueFilter || 'all';

    for (let i = 0; i < tr.length; i++) {
        const tdName = tr[i].getElementsByTagName("td")[1]; 
        const tdStatus = tr[i].getElementsByTagName("td")[2]; 
        
        if (tdName && tdStatus) {
            const txtValue = tdName.textContent || tdName.innerText;
            const statusText = tdStatus.textContent || tdStatus.innerText;
            
            const matchesSearch = txtValue.toUpperCase().indexOf(filter) > -1;
            let matchesFilter = true;

            if (currentQueueFilter !== 'all') {
                if (!statusText.toUpperCase().includes(currentQueueFilter.toUpperCase())) {
                    matchesFilter = false;
                }
            }

            if (matchesSearch && matchesFilter) {
                tr[i].style.display = "";
                tr[i].classList.add("animate-fade-in");
            } else {
                tr[i].style.display = "none";
                tr[i].classList.remove("animate-fade-in");
            }
        }       
    }
}

// --- LOGIKA TABEL MODAL (VISUALIZER) ---

export function renderDisplayRingTable(displayData) {
    const thead = document.getElementById('display-ring-head');
    const tbody = document.getElementById('display-ring-body');
    if (!thead || !tbody) return;

    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    if (!displayData || displayData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-8 text-center text-gray-400 italic">No Data Available in display_ring</td></tr>';
        return;
    }

    const allKeys = Object.keys(displayData[0]);
    const columns = allKeys.filter(k => k !== 'PID' && k !== 'RING_ID');

    let headerHTML = '<tr>';
    if (isEditMode) {
        headerHTML += `<th class="px-2 py-3 w-10 sticky-header border-b border-gray-100 dark:border-gray-800"></th>`;
    }
    columns.forEach(col => {
        headerHTML += `<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky-header border-b border-gray-100 dark:border-gray-800">${col.replace(/_/g, ' ')}</th>`;
    });
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;

    displayData.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition";
        
        // Setup Drag and Drop events if Edit Mode
        if (isEditMode) {
            tr.draggable = true;
            tr.addEventListener('dragstart', (e) => handleDragStart(e, idx));
            tr.addEventListener('dragover', handleDragOver);
            tr.addEventListener('dragenter', handleDragEnter);
            tr.addEventListener('dragleave', handleDragLeave);
            tr.addEventListener('dragend', handleDragEnd);
            tr.addEventListener('drop', (e) => {
                if (!isEditMode) return;
                e.stopPropagation();
                if (dragSrcIndex !== idx) {
                    const itemToMove = displayData.splice(dragSrcIndex, 1)[0];
                    displayData.splice(idx, 0, itemToMove);
                    renderDisplayRingTable(displayData); // Rerender
                }
                return false;
            });
            
            // Kolom icon Drag Handle
            const tdDrag = document.createElement('td');
            tdDrag.className = "px-2 py-2 border-b border-gray-50 dark:border-gray-800 text-center drag-handle select-none";
            tdDrag.innerHTML = '<i class="fa-solid fa-grip-lines"></i>';
            tr.appendChild(tdDrag);
        }

        columns.forEach(col => {
            const td = document.createElement('td');
            td.className = "px-4 py-2 border-b border-gray-50 dark:border-gray-800 text-slate-600 dark:text-gray-300 whitespace-nowrap";
            td.innerText = row[col] || '-';
            
            // Setup Content Editable if Edit Mode
            if (isEditMode) {
                td.contentEditable = "true";
                td.addEventListener('blur', (e) => {
                    let newVal = e.target.innerText.trim();
                    if(newVal === '-') newVal = '';
                    if(row[col] !== newVal) row[col] = newVal;
                });
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

export function renderErrorTable(errors) {
    const tbody = document.getElementById('error-table-body');
    const badge = document.getElementById('error-badge');
    const countDisplay = document.getElementById('error-count-display');
    
    if (!tbody || !badge || !countDisplay) return;

    tbody.innerHTML = '';
    
    if(!errors || errors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="px-6 py-12 text-center text-gray-400 italic"><i class="fa-solid fa-check-circle text-4xl text-green-100 mb-2 block"></i>No validation issues found</td></tr>`;
        badge.classList.add('hidden');
        badge.innerText = '0';
        countDisplay.innerText = '0 Issues Found';
        countDisplay.className = "text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 px-3 py-1 rounded-full font-medium";
        return;
    }

    badge.classList.remove('hidden');
    badge.innerText = errors.length;
    countDisplay.innerText = `${errors.length} Issues Found`;
    countDisplay.className = "text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-3 py-1 rounded-full font-medium";

    errors.forEach(err => {
        const tr = document.createElement('tr');
        const isWarning = (err.Rule === "R18_HIGH_OCCUPANCY" || err.Rule === "R20_DISPLAY_CHAIN" || err.Rule === "R16_ANTI_SPLIT_WARN" || err.Rule === "R19_CONNECTIVITY");
        const rowClass = isWarning ? "hover:bg-orange-50 dark:hover:bg-orange-900/10" : "hover:bg-red-50 dark:hover:bg-red-900/10";
        const textClass = isWarning ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400";

        tr.className = `${rowClass} transition border-b border-gray-100 dark:border-gray-800`;
        tr.innerHTML = `
            <td class="px-6 py-3 text-sm font-mono text-slate-500 dark:text-gray-400">${err.Row}</td>
            <td class="px-6 py-3 text-sm font-bold ${textClass}">${err.Rule}</td>
            <td class="px-6 py-3 text-sm text-slate-700 dark:text-gray-300">${err.Message}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- LOGIKA TENANT DATA (PAGINATION & FILTER) ---

export function setLenFilter(len) {
    appState.currentLenFilter = len;
    ['all', '17', '21', '26', '30'].forEach(l => {
        const btn = document.getElementById(`len-btn-${l}`);
        if(!btn) return;
        if(l === len) {
            btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg bg-mitratel-red text-white transition shadow-sm whitespace-nowrap";
        } else {
            btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition whitespace-nowrap";
        }
    });
    filterTable();
}

export function filterTable(keepPage = false) {
    const input = document.getElementById('tableSearch');
    const term = input ? input.value.toLowerCase() : '';
    const lenFilter = appState.currentLenFilter;

    appState.filteredData = appState.currentData.filter(row => {
        const strno = String(row.STRNO || "").toLowerCase();
        const pltxt = String(row.PLTXT || "").toLowerCase();
        const stort = String(row.STORT || "").toLowerCase();
        const arbpl = String(row.ARBPL || "").toLowerCase();

        const matchesText = strno.includes(term) || 
                            pltxt.includes(term) ||
                            stort.includes(term) || 
                            arbpl.includes(term);

        let matchesLen = true;
        if (lenFilter !== 'all') {
            matchesLen = (strno.length === parseInt(lenFilter));
        }

        return matchesText && matchesLen;
    });

    if (!keepPage) appState.currentPage = 1;
    renderTablePage();
    updatePaginationInfo();
}

export function changePage(delta) {
    const maxPage = Math.ceil(appState.filteredData.length / appState.rowsPerPage);
    const newPage = appState.currentPage + delta;
    if (newPage >= 1 && newPage <= maxPage) {
        appState.currentPage = newPage;
        renderTablePage();
        updatePaginationInfo();
    }
}

export function updatePaginationInfo() {
    const total = appState.filteredData.length;
    const start = total === 0 ? 0 : (appState.currentPage - 1) * appState.rowsPerPage + 1;
    const end = Math.min(appState.currentPage * appState.rowsPerPage, total);
    
    const elTotal = document.getElementById('totalRows');
    const elStart = document.getElementById('showStart');
    const elEnd = document.getElementById('showEnd');
    const elPage = document.getElementById('pageIndicator');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');

    if(elTotal) elTotal.innerText = total;
    if(elStart) elStart.innerText = start;
    if(elEnd) elEnd.innerText = end;
    if(elPage) elPage.innerText = `Page ${appState.currentPage}`;
    
    if(btnPrev) {
        btnPrev.disabled = appState.currentPage === 1;
        btnPrev.classList.toggle('opacity-50', appState.currentPage === 1);
    }
    
    if(btnNext) {
        const maxPage = Math.ceil(total / appState.rowsPerPage);
        btnNext.disabled = appState.currentPage >= maxPage || maxPage === 0;
        btnNext.classList.toggle('opacity-50', appState.currentPage >= maxPage || maxPage === 0);
    }
}

export function renderTablePage() {
    const tbody = document.getElementById('data-table-body');
    const thead = document.getElementById('data-table-head');
    if (!tbody) return;

    // Inject/Remove header drag column untuk mode edit
    if (thead) {
        const trHead = thead.querySelector('tr');
        if (trHead) {
            const existingHandle = trHead.querySelector('.edit-handle-th');
            if (isEditMode && !existingHandle) {
                const th = document.createElement('th');
                th.className = "py-3 px-2 w-10 edit-handle-th sticky-header border-b border-gray-100 dark:border-gray-800";
                trHead.insertBefore(th, trHead.firstChild);
            } else if (!isEditMode && existingHandle) {
                existingHandle.remove();
            }
        }
    }

    tbody.innerHTML = "";
    const startIdx = (appState.currentPage - 1) * appState.rowsPerPage;
    const pageData = appState.filteredData.slice(startIdx, startIdx + appState.rowsPerPage);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-400 italic">No data found matching your search</td></tr>`;
        return;
    }

    pageData.forEach((row, idx) => {
        const tr = document.createElement('tr');
        const pltxt = String(row.PLTXT || "");
        const isMatch = appState.targetPID && pltxt.includes(appState.targetPID);
        
        if (isMatch && !isEditMode) tr.classList.add('row-highlight');
        else if (isMatch && isEditMode) tr.classList.add('bg-red-50/30', 'dark:bg-red-900/10'); // Highlight lebih soft di mode edit
        
        if (isEditMode) {
            tr.draggable = true;
            tr.addEventListener('dragstart', (e) => handleDragStart(e, idx));
            tr.addEventListener('dragover', handleDragOver);
            tr.addEventListener('dragenter', handleDragEnter);
            tr.addEventListener('dragleave', handleDragLeave);
            tr.addEventListener('dragend', handleDragEnd);
            tr.addEventListener('drop', (e) => {
                if (!isEditMode) return;
                e.stopPropagation();
                
                if (dragSrcIndex !== idx) {
                    const srcObj = pageData[dragSrcIndex];
                    const targetObj = pageData[idx];
                    
                    const srcStrno = String(srcObj.STRNO || "");
                    const targetStrno = String(targetObj.STRNO || "");

                    // 1. Kumpulkan semua row untuk dipindahkan & row yang tersisa
                    const itemsToMove = [];
                    const remainingData = [];
                    for (let i = 0; i < appState.currentData.length; i++) {
                        if (String(appState.currentData[i].STRNO || "").startsWith(srcStrno)) {
                            itemsToMove.push(appState.currentData[i]);
                        } else {
                            remainingData.push(appState.currentData[i]);
                        }
                    }

                    // 2. Modifikasi Array secara IN-PLACE. 
                    // Ini penting agar referensi memori global (item.belowData) ikut berubah
                    appState.currentData.length = 0; 
                    appState.currentData.push(...remainingData);

                    // 3. Cari posisi global (index) dari target drop di array yang sudah dikurangi tadi
                    let targetGlobalIdx = appState.currentData.findIndex(item => item === targetObj);

                    if (targetGlobalIdx > -1) {
                        // Jika arah drag ke Bawah (index awal lebih kecil dari index drop di UI)
                        if (dragSrcIndex < idx) {
                            // Kita harus melewati target beserta seluruh "anak-anak" dari target tersebut
                            // agar grup yang ditarik ditempatkan tepat SETELAH grup target
                            let lastChildIdx = targetGlobalIdx;
                            while (lastChildIdx + 1 < appState.currentData.length && 
                                   String(appState.currentData[lastChildIdx + 1].STRNO || "").startsWith(targetStrno)) {
                                lastChildIdx++;
                            }
                            targetGlobalIdx = lastChildIdx + 1; // Posisi insert setelah anak target terakhir
                        }
                        
                        // 4. Masukkan kembali grup data ke posisi barunya secara IN-PLACE
                        appState.currentData.splice(targetGlobalIdx, 0, ...itemsToMove);
                    } else {
                        // Fallback jika targetObj tidak ketemu
                        appState.currentData.push(...itemsToMove);
                    }

                    // Render ulang dan terapkan filter
                    filterTable(true); 
                }
                return false;
            });
        }

        // Helper string
        let tdDrag = isEditMode ? `<td class="py-2 px-2 border-b border-gray-50 dark:border-gray-800 text-center drag-handle select-none"><i class="fa-solid fa-grip-lines"></i></td>` : '';
        const buildCell = (val, key, extClass = "") => {
            return `<td class="py-2 px-6 border-b border-gray-50 dark:border-gray-800 text-sm ${extClass}" ${isEditMode ? `contenteditable="true" data-key="${key}"` : ''}>${val || '-'}</td>`;
        };

        tr.innerHTML = `
            ${tdDrag}
            ${buildCell(row.STRNO, 'STRNO', 'font-mono text-slate-600 dark:text-gray-300')}
            ${buildCell(row.ABCKZ, 'ABCKZ', 'text-slate-800 dark:text-white font-medium')}
            ${buildCell(row.PLTXT, 'PLTXT', isMatch && !isEditMode ? 'font-bold text-mitratel-red' : 'text-slate-800 dark:text-white')}
            ${buildCell(row.STORT, 'STORT', 'text-slate-500 dark:text-gray-400')}
            ${buildCell(row.ARBPL, 'ARBPL', 'text-slate-500 dark:text-gray-400')}
        `;

        if (isEditMode) {
            tr.querySelectorAll('td[contenteditable="true"]').forEach(td => {
                td.addEventListener('blur', (e) => {
                    const key = td.getAttribute('data-key');
                    let newVal = e.target.innerText.trim();
                    if (newVal === '-') newVal = '';
                    
                    if (row[key] !== newVal) {
                        row[key] = newVal;
                        if (key === 'STRNO') {
                            row.STRNO_LENGTH = newVal.length; // Otomatis perbarui STRNO_LENGTH jika diubah
                        }
                    }
                });
            });
        }

        tbody.appendChild(tr);
    });
}

// Inisialisasi event listener untuk elemen-elemen UI tabel
export function initTableEvents() {
    // Queue filter events
    ['all', 'pass', 'warning', 'fail'].forEach(status => {
        const btn = document.getElementById(`filter-btn-${status}`);
        if(btn) btn.addEventListener('click', () => setQueueFilter(status));
    });

    const queueSearch = document.getElementById('queueSearch');
    if(queueSearch) queueSearch.addEventListener('keyup', filterQueueTable);

    // Tenant data filter events
    ['all', '17', '21', '26', '30'].forEach(len => {
        const btn = document.getElementById(`len-btn-${len}`);
        if(btn) btn.addEventListener('click', () => setLenFilter(len));
    });

    const tableSearch = document.getElementById('tableSearch');
    if(tableSearch) tableSearch.addEventListener('keyup', () => filterTable(false));

    const btnPrev = document.getElementById('btnPrev');
    if(btnPrev) btnPrev.addEventListener('click', () => changePage(-1));

    const btnNext = document.getElementById('btnNext');
    if(btnNext) btnNext.addEventListener('click', () => changePage(1));
}
