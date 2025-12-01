// colmeia.js - gerencia a criação e renderização dos "favos" (pentágonos)

(function(){
    const API_URL = 'https://375a1444b38a.ngrok-free.app/colmeias';

    function $(sel){ return document.querySelector(sel); }
    function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

    let currentViewId = null;
    let editingId = null;

    function loadLocalItems(){
        try{
            const raw = localStorage.getItem('colmeia_local') || '[]';
            return JSON.parse(raw);
        }catch(e){ return []; }
    }

    function saveLocalItems(items){
        try{ localStorage.setItem('colmeia_local', JSON.stringify(items)); }catch(e){}
    }

    function loadPending(){
        try{ return JSON.parse(localStorage.getItem('colmeia_pending') || '[]'); }catch(e){ return []; }
    }

    function savePending(list){
        try{ localStorage.setItem('colmeia_pending', JSON.stringify(list)); }catch(e){}
    }

    function addPending(item){
        const p = loadPending(); p.push(item); savePending(p);
    }

    function removePendingById(id){
        const p = loadPending().filter(x=>x.id !== id); savePending(p);
    }

    function removeLocalById(id){
        const arr = loadLocalItems().filter(x=>x.id !== id); saveLocalItems(arr);
    }

    function markLocalSynced(id, serverId){
        try{
            const arr = loadLocalItems();
            const idx = arr.findIndex(x=>x.id === id);
            if(idx >= 0){
                arr[idx].synced = true;
                if(serverId) arr[idx].serverId = serverId;
                saveLocalItems(arr);
            }
        }catch(e){ console.debug('markLocalSynced failed', e); }
    }

    async function trySyncPending(){
        const pending = loadPending();
        if(!pending || pending.length === 0) return;
        for(const item of pending.slice()){
            try{
                const idCriador = Number(localStorage.getItem('pollen_user_id')) || 0;
                if(!idCriador) continue; // não temos usuário para sincronizar ainda
                const payload = { descricao: item.title || item.body || '', idCriador };
                const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
                if(res.ok){
                    removePendingById(item.id);
                    // marcar como sincronizado; não removemos item local imediatamente para
                    // manter a visualização até o servidor aparecer nas listagens
                    markLocalSynced(item.id);
                    await renderAll();
                }
            }catch(e){ console.debug('Sync failed for', item.id); }
        }
    }

    // tenta sincronizar ao subir e quando ficar online
    window.addEventListener('online', ()=>{ trySyncPending(); });
    setInterval(()=>{ trySyncPending(); }, 60_000);

    async function fetchFavos(){
        try {
            const res = await fetch(API_URL);
            if (!res.ok) throw new Error('Erro ao buscar favos');
            const data = await res.json();
            let serverItems = [];
            if(Array.isArray(data)){
                serverItems = data.map(item => ({
                    id: item.id ?? item.idColmeia ?? null,
                    title: item.title ?? item.descricao ?? '',
                    body: item.body ?? '',
                    raw: item
                }));
            }
            // inclui itens locais que ainda não existem no servidor
            const localItems = loadLocalItems() || [];
            const serverIds = new Set(serverItems.map(s=>s.id));
            const merged = serverItems.concat(localItems.filter(l=> !serverIds.has(l.id)));
            return merged;
        } catch (e) {
            console.error('fetchFavos error', e);
            // se falhar ao buscar do servidor, retorna itens locais para não perder visibilidade
            return loadLocalItems() || [];
        }
    }

    async function postFavo(item){
        // Salva localmente para resposta imediata na UI
        try{
            const locals = loadLocalItems(); locals.push(item); saveLocalItems(locals);
            console.debug('postFavo: salvo localmente', item.id);
        }catch(e){ console.debug('Não foi possível salvar localmente'); }

        // tenta enviar ao backend; em caso de falha enfileira para retry
        try {
            const idCriador = Number(localStorage.getItem('pollen_user_id')) || 0;
            const payload = { descricao: item.title || item.body || '', idCriador };
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok){
                // Sucesso: marca item local como sincronizado e remove da fila de pendentes
                markLocalSynced(item.id);
                removePendingById(item.id);
                console.debug('postFavo: sincronizado com sucesso', item.id);
                await renderAll();
                return true;
            }
            // falha do servidor: enfileira
            console.warn('postFavo: servidor respondeu com erro', res.status);
            addPending(item);
            alert('Servidor respondeu com erro. Item enfileirado para envio.');
            return false;
        } catch (e) {
            console.warn('Falha ao enviar para API, enfileirando item', e);
            addPending(item);
            alert('Sem conexão com o servidor. Item salvo localmente e enfileirado.');
            return false;
        }
    }

    function createFavoElement(item){
        const el = document.createElement('div');
        el.className = 'favo';
        el.setAttribute('data-id', item.id);
        if(item.title) el.setAttribute('data-title', item.title);
        el.setAttribute('role','button');
        el.setAttribute('tabindex','0');
        el.addEventListener('click', ()=> openView(item.id));
        el.addEventListener('keydown', (ev)=>{ if(ev.key === 'Enter'){ ev.preventDefault(); openView(item.id); } });

        // Tooltip handlers: show title on hover/focus using a global tooltip element
        el.addEventListener('mouseenter', ()=> showFavoTooltip(el));
        el.addEventListener('mouseleave', hideFavoTooltip);
        el.addEventListener('focus', ()=> showFavoTooltip(el));
        el.addEventListener('blur', hideFavoTooltip);
        return el;
    }

    /* ---------- Tooltip (DOM, appended to body) ---------- */
    function ensureTooltipEl(){
        let t = document.getElementById('favoTooltip');
        if(!t){
            t = document.createElement('div');
            t.id = 'favoTooltip';
            document.body.appendChild(t);
        }
        return t;
    }

    let _tooltipHideTimer = null;
    function showFavoTooltip(el){
        if(!el) return;
        const title = el.getAttribute('data-title') || '';
        if(!title) return;
        const tip = ensureTooltipEl();
        tip.textContent = title;
        // remove any pending hide
        if(_tooltipHideTimer){ clearTimeout(_tooltipHideTimer); _tooltipHideTimer = null; }
        // position after content is set so measurements are accurate
        requestAnimationFrame(()=>{
            const rect = el.getBoundingClientRect();
            const tipRect = tip.getBoundingClientRect();
            // compute centered X, with clamp to viewport edges
            const margin = 8;
            let left = rect.left + (rect.width/2) - (tipRect.width/2) + window.scrollX;
            const maxLeft = window.scrollX + document.documentElement.clientWidth - tipRect.width - margin;
            const minLeft = window.scrollX + margin;
            left = Math.min(Math.max(left, minLeft), maxLeft);
            let top = rect.top + window.scrollY - tipRect.height - 10; // above element
            if(top < window.scrollY + margin){ // if not enough space above, place below
                top = rect.bottom + window.scrollY + 8;
            }
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
            // show
            tip.classList.add('show');
        });
    }

    function hideFavoTooltip(){
        const tip = document.getElementById('favoTooltip');
        if(!tip) return;
        // fade out; remove class then clear text shortly after
        tip.classList.remove('show');
        if(_tooltipHideTimer) clearTimeout(_tooltipHideTimer);
        _tooltipHideTimer = setTimeout(()=>{ if(tip) tip.textContent = ''; _tooltipHideTimer = null; }, 250);
    }

    // hide tooltip on scroll/resize to avoid stale position
    window.addEventListener('scroll', hideFavoTooltip, true);
    window.addEventListener('resize', hideFavoTooltip);

    async function renderAll(){
        const grid = document.getElementById('hiveGrid');
        if(!grid) return;
        grid.innerHTML = '';
        const favos = await fetchFavos();
        if(!favos || favos.length === 0) return;
        const coords = hexSpiralCoords(favos.length);
        favos.forEach((f, idx) => {
            const el = createFavoElement(f);
            const ax = coords[idx].q;
            const ay = coords[idx].r;
            const pos = axialToPixel(ax, ay);
            el.style.position = 'absolute';
            el.style.left = '50%';
            el.style.top = '50%';
            el.style.pointerEvents = 'auto';
            el.style.zIndex = '20';
            el.style.transform = `translate(-50%,-50%) translate(${pos.x}px, ${pos.y}px)`;
            grid.appendChild(el);
        });
    }

    function axialToPixel(q, r){
        const W = 110;
        const scale = 1.0;
        const size = (W / 2) * scale;
        const x = 1.5 * size * q;
        const y = Math.sqrt(3) * size * (r + q / 2);
        return { x: Math.round(x), y: Math.round(y) };
    }

    function hexSpiralCoords(count){
        const results = [];
        if(count <= 0) return results;
        const dirs = [ [1,-1,0], [1,0,-1], [0,1,-1], [-1,1,0], [-1,0,1], [0,-1,1] ];
        function cube_add(a,b){ return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
        function cube_scale(a, k){ return [a[0]*k, a[1]*k, a[2]*k]; }
        function cube_to_axial(c){ return { q: c[0], r: c[2] }; }
        let radius = 1;
        while(results.length < count){
            let cube = cube_scale(dirs[4], radius);
            for(let side=0; side<6; side++){
                for(let step=0; step<radius; step++){
                    if(results.length >= count) break;
                    const axial = cube_to_axial(cube);
                    if(!(axial.q === 0 && axial.r === 0)) results.push(axial);
                    cube = cube_add(cube, dirs[side]);
                }
                if(results.length >= count) break;
            }
            radius++;
            if(radius > 50) break;
        }
        return results.slice(0, count);
    }

    function openModal(open){
        const modal = document.getElementById('favoModal');
        if(!modal) return;
        modal.setAttribute('aria-hidden', open ? 'false' : 'true');
        if(open){
            setTimeout(()=>{ const t = document.getElementById('favoTitle'); if(t) t.focus(); }, 50);
        } else {
            editingId = null;
            const submitBtn = document.querySelector('#favoForm button[type="submit"]');
            if(submitBtn) submitBtn.textContent = 'Adicionar';
        }
    }

    async function openView(id){
        const favos = await fetchFavos();
        const item = favos.find(f=>f.id === id);
        if(!item) return;
        currentViewId = id;
        const titleEl = document.getElementById('favoViewTitle');
        const bodyEl = document.getElementById('favoViewBody');
        if(titleEl) titleEl.textContent = item.title || 'Sem título';
        if(bodyEl) bodyEl.textContent = item.body || '';
        const modal = document.getElementById('favoViewModal');
        if(modal) modal.setAttribute('aria-hidden','false');
    }

    function closeView(){
        currentViewId = null;
        const modal = document.getElementById('favoViewModal');
        if(modal) modal.setAttribute('aria-hidden','true');
    }

    function nextId(){ return 'favo_' + Date.now() + '_' + Math.floor(Math.random()*9000+1000); }

    document.addEventListener('DOMContentLoaded', ()=>{
        renderAll();
        const addBtn = document.getElementById('addFavoBtn');
        const cancelBtn = document.getElementById('cancelFavo');
        const form = document.getElementById('favoForm');
        const closeViewBtn = document.getElementById('closeViewBtn');
        const deleteViewBtn = document.getElementById('deleteViewBtn');
        const editViewBtn = document.getElementById('editViewBtn');

        if(addBtn) addBtn.addEventListener('click', ()=>{
            document.getElementById('favoForm').reset();
            editingId = null;
            openModal(true);
            document.getElementById('favoTitle').focus();
        });

        if(cancelBtn) cancelBtn.addEventListener('click', ()=> openModal(false));

        if(closeViewBtn) closeViewBtn.addEventListener('click', ()=> closeView());

        // Remover lógica de exclusão local, pois depende da API
        if(deleteViewBtn) deleteViewBtn.addEventListener('click', ()=>{
            alert('Exclusão de favo não implementada na API.');
        });

        if(editViewBtn) editViewBtn.addEventListener('click', async ()=>{
            if(!currentViewId) return;
            const favos = await fetchFavos();
            const item = favos.find(f=>f.id === currentViewId);
            if(!item) return;
            document.getElementById('favoTitle').value = item.title || '';
            document.getElementById('favoBody').value = item.body || '';
            editingId = item.id;
            const submitBtn = document.querySelector('#favoForm button[type="submit"]');
            if(submitBtn) submitBtn.textContent = 'Salvar';
            closeView();
            openModal(true);
        });

        if(form){
            form.addEventListener('submit', async (e)=>{
                e.preventDefault();
                const title = document.getElementById('favoTitle').value.trim();
                const body = document.getElementById('favoBody').value.trim();
                if(!title){ alert('Informe um título para o favo'); return; }

                // Criação via POST na API
                if(!editingId){
                    const item = { id: nextId(), title, body };
                    await postFavo(item);
                    await renderAll();
                    openModal(false);
                    return;
                }
                // Edição não implementada na API
                alert('Edição de favo não implementada na API.');
            });
        }
    });

})();
