/**
 * src/ui/visualizer.js
 * Mengatur semua logika untuk merender visualisasi topologi (SVG),
 * serta mengurus fitur zoom, pan (drag layar), dan resize.
 * Update Phase 2: Integrasi appEventBus agar visualizer otomatis update saat re-validasi.
 */

import { appEventBus } from '../utils/eventBus.js'; // IMPORT EVENT BUS BARU

// --- EVENT SUBSCRIBER (PHASE 2) ---
// Ketika data selesai direvalidasi, otomatis perbarui gambar topologi SVG
appEventBus.on('DATA_REVALIDATED', (updatedItem) => {
    generateSVG(updatedItem.displayData, updatedItem.belowData, updatedItem.pid);
});


let vizScale = 1.0;

export function changeZoom(delta) {
    vizScale += delta;
    if (vizScale < 0.2) vizScale = 0.2;
    if (vizScale > 3.0) vizScale = 3.0;
    applyZoom();
}

export function resetZoom() {
    vizScale = 1.0;
    applyZoom();
}

export function applyZoom() {
    const container = document.getElementById('viz-scale-container');
    if (container) {
        container.style.transform = `scale(${vizScale})`;
    }
}

export function panViz(dx, dy) {
    const container = document.getElementById('viz-scroll-container');
    if(container) {
        container.scrollLeft += dx;
        container.scrollTop += dy;
    }
}

// Inisialisasi event listener untuk interaksi visualizer (Drag & Zoom via mouse)
export function initVisualizerControls() {
    const scrollContainer = document.getElementById('viz-scroll-container');
    if (!scrollContainer) return;

    let isDown = false;
    let startX, startY, scrollLeft, scrollTop;

    scrollContainer.addEventListener('mousedown', (e) => {
        // FIX: Mencegah drag layar/topologi jika user sedang mengklik area yang bisa diedit, 
        // sedang men-drag baris tabel (td/th), atau menekan tombol lain di dalam modal.
        if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.closest('td') || e.target.closest('th') || e.target.closest('button')) {
            return;
        }

        isDown = true;
        scrollContainer.classList.add('active');
        scrollContainer.style.cursor = 'grabbing';
        startX = e.pageX - scrollContainer.offsetLeft;
        startY = e.pageY - scrollContainer.offsetTop;
        scrollLeft = scrollContainer.scrollLeft;
        scrollTop = scrollContainer.scrollTop;
    });
    
    scrollContainer.addEventListener('mouseleave', () => { 
        isDown = false; 
        scrollContainer.style.cursor = 'grab';
    });
    
    scrollContainer.addEventListener('mouseup', () => { 
        isDown = false; 
        scrollContainer.style.cursor = 'grab';
    });
    
    scrollContainer.addEventListener('mousemove', (e) => {
        if(!isDown) return;
        e.preventDefault();
        const x = e.pageX - scrollContainer.offsetLeft;
        const y = e.pageY - scrollContainer.offsetTop;
        const walkX = (x - startX) * 1.5; 
        const walkY = (y - startY) * 1.5;
        scrollContainer.scrollLeft = scrollLeft - walkX;
        scrollContainer.scrollTop = scrollTop - walkY;
    });
    
    // Mouse Wheel Zoom
    scrollContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) changeZoom(0.1);
            else changeZoom(-0.1);
        }
    }, { passive: false });

    // Buttons
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnZoomReset = document.getElementById('btnZoomReset');
    
    if(btnZoomIn) btnZoomIn.addEventListener('click', () => changeZoom(0.1));
    if(btnZoomOut) btnZoomOut.addEventListener('click', () => changeZoom(-0.1));
    if(btnZoomReset) btnZoomReset.addEventListener('click', resetZoom);
}

// --- FUNGSI UTAMA RENDER SVG ---

export function generateSVG(displayData, belowData, targetPID) {
    const container = document.getElementById('viz-scale-container');
    if (!container) return;

    container.innerHTML = '<div class="flex flex-col items-center justify-center h-full"><span class="loader mb-4"></span><p class="text-sm text-gray-500">Generating Topology...</p></div>';

    const iconPaths = {
        network: "M64 32C28.7 32 0 60.7 0 96v256c0 35.3 28.7 64 64 64h128v64H128c-17.7 0-32 14.3-32 32s14.3 32 32 32h256c17.7 0 32-14.3 32-32s-14.3-32-32-32H320v-64h128c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zM32 96c0-17.7 14.3-32 32-32h448c17.7 0 32 14.3 32 32v256c0 17.7-14.3 32 32 32H64c-17.7 0-32-14.3-32-32V96z",
        circleDot: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-352a96 96 0 1 1 0 192 96 96 0 1 1 0-192z",
        box: "M32 32H288c17.7 0 32 14.3 32 32V96c0 17.7-14.3 32-32 32H32C14.3 128 0 113.7 0 96V64C0 46.3 14.3 32 32 32zm0 128H288V416c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V160z",
        plug: "M0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256z M188.3 147.1c-7.6 4.2-12.3 12.3-12.3 20.9V344c0 8.7 4.7 16.7 12.3 20.9s16.8 4.1 24.3-.5l144-88c7.1-4.4 11.5-12.1 11.5-20.5s-4.4-16.1-11.5-20.5l-144-88c-7.4-4.5-16.7-4.7-24.3-.5z",
        circle: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z"
    };

    const getNodeStyle = (type, label) => {
        const t = (type || "").toUpperCase();
        const l = (label || "").toUpperCase();
        
        if (t.includes("OTB") || l.includes("OTB")) 
            return { shape: "rect", fill: "#fffbeb", stroke: "#d97706", text: "#b45309", iconPath: iconPaths.network }; 
        if (t.includes("CLOSURE") || l.includes("CLOSURE") || l.includes("JC")) 
            return { shape: "circle", fill: "#ffffff", stroke: "#1e293b", text: "#0f172a", iconPath: iconPaths.circleDot }; 
        if (t.includes("FDT") || l.includes("FDT") || t.includes("FAT")) 
            return { shape: "hexagon", fill: "#e0f2fe", stroke: "#0284c7", text: "#0369a1", iconPath: iconPaths.box }; 
        if (t.includes("ODP") || l.includes("ODP"))
            return { shape: "circle", fill: "#f0fdf4", stroke: "#15803d", text: "#166534", iconPath: iconPaths.plug }; 

        return { shape: "circle", fill: "#ffffff", stroke: "#64748b", text: "#334155", iconPath: iconPaths.circle }; 
    };

    setTimeout(() => {
        const nodeMap = new Map();
        const edges = [];
        let currentX = 100;
        const spacing = 350; 
        const yPos = 300;
        const isDark = document.documentElement.classList.contains('dark');

        displayData.forEach((row, idx) => {
            const parse = (floc, desc, type) => {
                if (!floc) return { span: "UNK", mat: "UNK", id: "UNK", type: "UNK" };
                const parts = floc.split('-');
                let span = parts.find(p => p.startsWith('S') && p.length <= 4 && !isNaN(p.substring(1))) || "UNK";
                if(span === "UNK" && desc && desc.includes("-S")) {
                     const dParts = desc.split('-');
                     const dSpan = dParts.find(p => p.startsWith('S') && !isNaN(p.substring(1)));
                     if(dSpan) span = dSpan;
                }
                let mat = desc ? desc : parts.pop();
                return { span, mat, id: floc, type: type || "GENERIC" };
            };

            const uData = parse(row['LINK_FRM_FLOC'], row['LINK_FROM_FUNCTIONAL_LOCATION_DESC'], row['FROM_OBJECT_NODE_TYPE']);
            const vData = parse(row['LINK_TO_FLOC'], row['LINK_TO_FUNCTIONAL_LOCATION_DESC'], row['TO_OBJECT_NODE_TYPE']);

            let uNode = nodeMap.get(uData.id);
            let vNode = nodeMap.get(vData.id);

            if (!uNode) {
                uNode = { ...uData, x: currentX, y: yPos };
                nodeMap.set(uData.id, uNode);
                currentX += spacing;
            }

            if (!vNode) {
                vNode = { ...vData, x: uNode.x + spacing, y: yPos };
                nodeMap.set(vData.id, vNode);
                if(vNode.x >= currentX) currentX = vNode.x + spacing;
            }

            const cableId = row['LINK_DESCRIPTION'];
            const cableRows = belowData.filter(b => String(b.STRNO || "").startsWith(cableId));
            const occupiedCores = cableRows.filter(r => {
                const p = String(r.PLTXT || "").trim();
                return p.length > 0 && !p.toUpperCase().includes("KABEL");
            });
            
            const uniquePids = [...new Set(cableRows.map(c => c.PLTXT))].filter(p => 
                p && p.trim() !== "" && !p.toUpperCase().includes("KABEL")
            );

            let segmentName = "SEG";
            const segMatch = cableId ? cableId.match(/S\d+-\d+/) : null;
            if (segMatch) {
                segmentName = segMatch[0];
            } else {
                const parts = cableId ? cableId.split('-') : [];
                if (parts.length > 2) {
                     segmentName = parts.slice(-3, -1).join('-');
                }
            }

            edges.push({
                source: uData.id,
                target: vData.id,
                cableId: cableId ? cableId.split('-').pop() : "UNK",
                fullCableId: cableId,
                segmentName: segmentName,
                pids: uniquePids,
                usedCores: occupiedCores.length
            });
        });

        if (nodeMap.size === 0) {
            container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-gray-400"><i class="fa-solid fa-circle-exclamation text-4xl mb-2"></i><p>No Topology Data Found</p></div>';
            return;
        }

        const nodesArr = Array.from(nodeMap.values());
        const spans = {};
        
        nodesArr.forEach(n => {
            if(n.span !== "UNK") {
                if (!spans[n.span]) spans[n.span] = { min: n.x, max: n.x, nodes: [] };
                else {
                    spans[n.span].min = Math.min(spans[n.span].min, n.x);
                    spans[n.span].max = Math.max(spans[n.span].max, n.x);
                }
                spans[n.span].nodes.push(n);
            }
        });

        const width = Math.max(...nodesArr.map(n => n.x)) + 300;
        const height = 900; 

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" class="font-sans">`;
        
        svg += `
        <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="32" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
            </marker>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.1"/>
            </filter>
        </defs>`;

        const spanBgColors = isDark ? ['#1e293b', '#0f172a'] : ['#f8fafc', '#f1f5f9'];
        const spanTextColor = isDark ? '#94a3b8' : '#64748b';

        Object.keys(spans).sort().forEach((s, i) => {
            const g = spans[s];
            const pad = 100;
            const rectX = g.min - pad;
            const rectW = (g.max - g.min) + (pad * 2);
            const rectY = yPos - 120;
            const rectH = 280; 
            
            svg += `<text x="${rectX + rectW/2}" y="${rectY - 20}" text-anchor="middle" font-weight="bold" fill="${spanTextColor}" font-size="20" style="text-transform:uppercase; letter-spacing: 2px;">SPAN ${s}</text>`;
            svg += `<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" fill="${spanBgColors[i % 2]}" rx="20" stroke="${isDark?'#334155':'#e2e8f0'}" stroke-width="2" stroke-dasharray="10,5" />`;
        });

        edges.forEach(e => {
            const u = nodeMap.get(e.source);
            const v = nodeMap.get(e.target);
            const midX = (u.x + v.x) / 2;
            const midY = (u.y + v.y) / 2;

            svg += `<line x1="${u.x}" y1="${u.y}" x2="${v.x}" y2="${v.y}" stroke="#94a3b8" stroke-width="4" marker-end="url(#arrow)" />`;

            const segmentColor = isDark ? '#e2e8f0' : '#64748b';
            if (e.segmentName) {
                svg += `<text x="${midX}" y="${midY - 65}" text-anchor="middle" font-size="12" font-weight="bold" fill="${segmentColor}" style="letter-spacing: 1px;">${e.segmentName}</text>`;
            }

            const cableLabelColor = targetPID && e.fullCableId.includes(targetPID) ? "#EE2E24" : "#475569";
            const boxFill = isDark ? '#1e293b' : 'white';
            
            svg += `<rect x="${midX - 50}" y="${midY - 50}" width="100" height="24" fill="${boxFill}" stroke="${cableLabelColor}" stroke-width="1.5" rx="6" filter="url(#shadow)" />`;
            svg += `<text x="${midX}" y="${midY - 34}" text-anchor="middle" font-size="11" font-weight="bold" fill="${cableLabelColor}">${e.cableId}</text>`;

            const pids = e.pids.length ? e.pids : ["-"];
            const headerHeight = 30;
            const rowHeight = 16;
            const footerHeight = 24; 
            const listHeight = headerHeight + (pids.length * rowHeight) + footerHeight;
            const listY = midY + 25;
            
            svg += `<rect x="${midX - 80}" y="${listY}" width="160" height="${listHeight}" class="pid-box" filter="url(#shadow)" />`;
            
            const headerColor = isDark ? '#4ade80' : '#15803d';
            svg += `<text x="${midX}" y="${listY + 18}" text-anchor="middle" font-size="10" font-weight="bold" fill="${headerColor}" style="text-decoration: underline">ASSETS</text>`;

            pids.forEach((pid, idx) => {
                const pNorm = pid.toUpperCase();
                const tNorm = targetPID ? targetPID.toUpperCase() : "";
                const isMatch = tNorm && pNorm.includes(tNorm);

                const color = isMatch ? "#EE2E24" : (isDark ? "#cbd5e1" : "#334155");
                const weight = isMatch ? "bold" : "normal";
                const bg = isMatch ? (isDark ? "#450a0a" : "#FEF2F2") : "none";
                
                if (isMatch) {
                    svg += `<rect x="${midX - 75}" y="${listY + 24 + (idx*rowHeight)}" width="150" height="16" fill="${bg}" rx="3" />`;
                }
                
                let displayPid = pid.replace(/\(R\)/gi, ' [R]').replace(/\(r\)/gi, ' [R]');
                if(displayPid.length > 20) displayPid = displayPid.substring(0, 18) + '..';
                
                svg += `<text x="${midX}" y="${listY + 36 + (idx*rowHeight)}" text-anchor="middle" font-size="10" fill="${color}" font-weight="${weight}" font-family="monospace">${displayPid}</text>`;
            });

            const footerY = listY + headerHeight + (pids.length * rowHeight) + 14;
            const footerLineColor = isDark ? '#374151' : '#e2e8f0';
            const footerTextColor = isDark ? '#9ca3af' : '#64748b'; 
            
            svg += `<line x1="${midX - 70}" y1="${footerY - 10}" x2="${midX + 70}" y2="${footerY - 10}" stroke="${footerLineColor}" stroke-width="1" stroke-dasharray="3,3" />`;
            svg += `<text x="${midX}" y="${footerY}" text-anchor="middle" font-size="9" font-weight="bold" fill="${footerTextColor}">Okupansi Core: ${e.usedCores}</text>`;
        });

        nodesArr.forEach(n => {
            const style = getNodeStyle(n.type, n.mat);
            const isIntersection = (n.mat.includes("OTB") || n.mat.includes("ODF")); 
            const size = isIntersection ? 70 : 50; 
            const offset = size / 2;

            if (style.shape === 'rect') {
                svg += `<rect x="${n.x - offset}" y="${n.y - offset}" width="${size}" height="${size}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="3" rx="10" filter="url(#shadow)" />`;
            } else if (style.shape === 'hexagon') {
                const r = size / 1.7;
                const hexPath = `M${n.x + r*Math.cos(0)} ${n.y + r*Math.sin(0)} ` +
                                `L${n.x + r*Math.cos(Math.PI/3)} ${n.y + r*Math.sin(Math.PI/3)} ` +
                                `L${n.x + r*Math.cos(2*Math.PI/3)} ${n.y + r*Math.sin(2*Math.PI/3)} ` +
                                `L${n.x + r*Math.cos(Math.PI)} ${n.y + r*Math.sin(Math.PI)} ` +
                                `L${n.x + r*Math.cos(4*Math.PI/3)} ${n.y + r*Math.sin(4*Math.PI/3)} ` +
                                `L${n.x + r*Math.cos(5*Math.PI/3)} ${n.y + r*Math.sin(5*Math.PI/3)} Z`;
                svg += `<path d="${hexPath}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="3" filter="url(#shadow)" />`;
            } else {
                svg += `<circle cx="${n.x}" cy="${n.y}" r="${size/2}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="3" filter="url(#shadow)" />`;
            }

            const scaleFactor = 0.04; 
            const scaledIconSize = 512 * scaleFactor;
            const translateX = n.x - (scaledIconSize / 2);
            const translateY = n.y - (scaledIconSize / 2);

            svg += `<g transform="translate(${translateX}, ${translateY}) scale(${scaleFactor})">
                        <path d="${style.iconPath}" fill="${style.text}" />
                    </g>`;

            svg += `<text x="${n.x}" y="${n.y - offset - 15}" text-anchor="middle" font-size="12" font-weight="bold" fill="${isDark?'#94a3b8':'#475569'}">${n.span}</text>`;
            
            let label = n.mat;
            if(label.length > 20) label = label.substring(0, 18) + '..';
            
            const labelColor = isDark ? '#ffffff' : '#1e293b';
            const textShadow = isDark ? 'style="text-shadow: 0px 1px 3px rgba(0,0,0,0.8);"' : ''; 
            
            svg += `<text x="${n.x}" y="${n.y + offset + 20}" text-anchor="middle" font-size="11" font-weight="bold" fill="${labelColor}" ${textShadow}>${label}</text>`;
        });

        svg += `</svg>`;
        container.innerHTML = svg;

    }, 200);
}
