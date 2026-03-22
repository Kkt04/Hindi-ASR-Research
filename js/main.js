   'use strict';

   const TABS = ['q1','q2','q3','q4'];
   
   function showTab(id) {
     TABS.forEach(t => {
       document.querySelectorAll(`[data-tab="${t}"]`).forEach(el => el.classList.remove('active'));
       const panel = document.getElementById(`panel-${t}`);
       if (panel) panel.classList.remove('active');
     });
     document.querySelectorAll(`[data-tab="${id}"]`).forEach(el => el.classList.add('active'));
     const panel = document.getElementById(`panel-${id}`);
     if (panel) {
       panel.classList.add('active');
       // Trigger animations
       panel.querySelectorAll('.anim-up, .anim-in').forEach(el => {
         el.style.animation = 'none';
         el.offsetHeight; // reflow
         el.style.animation = '';
       });
     }
   }
   
   function toggleAccordion(el) {
     const item = el.closest('.accordion-item');
     const isOpen = item.classList.contains('open');
     // Close all in same group
     const group = item.closest('[data-accordion-group]');
     if (group) {
       group.querySelectorAll('.accordion-item.open').forEach(i => i.classList.remove('open'));
     }
     if (!isOpen) item.classList.add('open');
   }
   
   const ONES = {
     'शून्य':0,'एक':1,'दो':2,'तीन':3,'चार':4,'पाँच':5,'पांच':5,
     'छह':6,'छः':6,'सात':7,'आठ':8,'नौ':9,'दस':10,
     'ग्यारह':11,'बारह':12,'तेरह':13,'चौदह':14,'पंद्रह':15,
     'सोलह':16,'सत्रह':17,'अठारह':18,'उन्नीस':19,'बीस':20,
   };
   const COMPOUND = {
     'इक्कीस':21,'बाईस':22,'तेईस':23,'चौबीस':24,'पच्चीस':25,
     'छब्बीस':26,'सत्ताईस':27,'अट्ठाईस':28,'उनतीस':29,'तीस':30,
     'इकतीस':31,'बत्तीस':32,'तैंतीस':33,'चौंतीस':34,'पैंतीस':35,
     'पचास':50,'साठ':60,'सत्तर':70,'अस्सी':80,'नब्बे':90,
   };
   const MULT = {'सौ':100,'हज़ार':1000,'हजार':1000,'लाख':100000,'करोड़':10000000};
   const IDIOMS = new Set(['दो-चार','दो चार','तीन-चार','चार-पाँच','एक-दो','एक दो','बार बार','सात-आठ','नौ-दस']);
   const NUM_MAP = {...ONES,...COMPOUND,...MULT};
   
   function normalizeNumbers(text) {
     for (const idiom of IDIOMS) {
       if (text.includes(idiom)) return { out: text, changes: [`Idiom preserved: "${idiom}"`] };
     }
     const words = text.split(' ');
     const out = []; const changes = [];
   
     let i = 0;
     while (i < words.length) {
       let matched = false;
       for (let n = Math.min(4, words.length - i); n >= 1; n--) {
         const phrase = words.slice(i, i+n).join(' ');
         if (NUM_MAP[phrase] !== undefined && !(n===1 && MULT[phrase])) {
           let val = NUM_MAP[phrase]; let consumed = n;
           if (i + consumed < words.length && MULT[words[i+consumed]]) {
             val *= MULT[words[i+consumed]]; consumed++;
             const rem = words[i+consumed] && NUM_MAP[words[i+consumed]];
             if (rem) { val += rem; consumed++; }
           }
           changes.push(`"${words.slice(i, i+consumed).join(' ')}" → ${val}`);
           out.push(String(val)); i += consumed; matched = true; break;
         }
       }
       if (!matched) { out.push(words[i]); i++; }
     }
     return { out: out.join(' '), changes };
   }
   
   const EN_DEVA = new Set([
     'इंटरव्यू','जॉब','ऑफिस','मीटिंग','प्रोजेक्ट','रिपोर्ट','मैनेजर',
     'टीम','बॉस','सैलरी','टारगेट','डेडलाइन','कॉलेज','स्कूल','क्लास',
     'एग्जाम','रिजल्ट','प्रॉब्लम','सॉल्यूशन','टाइम','होटल','पार्टी',
     'शॉपिंग','ऑनलाइन','ओके','बाय','हेलो','थैंक्यू','सॉरी','मोबाइल',
     'फोन','लैपटॉप','वेबसाइट','ऐप','सॉफ्टवेयर','डेटा','नेटवर्क',
     'पासवर्ड','टेंट','कैम्प','एरिया','लाइट','कैम्पिंग','सफर',
     'इंटरनेट','कंप्यूटर','कम्प्यूटर',
   ]);
   const ROMAN_RE = /^[a-zA-Z]{2,}$/;
   
   function tagEnglish(text) {
     const words = text.split(' ');
     const found = [];
     const tagged = words.map(w => {
       const clean = w.replace(/[।,.?!;:]/g,'');
       const punct = w.slice(clean.length);
       if (ROMAN_RE.test(clean)) {
         found.push(clean);
         return `<mark class="en-mark">${clean}</mark>${punct}`;
       }
       if (EN_DEVA.has(clean)) {
         found.push(clean);
         return `<mark class="en-mark">${clean}</mark>${punct}`;
       }
       return w;
     });
     return { tagged: tagged.join(' '), found };
   }
   
   const SPELL_DB = {
     'जनजाति':   {s:'correct',  c:'high',   r:'Found in verified vocabulary'},
     'प्रोजेक्ट': {s:'correct',  c:'high',   r:'English loanword (Devanagari) — valid per guidelines'},
     'अनुभव':    {s:'correct',  c:'high',   r:'Found in verified vocabulary'},
     'जीवन':     {s:'correct',  c:'high',   r:'Core vocabulary match'},
     'पानी':     {s:'correct',  c:'high',   r:'Core vocabulary match'},
     'इंटरव्यू': {s:'correct',  c:'high',   r:'English loanword — valid'},
     'कंप्यूटर': {s:'correct',  c:'high',   r:'English loanword — valid'},
     'मोबाइल':   {s:'correct',  c:'high',   r:'English loanword — valid'},
     'एरिया':    {s:'correct',  c:'medium', r:'Loanword; valid matra structure'},
     'टेंट':     {s:'correct',  c:'medium', r:'Loanword; acceptable phonotactics'},
     'हाँ':      {s:'correct',  c:'high',   r:'Core vocabulary'},
     'हां':      {s:'correct',  c:'high',   r:'Accepted anusvara variant of हाँ'},
     'बोहोत':    {s:'incorrect', c:'medium', r:'Dialectal variant of बहुत — flagged'},
     'सायद':     {s:'incorrect', c:'medium', r:'Variant of शायद — non-standard spelling'},
     'मेको':     {s:'incorrect', c:'medium', r:'Colloquial form of मुझे — non-standard'},
     'जनजाातति': {s:'incorrect', c:'high',   r:'Double matra ा+ा — impossible sequence'},
     'प्ोजेक्ट': {s:'incorrect', c:'high',   r:'Matra ो before consonant — illegal Unicode'},
     'एरियाा':   {s:'incorrect', c:'high',   r:'Trailing duplicate vowel matra'},
     'कुड़रमा':  {s:'correct',  c:'low',    r:'Rare proper noun — not in dictionary, structure valid'},
     'दिवोग':    {s:'correct',  c:'low',    r:'Unusual sequence — possible place name'},
     'बदक':      {s:'correct',  c:'low',    r:'Conversational word; acceptable matra score'},
     'उड़न्टा':  {s:'correct',  c:'low',    r:'Dialectal — low confidence'},
     'लगड़ा':    {s:'correct',  c:'low',    r:'Could be proper noun or dialectal form'},
     'आराम':     {s:'correct',  c:'high',   r:'Core vocabulary'},
     'अजीब':     {s:'correct',  c:'high',   r:'Core vocabulary'},
     'खांड':     {s:'correct',  c:'low',    r:'Tribal proper noun — not in standard dict'},
   };
   
   function classifyWord(word) {
     const w = word.trim();
     if (!w) return null;
     if (/^[a-zA-Z]+$/.test(w)) return { word: w, s:'correct', c:'high', r:'Roman-script English — valid per transcription guidelines' };
     return SPELL_DB[w] || { word: w, s:'correct', c:'low', r:'Not in demo dictionary — structure assumed valid' };
   }
   
   const LATTICE_VARIANTS = {
     'चौदह':  ['चौदह','14'],  '14':     ['14','चौदह'],
     'किताबें':['किताबें','किताबे','पुस्तकें'],
     'किताबे': ['किताबे','किताबें','पुस्तकें'],
     'पुस्तकें':['पुस्तकें','किताबें','किताबे'],
     'खरीदीं': ['खरीदीं','खरीदी'],
     'खरीदी':  ['खरीदी','खरीदीं'],
     'हाँ':    ['हाँ','हां'],   'हां':   ['हां','हाँ'],
   };
   
   function getAlts(word) { return LATTICE_VARIANTS[word] || [word]; }
   
   function stdWER(ref, hyp) {
     const r = ref.split(' '), h = hyp.split(' ');
     const dp = Array.from({length:r.length+1},(_,i)=>Array.from({length:h.length+1},(_,j)=>i?j?0:i:j));
     for(let i=1;i<=r.length;i++) for(let j=1;j<=h.length;j++) {
       dp[i][j] = r[i-1]===h[j-1] ? dp[i-1][j-1]
         : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
     }
     return +(dp[r.length][h.length]/r.length*100).toFixed(1);
   }
   
   function buildBins(refWords, modelHyps) {
     return refWords.map((rw, i) => {
       const alts = new Set(getAlts(rw));
       modelHyps.forEach(hyp => {
         const hw = hyp.split(' ');
         if (hw[i]) getAlts(hw[i]).forEach(a => alts.add(a));
       });
       return alts;
     });
   }
   
   function latticeWER(refWords, hyp, bins) {
     const h = hyp.split(' '); const n = refWords.length, m = h.length;
     const INF = 1e9;
     const dp = Array.from({length:n+1},(_,i)=>Array.from({length:m+1},(_,j)=>i?j?INF:i:j));
     for(let i=1;i<=n;i++) for(let j=1;j<=m;j++) {
       const match = bins[i-1].has(h[j-1]) ? 0 : 1;
       dp[i][j] = Math.min(dp[i-1][j-1]+match, dp[i-1][j]+1, dp[i][j-1]+1);
     }
     return +(dp[n][m]/n*100).toFixed(1);
   }
   
   document.addEventListener('DOMContentLoaded', () => {
     showTab('q1');
     document.querySelectorAll('.tab-btn').forEach(btn => {
       btn.addEventListener('click', () => showTab(btn.dataset.tab));
     });
   
     document.querySelectorAll('.accordion-trigger').forEach(btn => {
       btn.addEventListener('click', () => toggleAccordion(btn));
     });
   
     document.querySelectorAll('[data-accordion-group]').forEach(group => {
       const first = group.querySelector('.accordion-item');
       if (first) first.classList.add('open');
     });
   });