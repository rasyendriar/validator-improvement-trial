/**
 * src/services/converterService.js
 * Mengatur UI dan logika pemrosesan pada tab Universal Converter (Merge / Separate).
 */

import { showToast } from '../ui/modals.js';

let filesToProcess = [];
let currentInputMode = 'excel'; 

export function initConverter() {
    const dropZone = document.getElementById('dropZoneConverter');
    const fileInput = document.getElementById('fileInput');
    const clearBtn = document.getElementById('clearBtn');
    const convertBtn = document.getElementById('convertBtn');
    
    const modeExcelBtn = document.getElementById('modeExcel');
    const modeTextBtn = document.getElementById('modeText');
    const modeInputs = document.querySelectorAll('input[name="outputMode"]');
    
    if(modeExcelBtn) modeExcelBtn.addEventListener('click', () => switchSourceMode('excel'));
    if(modeTextBtn) modeTextBtn.addEventListener('click', () => switchSourceMode('text'));

    if(modeInputs) {
        modeInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const filenameContainer = document.getElementById('filenameContainer');
                const customFilenameInput = document.getElementById('customFilename');
                if(e.target.value === 'merge') {
                    filenameContainer.classList.remove('opacity-50', 'pointer-events-none');
                    customFilenameInput.disabled = false;
                } else {
                    filenameContainer.classList.add('opacity-50', 'pointer-events-none');
                    customFilenameInput.disabled = true;
                    customFilenameInput.value = ''; 
                }
            });
        });
    }

    if(dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        });

        dropZone.addEventListener('drop', (e) => handleConverterFiles(e.dataTransfer.files), false);
    }

    if(fileInput) fileInput.addEventListener('change', (e) => handleConverterFiles(e.target.files), false);
    
    if(clearBtn) {
        clearBtn.addEventListener('click', () => {
            filesToProcess = [];
            updateConverterUI();
            const statusLog = document.getElementById('statusLog');
            if(statusLog) {
                statusLog.classList.add('hidden');
                statusLog.innerHTML = '';
            }
        });
    }

    if(convertBtn) {
        convertBtn.addEventListener('click', runConversion);
    }
    
    // Ekspos removeFile ke window karena dirender via innerHTML
    window.appActions = window.appActions || {};
    window.appActions.removeConverterFile = (index) => {
        filesToProcess.splice(index, 1);
        updateConverterUI();
    };
}

function switchSourceMode(mode) {
    currentInputMode = mode;
    filesToProcess = [];
    updateConverterUI();
    
    const statusLog = document.getElementById('statusLog');
    if(statusLog) {
        statusLog.classList.add('hidden');
        statusLog.innerHTML = '';
    }

    const modeExcelBtn = document.getElementById('modeExcel');
    const modeTextBtn = document.getElementById('modeText');
    const fileInput = document.getElementById('fileInput');
    const acceptText = document.getElementById('acceptText');
    const dropIcon = document.getElementById('dropIcon');

    const activeClass = ['border-2', 'border-mitratel-red', 'bg-red-50', 'dark:bg-red-900/10', 'text-mitratel-red', 'font-semibold'];
    const inactiveClass = ['border', 'border-gray-200', 'dark:border-gray-700', 'text-gray-500', 'dark:text-gray-400'];

    if (mode === 'excel') {
        modeExcelBtn.classList.add(...activeClass);
        modeExcelBtn.classList.remove(...inactiveClass);
        modeTextBtn.classList.remove(...activeClass);
        modeTextBtn.classList.add(...inactiveClass);
        
        if(fileInput) fileInput.accept = ".xlsx, .xls";
        if(acceptText) acceptText.innerText = "Accepts multiple .xlsx files";
        if(dropIcon) dropIcon.className = "fa-solid fa-file-excel text-4xl text-emerald-500 mb-3 transition-colors";
    } else {
        modeTextBtn.classList.add(...activeClass);
        modeTextBtn.classList.remove(...inactiveClass);
        modeExcelBtn.classList.remove(...activeClass);
        modeExcelBtn.classList.add(...inactiveClass);

        if(fileInput) fileInput.accept = ".txt, .tsv, .csv";
        if(acceptText) acceptText.innerText = "Accepts multiple .txt files";
        if(dropIcon) dropIcon.className = "fa-solid fa-file-lines text-4xl text-slate-400 mb-3 transition-colors";
    }
}

function handleConverterFiles(files) {
    if (!files.length) return;
    filesToProcess = [...filesToProcess, ...Array.from(files)];
    updateConverterUI();
}

function updateConverterUI() {
    const fileList = document.getElementById('fileList');
    const fileCountSpan = document.getElementById('fileCount');
    const fileListContainer = document.getElementById('fileListContainer');
    const convertBtn = document.getElementById('convertBtn');

    if(!fileList) return;

    fileList.innerHTML = '';
    if(fileCountSpan) fileCountSpan.textContent = filesToProcess.length;

    if (filesToProcess.length > 0) {
        fileListContainer.classList.remove('hidden');
        convertBtn.disabled = false;
        
        filesToProcess.forEach((file, index) => {
            const size = (file.size / 1024).toFixed(1) + ' KB';
            const iconClass = currentInputMode === 'excel' ? 'fa-file-excel text-emerald-500' : 'fa-file-lines text-slate-500';
            const bgClass = currentInputMode === 'excel' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-100 dark:bg-slate-800';
            
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 group hover:border-mitratel-red/30 transition-colors';
            div.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center ${iconClass} flex-shrink-0">
                        <i class="fa-regular ${iconClass.split(' ')[0]}"></i>
                    </div>
                    <div class="truncate">
                        <p class="font-medium text-slate-700 dark:text-gray-200 truncate text-sm" title="${file.name}">${file.name}</p>
                        <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">${size}</p>
                    </div>
                </div>
                <button onclick="window.appActions.removeConverterFile(${index})" class="w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition flex items-center justify-center">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            fileList.appendChild(div);
        });
    } else {
        fileListContainer.classList.add('hidden');
        convertBtn.disabled = true;
    }
}

function converterLog(msg, type = 'info') {
    const statusLog = document.getElementById('statusLog');
    if(!statusLog) return;

    statusLog.classList.remove('hidden');
    const color = type === 'error' ? 'text-red-600' : (type === 'success' ? 'text-emerald-600' : 'text-slate-600 dark:text-gray-400');
    const div = document.createElement('div');
    div.className = `${color} mb-1 flex items-start gap-2`;
    div.innerHTML = `<span class="opacity-50 select-none">></span> <span>${msg}</span>`;
    statusLog.appendChild(div);
    statusLog.scrollTop = statusLog.scrollHeight;
}

async function runConversion() {
    const modeEl = document.querySelector('input[name="outputMode"]:checked');
    if(!modeEl) return;
    const mode = modeEl.value;

    const convertBtn = document.getElementById('convertBtn');
    convertBtn.disabled = true;
    convertBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...`;
    
    const statusLog = document.getElementById('statusLog');
    if(statusLog) statusLog.innerHTML = '';

    try {
        if (mode === 'merge') {
            await processMergeMode();
        } else {
            await processSeparateMode();
        }
    } catch (error) {
        converterLog(`Critical Error: ${error.message}`, 'error');
    } finally {
        convertBtn.disabled = false;
        convertBtn.innerHTML = `<span>Run Conversion</span> <i class="fa-solid fa-arrow-right"></i>`;
    }
}

async function processMergeMode() {
    let combinedData = [];
    let headers = null; 
    let headerLine = null; 
    let outputFilename = "batch_output.txt";

    const customFilenameInput = document.getElementById('customFilename');
    const customName = customFilenameInput ? customFilenameInput.value.trim() : "";
    
    for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const isFirstFile = (i === 0);

        if (isFirstFile) {
            if (customName) {
                outputFilename = customName;
                if (!outputFilename.toLowerCase().endsWith('.txt')) {
                    outputFilename += '.txt';
                }
            } else {
                const extractedID = file.name.replace(/\.[^/.]+$/, "");
                outputFilename = extractedID + "_merged.txt";
            }
        }

        converterLog(`Processing: ${file.name}...`);

        try {
            if (currentInputMode === 'excel') {
                const data = await file.arrayBuffer();
                const workbook = window.XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const jsonData = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
                
                if (!jsonData || jsonData.length === 0) { converterLog(`  Skipping: Empty data.`, 'error'); continue; }

                const currentHeaders = jsonData[0];
                const rows = jsonData.slice(1);

                if (isFirstFile) {
                    headers = currentHeaders;
                    combinedData.push(headers.join('\t')); 
                }

                rows.forEach(row => {
                    const tsvRow = row.map(cell => {
                        if (cell === null || cell === undefined) return '';
                        return String(cell).replace(/\t/g, ' ');
                    }).join('\t');
                    if(tsvRow.trim() !== "") combinedData.push(tsvRow);
                });

            } else {
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
                if (lines.length === 0) { converterLog(`  Skipping: Empty file.`, 'error'); continue; }

                if (isFirstFile) {
                    headerLine = lines[0]; 
                    combinedData.push(...lines);
                } else {
                    if (lines.length > 1) {
                        combinedData.push(...lines.slice(1));
                    }
                }
            }
        } catch (err) {
            converterLog(`  Error: ${err.message}`, 'error');
        }
    }

    if (combinedData.length === 0) throw new Error("No data extracted.");
    
    const finalContent = combinedData.join('\r\n');
    triggerTextDownload(finalContent, outputFilename);
    converterLog(`Done! Merged ${filesToProcess.length} files into ${outputFilename}`, 'success');
}

async function processSeparateMode() {
    let processedCount = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        converterLog(`Processing: ${file.name}...`);
        
        try {
            const extractedID = file.name.replace(/\.[^/.]+$/, "");
            const outputFilename = extractedID + ".txt";
            let finalContent = "";

            if (currentInputMode === 'excel') {
                const data = await file.arrayBuffer();
                const workbook = window.XLSX.read(data, { type: 'array' });
                const jsonData = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
                if (!jsonData) continue;

                const rows = jsonData.map(row => {
                     return row.map(cell => {
                        if (cell === null || cell === undefined) return '';
                        return String(cell).replace(/\t/g, ' ');
                    }).join('\t');
                });
                finalContent = rows.join('\r\n');

            } else {
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
                if (lines.length === 0) continue;
                finalContent = lines.join('\r\n');
            }

            await new Promise(r => setTimeout(r, 200));
            triggerTextDownload(finalContent, outputFilename);
            processedCount++;

        } catch (err) {
            converterLog(`  Error: ${err.message}`, 'error');
        }
    }
    converterLog(`Done! Processed ${processedCount} files separately.`, 'success');
}

// Fungsi helper eksklusif untuk converter
function triggerTextDownload(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}