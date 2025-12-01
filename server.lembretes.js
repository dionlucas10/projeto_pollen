// API wrapper centralizado para operações de lembretes
(function(){
    const BASE = 'https://375a1444b38a.ngrok-free.app/lembretes';

    async function safeFetch(url, opts){
        try{
            const res = await fetch(url, opts);
            const text = await res.text();
            let data;
            try{ data = text ? JSON.parse(text) : null; }catch(e){ data = text; }
            if(!res.ok){
                const err = new Error('HTTP '+res.status+' - '+res.statusText);
                err.status = res.status;
                err.body = data;
                throw err;
            }
            return data;
        }catch(err){
            throw err;
        }
    }

    window.LembretesAPI = {
        baseUrl: BASE,

        // Retorna array de lembretes ou []
        async getAll(){
            return await safeFetch(BASE, { method: 'GET' });
        },

        // Cria um lembrete. Recebe objeto {titulo, corpo, idCriador, dataInicio, dataTermino}
        // Retorna o recurso criado (JSON) ou lança erro.
        async create(rem){
            if(!rem || typeof rem !== 'object') throw new Error('Objeto inválido para criação');
            return await safeFetch(BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rem)
            });
        },

        // Remove lembrete por id (id fornecido no recurso retornado pela API)
        // Retorna true se ok, false caso contrário
        async remove(id){
            if(!id) throw new Error('ID ausente para remoção');
            const url = BASE + '/' + encodeURIComponent(id);
            try{
                await safeFetch(url, { method: 'DELETE' });
                return true;
            }catch(err){
                return false;
            }
        }
        ,
        // -- Local cache and sync helpers (client-side storage)
        _lsKey: 'pollen_reminders',
        _getLocal(){
            try{
                const raw = localStorage.getItem(this._lsKey);
                if(!raw) return [];
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr : [];
            }catch(e){ return []; }
        },
        _saveLocal(arr){
            try{ localStorage.setItem(this._lsKey, JSON.stringify(Array.isArray(arr)?arr:[])); }catch(e){}
        },
        _genTmpId(){ return '__tmp_' + Date.now() + '_' + Math.floor(Math.random()*1000); },

        // Retorna apenas o cache local
        getCached(){ return this._getLocal(); },

        // Adiciona/atualiza item no cache local
        addLocal(item){
            if(!item || typeof item !== 'object') return;
            const arr = this._getLocal();
            if(item.id && !item._id) item._id = item.id;
            if(!item._id && !item._tmpId) item._tmpId = this._genTmpId();
            const key = item._id ? String(item._id) : String(item._tmpId);
            const idx = arr.findIndex(r => String(r._id || r.id || r._tmpId) === key);
            if(idx >= 0) arr[idx] = item; else arr.push(item);
            this._saveLocal(arr);
        },

        removeLocalById(id){
            if(id === undefined || id === null) return;
            const sid = String(id);
            const arr = this._getLocal().filter(r => String(r._id || r.id || r._tmpId) !== sid);
            this._saveLocal(arr);
        },

        // Tenta sincronizar itens locais pendentes com o servidor
        async syncLocalUnsynced(){
            const pending = this._getLocal().filter(r => !(r._id || r.id));
            if(!pending || pending.length === 0) return;
            for(const p of pending.slice()){
                try{
                    const payload = Object.assign({}, p);
                    delete payload._tmpId; delete payload._id;
                    const createdRaw = await this.create(payload);
                    let created = createdRaw;
                    if(createdRaw && typeof createdRaw === 'object'){
                        if(Array.isArray(createdRaw) && createdRaw.length === 1) created = createdRaw[0];
                        else if(createdRaw.data) created = createdRaw.data;
                        else if(createdRaw.result) created = createdRaw.result;
                        else if(createdRaw.created) created = createdRaw.created;
                    }
                    if(Array.isArray(created) && created.length>0) created = created[0];
                    if(created && typeof created === 'object'){
                        if(created.id && !created._id) created._id = created.id;
                        // preserve tmp id to replace
                        created._tmpId = p._tmpId;
                        this.removeLocalById(p._tmpId);
                        this.addLocal(created);
                    }
                }catch(e){
                    // ignore individual failures
                }
            }
        },

        // Retorna lista mesclada: servidor (com prioridade) + itens locais não sincronizados
        async getAllMerged(){
            let serverList = [];
            try{
                serverList = await this.getAll();
            }catch(e){ serverList = []; }
            if(!Array.isArray(serverList)){
                if(serverList && Array.isArray(serverList.data)) serverList = serverList.data;
                else if(serverList && Array.isArray(serverList.result)) serverList = serverList.result;
                else serverList = [];
            }
            const local = this._getLocal();
            const unsynced = (local || []).filter(r => !(r._id || r.id));
            const merged = (serverList || []).slice();
            unsynced.forEach(u => merged.push(u));
            // update local cache to reflect merged view
            this._saveLocal(merged);
            return merged;
        },

        // Tenta criar no servidor; se falhar, salva localmente e retorna objeto salvo (com _tmpId)
        async createWithFallback(rem){
            try{
                const createdRaw = await this.create(rem);
                let created = createdRaw;
                if(createdRaw && typeof createdRaw === 'object'){
                    if(Array.isArray(createdRaw) && createdRaw.length === 1) created = createdRaw[0];
                    else if(createdRaw.data) created = createdRaw.data;
                    else if(createdRaw.result) created = createdRaw.result;
                    else if(createdRaw.created) created = createdRaw.created;
                }
                if(Array.isArray(created) && created.length>0) created = created[0];
                if(created && typeof created === 'object'){
                    if(created.id && !created._id) created._id = created.id;
                    this.addLocal(created);
                    return created;
                }
                // fallback: just save rem locally
                const tmp = Object.assign({}, rem);
                tmp._tmpId = this._genTmpId();
                this.addLocal(tmp);
                return tmp;
            }catch(e){
                const tmp = Object.assign({}, rem);
                tmp._tmpId = this._genTmpId();
                this.addLocal(tmp);
                return tmp;
            }
        },

        // Remove com fallback: se temporário remove local; se servidor remove e atualiza cache
        async removeWithFallback(id){
            if(!id) return false;
            const sid = String(id);
            if(sid.startsWith('__tmp_')){
                this.removeLocalById(sid);
                return true;
            }
            try{
                const ok = await this.remove(id);
                if(ok) this.removeLocalById(id);
                return ok;
            }catch(e){
                return false;
            }
        }
    };
})();
