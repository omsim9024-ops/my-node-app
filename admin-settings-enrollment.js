// admin-settings-enrollment.js
// Manage enrollment form configuration: tracks, electives, availability per school year

(function(){
  const STORAGE_KEY = 'enrollmentFormConfig';
  const schoolYearsKey = 'schoolYears'; // existing app stores school years; fallback available

  function defaultConfig() {
    return {
      tracks: {
        Academic: { enabled: true },
        TechPro: { enabled: true }
      },
      electives: [], // { id, name, created_at, track: string|null, category?: string, enabled?: boolean }
      availability: {} // per-school-year availability: { '2025-2026': { tracks: {Academic:true}, electives: {id:true} } }
    };
  }

  // Seed default electives grouped by track and category (only when config is empty)
  function seedDefaultElectives(cfg){
    if (cfg.electives && cfg.electives.length) return;
    // Define seed data (condensed names)
    const seed = [];
    // Academic - categories 1..5
    const academic = [
      { category: 'Arts, Social Sciences, & Humanities', items: [
        'Citizenship and Civic Engagement', 'Creative Industries (Visual, Media, Applied, and Traditional Art)', 'Creative Industries (Music, Dance, Theater)', 'Creative Writing', 'Cultivating Filipino Identity Through the Arts', 'Filipino sa Isports', 'Filipino sa Sining at Disenyo', 'Filipino sa Teknikal-Propesyonal', 'Introduction to the Philosophy of the Human Person', 'Leadership and Management in the Arts', 'Malikhaing Pagsulat', 'Philippine Politics and Governance', 'The Social Sciences in Theory and Practice', 'Wika at Komunikasyon sa Akademikong Filipino'
      ]},
      { category: 'Business & Entrepreneurship', items: ['Basic Accounting','Business Finance and Income Taxation','Contemporary Marketing and Business Economics','Entrepreneurship','Introduction to Organization and Management'] },
      { category: 'Sports, Health, & Wellness', items: ['Exercise and Sports Programming','Introduction to Human Movement','Physical Education (Fitness and Recreation)','Physical Education (Sports and Dance)','Safety and First Aid','Sports Coaching','Sports Officiating','Sports Activity Management'] },
      { category: 'Science, Technology, Engineering, & Mathematics', items: ['Advanced Mathematics 1-2','Biology 1-2','Biology 3-4','Chemistry 1-2','Chemistry 3-4','Database Management','Earth and Space Science 1-2','Earth and Space Science 3 - 4','Empowerment Technologies','Finite Mathematics','Fundamentals of Data Analytics and Management','General Science (Physical Science)','General Science (Earth and Life Science)','Pre-Calculus 1-2','Physics 1-2','Physics 3-4','Trigonometry 1-2'] },
      { category: 'Field Experience', items: ['Arts Apprenticeship - Theater Arts','Arts Apprenticeship - Dance','Arts Apprenticeship - Music','Arts Apprenticeship - Literary Arts','Arts Apprenticeship - Visual, Media, Applied, and Traditional Art','Creative Production and Presentation','Design and Innovation Research Methods','Field Exposure (In-Campus)','Field Exposure (Off-Campus)','Work Immersion'] }
    ];
    academic.forEach(cat => { cat.items.forEach(name => seed.push({ track: 'Academic', category: cat.category, name })); });

    // TechPro categories
    const techpro = [
      { category: 'Information & Computer Technology', items: ['Animation (NC II)','Broadband Installation (Fixed Wireless Systems) (NC II)','Computer Programming (Java) (NC III)','Computer Programming (Oracle Database) (NC III)','Computer Systems Servicing (NC II)','Contact Center Services (NC II)','Illustration (NC II)','Programming (.NET Technology) (NC III)','Visual Graphic Design (NC III)'] },
      { category: 'Industrial Arts', items: ['Automotive Servicing (Engine and Chassis) (NC II)','Automotive Servicing (Electrical) (NC II)','Carpentry (NC I and NC II)','Construction Operations (Masonry NC I and Tiles Plumbing NC II)','Commercial Air-Conditioning Installation and Servicing (NC III)','Domestic Refrigeration and Air- Conditioning Servicing (NC II)','Driving and Automotive Servicing (Driving NC II and Automotive Servicing NC I)','Electrical Installation Maintenance (NC II)','Electronics Product and Assembly Servicing (NC II)','Manual Metal Arc Welding (NC II)','Mechatronics (NC II)','Motorcycle and Small Engine Servicing (NC II)','Photovoltaic System Installation (NC II)','Technical Drafting (NC II)'] },
      { category: 'Agriculture & Fishery Arts', items: ['Agricultural Crops Production (NC II)','Agro-Entrepreneurship (NC II)','Aquaculture (NC II)','Fish Capture Operation (NC II)','Food Processing (NC II)','Organic Agriculture Production (NC II)','Poultry Production - Chicken (NC II)','Ruminants Production (NC II)','Swine Production (NC II)'] },
      { category: 'Family & Consumer Science', items: ['Aesthetic Services (Beauty Care) (NC II)','Bakery Operations (NC II)','Caregiving (Adult Care) (NC II)','Caregiving (Child Care) (NC II)','Events Management Services (NC III)','Food and Beverages Operations (NC II)','Garments Artisanry (NC II)','Hairdressing Services (NC II)','Handicraft (Weaving) (NC II)','Hotel Operations (Front Office Services) (NC II)','Hotel Operations (Housekeeping Services) (NC II)','Kitchen Operations (NC II)','Tourism Services (NC II)'] },
      { category: 'Maritime', items: ['Marine Engineering at the Support Level (Non-NC)','Marine Transportation at the Support Level (Non-NC)','Ships Catering Services (NC I)'] }
    ];
    techpro.forEach(cat => { cat.items.forEach(name => seed.push({ track: 'TechPro', category: cat.category, name })); });

    // Apply seed into cfg
    cfg.tracks = cfg.tracks || {};
    cfg.tracks['Academic'] = cfg.tracks['Academic'] || { enabled: true };
    cfg.tracks['TechPro'] = cfg.tracks['TechPro'] || { enabled: true };

    cfg.electives = seed.map(s => ({ id: generateId(), name: s.name, category: s.category, track: s.track, enabled: true, created_at: new Date().toISOString() }));
    saveConfig(cfg);
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultConfig();
      return JSON.parse(raw);
    } catch (e) { console.warn('Failed to load enrollment config', e); return defaultConfig(); }
  }

  function saveConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      // best-effort sync to API if API_BASE exists
      if (typeof API_BASE !== 'undefined') {
        fetch(API_BASE + '/api/enrollment/config', { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(cfg) }).catch(()=>{});
      }
    } catch (e) { console.warn('Failed to save enrollment config', e); }
  }

  function byId(id){ return document.getElementById(id); }

  function generateId(){ return 'e_'+Math.random().toString(36).slice(2,9); }

  // Render helpers
  function renderTracks(cfg, selectedYear){
    const container = byId('efmTracksList');
    container.innerHTML = '';
    const yearsAvail = (cfg.availability && cfg.availability[selectedYear]) || { tracks: {}, electives: {} };
    const tracks = Object.keys(cfg.tracks || {});
    if (!tracks.length) { container.textContent = 'No tracks configured.'; return; }

    tracks.forEach(trackName => {
      const track = cfg.tracks[trackName];
      const card = document.createElement('div');
      card.style.border = '1px solid rgba(0,0,0,0.04)';
      card.style.borderRadius = '8px';
      card.style.padding = '10px';
      card.style.marginBottom = '8px';

      const header = document.createElement('div');
      header.style.display = 'flex'; header.style.justifyContent = 'space-between'; header.style.alignItems = 'center';

      const left = document.createElement('div');
      left.innerHTML = `<strong style="font-size:1rem">${trackName}</strong> <small style="color:#666; margin-left:8px">(global)</small>`;

      const right = document.createElement('div');
      right.style.display = 'flex'; right.style.alignItems='center'; right.style.gap='8px';

      const enabledToggle = document.createElement('input'); enabledToggle.type='checkbox'; enabledToggle.checked = !!track.enabled;
      enabledToggle.title = 'Enable track globally';
      enabledToggle.addEventListener('change', ()=>{ cfg.tracks[trackName].enabled = enabledToggle.checked; saveConfig(cfg); renderTracks(cfg, selectedYear); });

      const yearAvail = document.createElement('input'); yearAvail.type='checkbox'; yearAvail.checked = !!(yearsAvail.tracks && yearsAvail.tracks[trackName]);
      yearAvail.title = 'Available for the selected school year';
      yearAvail.addEventListener('change', ()=>{
        cfg.availability = cfg.availability || {};
        cfg.availability[selectedYear] = cfg.availability[selectedYear] || { tracks: {}, electives: {} };
        cfg.availability[selectedYear].tracks[trackName] = yearAvail.checked;
        saveConfig(cfg);
        renderTracks(cfg, selectedYear);
      });

      const editBtn = document.createElement('button'); editBtn.className='btn btn-small'; editBtn.textContent='Edit';
      editBtn.addEventListener('click', ()=>{
        const newName = prompt('Rename track', trackName);
        if (!newName) return;
        const trimmed = newName.trim(); if (!trimmed) return;
        // rename key
        if (trimmed === trackName) return;
        if (cfg.tracks[trimmed]) { alert('A track with that name already exists'); return; }
        cfg.tracks[trimmed] = Object.assign({}, cfg.tracks[trackName]);
        delete cfg.tracks[trackName];
        // update electives assignment
        cfg.electives.forEach(e=>{ if (e.track === trackName) e.track = trimmed; });
        saveConfig(cfg);
        renderTracks(cfg, selectedYear);
        renderElectives(cfg, selectedYear);
      });

      const delBtn = document.createElement('button'); delBtn.className='btn btn-small btn-danger'; delBtn.textContent='Remove';
      delBtn.addEventListener('click', ()=>{
        if (!confirm('Remove this track? Associated electives will be unassigned.')) return;
        // unassign electives
        cfg.electives.forEach(e=>{ if (e.track === trackName) e.track = null; });
        delete cfg.tracks[trackName];
        // cleanup availability
        Object.values(cfg.availability||{}).forEach(y=>{ if (y.tracks) delete y.tracks[trackName]; });
        saveConfig(cfg);
        renderTracks(cfg, selectedYear);
        renderElectives(cfg, selectedYear);
      });

      right.appendChild(enabledToggle); right.appendChild(yearAvail); right.appendChild(editBtn); right.appendChild(delBtn);
      header.appendChild(left); header.appendChild(right);

      card.appendChild(header);

      // electives under this track
      const list = document.createElement('div');
      list.style.marginTop = '8px';
      const trackElectives = (cfg.electives || []).filter(e=>e.track === trackName);
      if (!trackElectives.length) {
        const p = document.createElement('div'); p.style.color='#666'; p.style.fontSize='13px'; p.textContent = 'No electives for this track.'; list.appendChild(p);
      } else {
        trackElectives.forEach(e => {
          const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center'; row.style.padding='6px 0';
          const left = document.createElement('div'); left.innerHTML = `<div style="font-weight:600">${e.name}</div><div style="font-size:12px;color:#666">id: ${e.id}</div>`;
          const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center';

          const enabledE = document.createElement('input'); enabledE.type='checkbox'; enabledE.checked = !!e.enabled; enabledE.title = 'Enable elective globally';
          enabledE.addEventListener('change', ()=>{ e.enabled = enabledE.checked; saveConfig(cfg); renderTracks(cfg, selectedYear); renderElectives(cfg, selectedYear); });

          const yearAvailE = document.createElement('input'); yearAvailE.type='checkbox'; yearAvailE.checked = !!(yearsAvail.electives && yearsAvail.electives[e.id]);
          yearAvailE.title = 'Available for the selected school year';
          yearAvailE.addEventListener('change', ()=>{
            cfg.availability = cfg.availability || {};
            cfg.availability[selectedYear] = cfg.availability[selectedYear] || { tracks: {}, electives: {} };
            cfg.availability[selectedYear].electives[e.id] = yearAvailE.checked;
            saveConfig(cfg);
            renderTracks(cfg, selectedYear);
            renderElectives(cfg, selectedYear);
          });

          const editE = document.createElement('button'); editE.className='btn btn-small'; editE.textContent='Edit'; editE.addEventListener('click', ()=>{ const name = prompt('Edit elective name', e.name); if (name){ e.name = name.trim(); saveConfig(cfg); renderTracks(cfg, selectedYear); renderElectives(cfg, selectedYear); } });
          const removeE = document.createElement('button'); removeE.className='btn btn-small btn-danger'; removeE.textContent='Remove'; removeE.addEventListener('click', ()=>{ if (confirm('Remove this elective?')){ cfg.electives = cfg.electives.filter(x=>x.id!==e.id); Object.values(cfg.availability||{}).forEach(y=>{ if (y.electives) delete y.electives[e.id]; }); saveConfig(cfg); renderTracks(cfg, selectedYear); renderElectives(cfg, selectedYear); } });

          right.appendChild(enabledE); right.appendChild(yearAvailE); right.appendChild(editE); right.appendChild(removeE);
          row.appendChild(left); row.appendChild(right); list.appendChild(row);
        });
      }

      card.appendChild(list);
      container.appendChild(card);
    });
  }

  function renderElectives(cfg, selectedYear){
    const container = byId('efmElectivesList');
    container.innerHTML = '';
    const yearsAvail = (cfg.availability && cfg.availability[selectedYear]) || { tracks: {}, electives: {} };
    const all = cfg.electives || [];
    if (!all.length){ container.textContent = 'No electives yet.'; return; }

    // Gather filters from controls (if present)
    const search = (byId('efmSearch') && byId('efmSearch').value || '').trim().toLowerCase();
    const categoryFilter = (byId('efmCategoryFilter') && byId('efmCategoryFilter').value) || '';
    const enabledOnly = (byId('efmEnabledOnly') && byId('efmEnabledOnly').checked) || false;

    // Build category map for unassigned electives, applying filters
    const unassigned = all.filter(e=>!e.track).filter(e=>{
      if (enabledOnly && !e.enabled) return false;
      if (categoryFilter && (e.category||'') !== categoryFilter) return false;
      if (search){ const hay = (e.name+" "+(e.id||'')+" "+(e.category||'')).toLowerCase(); if (!hay.includes(search)) return false; }
      return true;
    });

    // Group by category
    const groups = {};
    unassigned.forEach(e=>{ const cat = e.category || 'Uncategorized'; groups[cat] = groups[cat] || []; groups[cat].push(e); });

    const cats = Object.keys(groups).sort();
    if (!cats.length){ const p=document.createElement('div'); p.className='no-data'; p.textContent='No electives match the current filters.'; container.appendChild(p); return; }

    cats.forEach(cat => {
      const header = document.createElement('div'); header.style.fontWeight='700'; header.style.marginTop='8px'; header.style.marginBottom='6px'; header.textContent = cat;
      container.appendChild(header);
      groups[cat].forEach(e=>{
        const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center'; row.style.padding='8px 10px'; row.style.borderBottom='1px solid rgba(0,0,0,0.03)';
        const left = document.createElement('div'); left.innerHTML = `<div style="font-weight:600">${e.name}</div><div style="font-size:12px;color:#666">id: ${e.id}</div>`;
        const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center';

        const enabledEl = document.createElement('input'); enabledEl.type='checkbox'; enabledEl.checked = !!e.enabled; enabledEl.title = 'Enable elective globally';
        enabledEl.addEventListener('change', ()=>{ e.enabled = enabledEl.checked; saveConfig(cfg); renderElectives(cfg, selectedYear); renderTracks(cfg, selectedYear); });

        const yearAvail = document.createElement('input'); yearAvail.type='checkbox'; yearAvail.checked = !!(yearsAvail.electives && yearsAvail.electives[e.id]);
        yearAvail.title = 'Available for the selected school year';
        yearAvail.addEventListener('change', ()=>{ cfg.availability = cfg.availability || {}; cfg.availability[selectedYear] = cfg.availability[selectedYear] || { tracks: {}, electives: {} }; cfg.availability[selectedYear].electives[e.id] = yearAvail.checked; saveConfig(cfg); renderElectives(cfg, selectedYear); });

        const assignSelect = document.createElement('select'); assignSelect.style.padding='6px'; assignSelect.style.border='1px solid #ddd'; assignSelect.style.borderRadius='6px';
        const optNone = document.createElement('option'); optNone.value=''; optNone.textContent='Assign to track...'; assignSelect.appendChild(optNone);
        Object.keys(cfg.tracks||{}).forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; assignSelect.appendChild(o);} );
        assignSelect.addEventListener('change', ()=>{ const val = assignSelect.value; if (val){ e.track = val; saveConfig(cfg); renderTracks(cfg, selectedYear); renderElectives(cfg, selectedYear); } });

        const editBtn = document.createElement('button'); editBtn.className='btn btn-small'; editBtn.textContent='Edit'; editBtn.addEventListener('click', ()=>{ const name = prompt('Edit elective name', e.name); if (name){ e.name = name.trim(); saveConfig(cfg); renderElectives(cfg, selectedYear); renderTracks(cfg, selectedYear); } });
        const delBtn = document.createElement('button'); delBtn.className='btn btn-small btn-danger'; delBtn.textContent='Remove'; delBtn.addEventListener('click', ()=>{ if (confirm('Remove this elective?')){ cfg.electives = cfg.electives.filter(x=>x.id!==e.id); Object.values(cfg.availability||{}).forEach(y=>{ if (y.electives) delete y.electives[e.id]; }); saveConfig(cfg); renderElectives(cfg, selectedYear); renderTracks(cfg, selectedYear); } });

        right.appendChild(enabledEl); right.appendChild(yearAvail); right.appendChild(assignSelect); right.appendChild(editBtn); right.appendChild(delBtn);
        row.appendChild(left); row.appendChild(right); container.appendChild(row);
      });
    });

    const footer = document.createElement('div'); footer.style.marginTop='10px'; footer.style.color='#666'; footer.textContent = 'Electives assigned to tracks are shown under each track.';
    container.appendChild(footer);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', ()=>{
    const cfg = loadConfig();
    // Seed defaults if empty so admin sees the configured electives immediately
    seedDefaultElectives(cfg);
    // Remove legacy TVL track if present and unassign any TVL electives
    if (cfg.tracks && cfg.tracks['TVL']){
      delete cfg.tracks['TVL'];
      (cfg.electives||[]).forEach(e=>{ if (e.track === 'TVL') e.track = null; });
      saveConfig(cfg);
    }
    // determine current school year from the global activeSchoolYear or localStorage or API
    let currentYear = null;
    async function resolveSelectedYear(){
      if (window.activeSchoolYear && (window.activeSchoolYear.school_year || window.activeSchoolYear.name)) return window.activeSchoolYear.school_year || window.activeSchoolYear.name;
      try{
        const stored = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
        if (stored && (stored.school_year || stored.name)) return stored.school_year || stored.name;
      }catch(e){}
      if (typeof API_BASE !== 'undefined'){
        try{
          const resp = await fetch(API_BASE + '/api/school-years/active');
          if (resp.ok){ const data = await resp.json(); if (data && (data.school_year || data.name)){ window.activeSchoolYear = data; localStorage.setItem('activeSchoolYear', JSON.stringify(data)); return data.school_year || data.name; } }
        }catch(e){}
      }
      try{ const years = JSON.parse(localStorage.getItem(schoolYearsKey) || '[]'); if (years && years.length) return years[0].name || years[0]; }catch(e){}
      return null;
    }

    // Add elective (unassigned)
    byId('efmAddElectiveBtn').addEventListener('click', async ()=>{
      const name = (byId('efmNewElectiveName').value || '').trim();
      if (!name) { alert('Please provide an elective name'); return; }
      const e = { id: generateId(), name, created_at: new Date().toISOString(), track: null, enabled: true };
      cfg.electives = cfg.electives || [];
      cfg.electives.push(e);
      saveConfig(cfg);
      byId('efmNewElectiveName').value = '';
      updateCategoryFilterOptions();
      const selectedYear = currentYear || await resolveSelectedYear(); currentYear = selectedYear;
      renderElectives(cfg, selectedYear);
      renderTracks(cfg, selectedYear);
    });

    // Add track
    const addTrackBtn = byId('efmAddTrackBtn');
    if (addTrackBtn) addTrackBtn.addEventListener('click', async ()=>{
      const name = (byId('efmNewTrackName').value || '').trim();
      if (!name) { alert('Please provide a track name'); return; }
      if (!cfg.tracks) cfg.tracks = {};
      if (cfg.tracks[name]) { alert('Track already exists'); return; }
      cfg.tracks[name] = { enabled: true };
      saveConfig(cfg);
      byId('efmNewTrackName').value = '';
      const selectedYear = currentYear || await resolveSelectedYear(); currentYear = selectedYear;
      // update category filter options in case new categories were added elsewhere
      updateCategoryFilterOptions();
      renderTracks(cfg, selectedYear);
      renderElectives(cfg, selectedYear);
    });

    // helper: populate category filter options
    function updateCategoryFilterOptions(){
      const sel = byId('efmCategoryFilter');
      if (!sel) return;
      const cats = Array.from(new Set((cfg.electives||[]).map(e=>e.category||'Uncategorized'))).sort();
      // preserve selection
      const prev = sel.value || '';
      sel.innerHTML = '<option value="">All Categories</option>';
      cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
      if (prev) sel.value = prev;
    }

    // wire search and filter controls
    const searchEl = byId('efmSearch'); if (searchEl) searchEl.addEventListener('input', async ()=>{ const selYear = currentYear || await resolveSelectedYear(); renderElectives(cfg, selYear); });
    const catEl = byId('efmCategoryFilter'); if (catEl) catEl.addEventListener('change', async ()=>{ const selYear = currentYear || await resolveSelectedYear(); renderElectives(cfg, selYear); });
    const enabledOnlyEl = byId('efmEnabledOnly'); if (enabledOnlyEl) enabledOnlyEl.addEventListener('change', async ()=>{ const selYear = currentYear || await resolveSelectedYear(); renderElectives(cfg, selYear); });

    // initial render using active school year if available
    (async ()=>{ currentYear = await resolveSelectedYear(); updateCategoryFilterOptions(); renderTracks(cfg, currentYear); renderElectives(cfg, currentYear); })();

    // small helper toast
    function showTemp(msg){ const el = document.createElement('div'); el.className='toast success'; el.textContent = msg; document.body.appendChild(el); setTimeout(()=>el.remove(),1400); }
  });
})();



