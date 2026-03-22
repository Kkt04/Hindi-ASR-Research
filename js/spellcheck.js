   'use strict';

   const DEMO_WORDS = [
     'जनजाति','प्रोजेक्ट','अनुभव','जीवन','पानी',
     'इंटरव्यू','कंप्यूटर','मोबाइल','एरिया','टेंट',
     'हाँ','हां','आराम','अजीब',
     'बोहोत','सायद','मेको',
     'जनजाातति','प्ोजेक्ट','एरियाा',
     'कुड़रमा','दिवोग','बदक','उड़न्टा','लगड़ा','खांड',
   ];
   
   let activeResults = [];
   
   function initSpellCheck() {
     const inp = document.getElementById('spell-input');
     const btn = document.getElementById('spell-add');
     const demoBtn = document.getElementById('spell-demo');
     const clearBtn = document.getElementById('spell-clear');
   
     if (!btn) return;
   
     btn.addEventListener('click', () => addWord(inp.value));
     inp.addEventListener('keydown', e => { if (e.key === 'Enter') addWord(inp.value); });
     demoBtn.addEventListener('click', loadDemo);
     clearBtn.addEventListener('click', clearAll);
   }
   
   function addWord(raw) {
     const word = raw.trim();
     if (!word) return;
     const result = classifyWord(word);
     if (!result) return;
     activeResults.push(result);
     renderChips();
     document.getElementById('spell-input').value = '';
   }
   
   function loadDemo() {
     activeResults = DEMO_WORDS.map(w => ({ word: w, ...classifyWord(w) }));
     renderChips();
   }
   
   function clearAll() {
     activeResults = [];
     renderChips();
   }
   
   function renderChips() {
     const grid = document.getElementById('chip-grid');
     grid.innerHTML = activeResults.map(r => `
       <div class="word-chip ${r.s} ${r.c === 'low' ? 'low' : ''}"
            title="${r.r}">
         <span class="chip-dot ${r.c}"></span>
         ${r.word}
       </div>`).join('');
   
     const correct   = activeResults.filter(r => r.s === 'correct').length;
     const incorrect = activeResults.filter(r => r.s === 'incorrect').length;
     const low       = activeResults.filter(r => r.c === 'low').length;
   
     const sum = document.getElementById('spell-summary');
     if (activeResults.length) {
       sum.style.display = 'flex';
       document.getElementById('sum-correct').textContent   = correct;
       document.getElementById('sum-incorrect').textContent = incorrect;
       document.getElementById('sum-low').textContent       = low;
       document.getElementById('sum-total').textContent     = activeResults.length;
       // Bar
       const pct = Math.round(correct / activeResults.length * 100);
       document.getElementById('correct-bar').style.width = pct + '%';
       document.getElementById('correct-pct').textContent = pct + '% correct';
     } else {
       sum.style.display = 'none';
     }
   }
   
   document.addEventListener('DOMContentLoaded', initSpellCheck);