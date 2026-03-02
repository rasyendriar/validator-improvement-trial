/**
 * src/services/batcherService.js
 * Menangani fungsi pencocokan data Master dengan file yang ada di folder (Batcher).
 */

import { batcherState } from '../state/store.js';
import { handleFiles } from './validatorService.js';
import { showToast } from '../ui/modals.js';

function normalizeName(name) {
    return name.replace(/\.(xlsx|xls|csv)$/i, '').trim().toUpperCase();
}

export function initBatcher() {
    const masterInput = document.getElementById('batchMasterInput');
    const folderInput = document.getElementById('batchFolderInput');
    const btnRunMatcher = document.getElementById('btnRunMatcher');

    if(masterInput) {
        masterInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            batcherState.targetFiles.clear();
            let targets = [];

            if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
                const text = await file.text();
                const lines = text.split(/[\r\n]+/);
                lines.forEach(line => {
                     const token = line.split(/[;,]/)[0].trim();
                     if(token) targets.push(token);
                });
            } else {
                const ab = await file.arrayBuffer();
                const wb = window.XLSX.read(ab, {type: 'array'});
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = window.XLSX.utils.sheet_to_json(ws, {header: 1});
                data.forEach(row => {
                    if(row[0]) targets.push(String(row[0]).trim());
                });
            }
            
            targets.forEach(t => batcherState.targetFiles.add(normalizeName(t)));
            
            document.getElementById('masterCount').innerText = batcherState.targetFiles.size;
            document.getElementById('masterListStat').classList.remove('hidden');
        });
    }

    if(folderInput) {
        folderInput.addEventListener('change', (e) => {
            batcherState.folderMap.clear();
            const files = Array.from(e.target.files);
            
            files.forEach(f => {
                if(f.name.match(/\.(xls|xlsx)$/i) && !f.name.startsWith("~$")) {
                    const key = normalizeName(f.name);
                    batcherState.folderMap.set(key, f);
                }
            });

            document.getElementById('folderCount').innerText = batcherState.folderMap.size;
            document.getElementById('folderStat').classList.remove('hidden');
        });
    }

    if(btnRunMatcher) {
        btnRunMatcher.addEventListener('click', runBatchMatching);
    }
}

export function runBatchMatching() {
    if (batcherState.targetFiles.size === 0) {
        alert("Please upload a Master List first.");
        return;
    }
    if (batcherState.folderMap.size === 0) {
        alert("Please select a Source Folder first.");
        return;
    }

    const batchSize = parseInt(document.getElementById('batchSizeInput').value) || 50;
    const foundFiles = [];
    batcherState.missingFiles = []; 
    let missing = 0;

    batcherState.targetFiles.forEach(target => {
        if (batcherState.folderMap.has(target)) {
            foundFiles.push(batcherState.folderMap.get(target));
        } else {
            missing++;
            batcherState.missingFiles.push(target);
        }
    });

    document.getElementById('matchCount').innerText = foundFiles.length;
    document.getElementById('missingCount').innerText = missing;
    batcherState.matchCount = foundFiles.length;
    batcherState.missingCount = missing;

    if (missing > 0) {
        document.getElementById('btnViewMissing').classList.remove('hidden');
    } else {
        document.getElementById('btnViewMissing').classList.add('hidden');
    }

    batcherState.batches = [];
    for (let i = 0; i < foundFiles.length; i += batchSize) {
        batcherState.batches.push(foundFiles.slice(i, i + batchSize));
    }

    document.getElementById('batchCountDisplay').innerText = batcherState.batches.length;
    renderBatchList();
    
    if(foundFiles.length > 0) {
         document.getElementById('btnSendAllBatch').classList.remove('hidden');
         document.getElementById('btnDownloadManifest').classList.remove('hidden');
    } else {
         document.getElementById('btnSendAllBatch').classList.add('hidden');
         if(missing === 0) {
             document.getElementById('btnDownloadManifest').classList.add('hidden');
         } else {
             document.getElementById('btnDownloadManifest').classList.remove('hidden');
         }
    }
}

export function viewMissingFiles() {
    const listContainer = document.getElementById('missingFilesList');
    if(!listContainer) return;

    listContainer.innerHTML = '';
    
    batcherState.missingFiles.forEach(name => {
        const li = document.createElement('li');
        li.className = "border-b border-gray-100 dark:border-gray-800 last:border-0 py-1";
        li.textContent = name;
        listContainer.appendChild(li);
    });
    
    document.getElementById('missingFilesModal').classList.remove('hidden');
}

export function renderBatchList() {
    const container = document.getElementById('batchListContainer');
    if(!container) return;

    container.innerHTML = '';

    if (batcherState.batches.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-10 italic">No matches found based on current inputs.</div>';
        return;
    }

    batcherState.batches.forEach((batch, index) => {
        const div = document.createElement('div');
        div.className = "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex justify-between items-center shadow-sm hover:shadow-md transition";
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 flex items-center justify-center font-bold text-xs">
                    ${index + 1}
                </div>
                <div>
                    <h4 class="text-sm font-bold text-slate-700 dark:text-gray-200">Batch #${index + 1}</h4>
                    <p class="text-xs text-gray-400">${batch.length} files</p>
                </div>
            </div>
            <button onclick="window.appActions.sendBatchToValidator(${index})" class="bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-xs font-semibold px-3 py-1.5 rounded border border-blue-100 dark:border-blue-900/30 transition">
                Process <i class="fa-solid fa-arrow-right ml-1"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

export function sendBatchToValidator(batchIndex) {
    let filesToSend = [];
    if (batchIndex === 'all') {
        if(!confirm("Are you sure you want to process ALL " + batcherState.matchCount + " files? This might take a while.")) return;
        batcherState.batches.forEach(b => filesToSend.push(...b));
    } else {
        filesToSend = batcherState.batches[batchIndex];
    }

    if (!filesToSend || filesToSend.length === 0) return;

    document.getElementById('tabBtnValidator').click();
    handleFiles(filesToSend);
    
    showToast(`Transferred ${filesToSend.length} files to Validator Queue`, 'success');
}