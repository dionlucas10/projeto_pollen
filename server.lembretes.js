// API wrapper centralizado para operações de lembretes
(function(){
    const BASE = 'https://daccf75f6eef.ngrok-free.app/lembretes';

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
    };
})();
