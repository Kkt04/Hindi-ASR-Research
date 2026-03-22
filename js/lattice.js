   'use strict';

   const DEFAULT_REF = 'उसने चौदह किताबें खरीदीं';
   const DEFAULT_HYPS = [
     { name: 'Model 1', hyp: 'उसने 14 किताबें खरीदीं',       note: 'Digit form of number' },
     { name: 'Model 2', hyp: 'उसने चौदह किताबे खरीदी',       note: 'Spelling variant' },
     { name: 'Model 3', hyp: 'उसने चौदह पुस्तकें खरीदीं',    note: 'Lexical synonym' },
     { name: 'Model 4', hyp: 'उसने पंद्रह किताबें खरीदीं',   note: 'Genuinely wrong number' },
     { name: 'Model 5', hyp: 'उसने चौदह किताबें खरीदीं',     note: 'Exact match' },
   ];
   
   function initLattice() {
     const runBtn = document.getElementById('lattice-run');
     if (!runBtn) return;
     runBtn.addEventListener('click', computeLattice);
   
     const container = document.getElementById('lattice-inputs');
     DEFAULT_HYPS.forEach((m, i) => {
       container.innerHTML += `
       <div style="display:flex;gap:10px;align-items:center">
         <span style="font-family:var(--font-mono);font-size:.72rem;color:var(--ink-3);width:64px;flex-shrink:0">${m.name}</span>
         <input class="input" id="hyp-${i}" value="${m.hyp}"
                style="flex:1;font-family:var(--font-deva);font-size:.9rem">
         <span style="font-size:.75rem;color:var(--ink-3);flex-shrink:0;max-width:140px">${m.note}</span>
       </div>`;
     });
   
     setTimeout(computeLattice, 200);
   }
   
   function computeLattice() {
     const ref = document.getElementById('lattice-ref')?.value.trim() || DEFAULT_REF;
     const refWords = ref.split(' ');
     const hyps = DEFAULT_HYPS.map((m, i) => ({
       name: m.name,
       hyp: (document.getElementById(`hyp-${i}`)?.value || m.hyp).trim(),
     }));
   
     const bins = buildBins(refWords, hyps.map(m => m.hyp));
   
     renderLattice(refWords, bins);
   
     renderResults(ref, refWords, hyps, bins);
   }
   
   function renderLattice(refWords, bins) {
     const container = document.getElementById('lattice-viz');
     container.innerHTML = bins.map((alts, i) => {
       const altArr = [...alts];
       const ref = altArr[0];
       const rest = altArr.slice(1);
   
       const restHTML = rest.map(a => {
         const isNumber = /^\d+$/.test(a);
         const isSynonym = !isNumber && a !== ref && !LATTICE_VARIANTS[ref]?.includes(a);
         return `<div class="bin-alt ${isSynonym ? 'is-synonym' : 'is-variant'}">${a}</div>`;
       }).join('');
   
       return `
       <div class="lattice-bin">
         <div class="bin-header">Position ${i}</div>
         <div class="bin-alts">
           <div class="bin-alt is-ref">${ref}</div>
           ${restHTML}
         </div>
       </div>`;
     }).join('');
   }
   
   function renderResults(ref, refWords, hyps, bins) {
     const tbody = document.getElementById('lattice-tbody');
     tbody.innerHTML = '';
   
     hyps.forEach(m => {
       const std = stdWER(ref, m.hyp);
       const lat = latticeWER(refWords, m.hyp, bins);
       const delta = +(std - lat).toFixed(1);
   
       const stdClass = std === 0 ? 'wer-low' : std < 30 ? 'wer-mid' : 'wer-high';
       const latClass = lat === 0 ? 'wer-low' : lat < 30 ? 'wer-mid' : 'wer-high';
   
       let deltaEl = '<span style="color:var(--ink-3);font-family:var(--font-mono);font-size:.8rem">—</span>';
       if (delta > 0) deltaEl = `<span style="color:var(--jade);font-family:var(--font-mono);font-size:.8rem;font-weight:600">↓ ${delta.toFixed(1)}%</span>`;
   
       tbody.innerHTML += `
       <tr>
         <td style="font-family:var(--font-mono);font-size:.8rem;color:var(--ink-2)">${m.name}</td>
         <td style="font-family:var(--font-deva);font-size:.875rem;color:var(--ink-2)">${m.hyp}</td>
         <td><span class="wer-pill ${stdClass}">${std.toFixed(1)}%</span></td>
         <td><span class="wer-pill ${latClass}">${lat.toFixed(1)}%</span></td>
         <td>${deltaEl}</td>
       </tr>`;
     });
   }
   
   document.addEventListener('DOMContentLoaded', initLattice);