   'use strict';

   function initPipeline() {
     const btn  = document.getElementById('pipeline-run');
     const inp  = document.getElementById('pipeline-input');
     const clr  = document.getElementById('pipeline-clear');
   
     if (!btn) return;
   
     btn.addEventListener('click', runPipeline);
     clr.addEventListener('click', () => {
       inp.value = '';
       document.getElementById('pipeline-output').style.display = 'none';
     });
     inp.addEventListener('keydown', e => {
       if (e.key === 'Enter' && e.ctrlKey) runPipeline();
     });
   
     document.querySelectorAll('.ex-chip').forEach(chip => {
       chip.addEventListener('click', () => {
         inp.value = chip.dataset.text;
         runPipeline();
       });
     });
   }
   
   function runPipeline() {
     const text = document.getElementById('pipeline-input').value.trim();
     if (!text) return;
   
     // Stage 1: Number normalization
     const { out: normalized, changes } = normalizeNumbers(text);
   
     // Stage 2: English tagging (on normalized)
     const { tagged, found } = tagEnglish(normalized);
   
     // Highlight digits in normalized text
     const numHighlighted = normalized.replace(/\b\d[\d,]*\b/g,
       m => `<span class="hl-number">${m}</span>`);
   
     // Render tagged with styled marks
     const styledTagged = tagged;
   
     // Update UI
     document.getElementById('out-stage1').innerHTML = numHighlighted || '<em style="color:var(--ink-3)">No changes</em>';
     document.getElementById('out-stage2').innerHTML = styledTagged   || '<em style="color:var(--ink-3)">No changes</em>';
   
     // Changes list
     const changesList = document.getElementById('out-changes');
     let changesHTML = '';
     if (changes.length) {
       changesHTML += `<div class="badge badge-saffron" style="margin-bottom:8px">🔢 Numbers</div><br>`;
       changes.forEach(c => { changesHTML += `<code style="display:block;font-size:.8rem;color:var(--ink-2);margin-top:4px">${c}</code>`; });
     }
     if (found.length) {
       changesHTML += `<div class="badge badge-cobalt" style="margin:8px 0 4px">🌐 English detected</div><br>`;
       found.forEach(w => { changesHTML += `<span class="badge badge-cobalt" style="margin:2px">${w}</span> `; });
     }
     if (!changes.length && !found.length) {
       changesHTML = '<span style="color:var(--ink-3);font-size:.85rem">✓ No conversions needed</span>';
     }
     changesList.innerHTML = changesHTML;
     document.getElementById('pipeline-output').style.display = 'grid';
   }
   
   document.addEventListener('DOMContentLoaded', initPipeline);