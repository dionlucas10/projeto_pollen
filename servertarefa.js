// Integração com API remota para tarefas
// Fornece métodos assíncronos expostos em window.serverTarefa:
// setApiUrl(url), createTask(payload), getTasks(), updateTask(id,payload), deleteTask(id), getTasksForUser(userId)
(function () {
    const DEFAULT_API = 'https://375a1444b38a.ngrok-free.app/tarefas';
    let API_URL = DEFAULT_API;
    let CURRENT_USER_ID = null;

    function setApiUrl(url) {
        if (typeof url === 'string' && url.trim()) API_URL = url.trim();
    }

    function setCurrentUserId(userId) {
        CURRENT_USER_ID = userId;
    }

    function getCurrentUserId() {
        return CURRENT_USER_ID;
    }

    async function safeFetch(url, options) {
        try {
            console.debug('safeFetch -> url:', url, 'options:', options);
            // Use options as-is but ensure it's an object
            const fetchOptions = Object.assign({}, options || {});
            // Do not override caller's mode; but ensure headers exist when body present
            if (fetchOptions.body && !fetchOptions.headers) fetchOptions.headers = { 'Content-Type': 'application/json' };
            console.debug('safeFetch -> fetchOptions (final):', fetchOptions);
            const res = await fetch(url, fetchOptions);
            const contentType = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
            let body = null;
            if (contentType.includes('application/json')) {
                body = await res.json().catch(() => null);
            } else {
                body = await res.text().catch(() => null);
            }
            if (!res.ok) return { ok: false, status: res.status, data: body };
            return { ok: true, status: res.status, data: body };
        } catch (error) {
            console.error('safeFetch erro ao chamar', url, options, error);
            const errMsg = error && error.message ? error.message : String(error);
            return { ok: false, error: { message: errMsg, stack: error && error.stack } };
        }
    }

    // (sem persistência local — uso direto da API)

    // Mapeia um payload mais genérico para o formato que a API espera
    function mapToApiPayload(input) {
        // input pode ter: title, desc, titulo, corpo, idCriador, idUsuario, qtdEtapas, done/concluido
        const titulo = input.titulo ?? input.title ?? '';
        const corpo = input.corpo ?? input.desc ?? input.body ?? '';
        const idUsuario = Number(input.idUsuario ?? input.idCriador ?? input.idCreator ?? 0) || 0;
        const qtdEtapas = Number(input.qtdEtapas ?? input.steps ?? 0) || 0;
        const concluido = Boolean(input.concluido ?? input.done ?? false);
        return { titulo, corpo, idUsuario, qtdEtapas, concluido };
    }

    // CREATE (POST)
    async function createTask(input) {
        // Simples wrapper POST que retorna o objeto normalizado { ok, status, data }
        const payload = mapToApiPayload(input || {});
        const opts = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'omit'
        };
        console.log('🔵 POST /tarefas - Enviando para', API_URL, 'payload:', payload);
        const result = await safeFetch(API_URL, opts);
        console.log('🟢 POST /tarefas - Resposta:', result);
        // Alguns servidores retornam o item criado no body; outros retornam vazio com 201.
        // Normalizamos: se status 201/200 e body vazio, marcar ok=true.
        if (result && !result.ok && (result.status === 201 || result.status === 200)) {
            result.ok = true;
        }
        if (!result || !result.ok) {
            console.error('POST falhou. Detalhes:', { url: API_URL, opts, result, online: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown' });
        }
        return result;
    }

    // READ (GET) - tenta obter lista do endpoint (assume que API suporte GET /tarefas)
    async function getTasks() {
        console.log('🔵 GET /tarefas - Buscando todas as tarefas');
        const result = await safeFetch(API_URL, { method: 'GET', credentials: 'omit' });
        console.log('🟢 GET /tarefas - Resposta:', result);
        return result;
    }

    // READ (GET) - obter tarefas de um usuário específico por ID de criador
    async function getTasksForUser(userId) {
        if (userId == null) return { ok: false, error: new Error('userId required') };
        // API espera 'idUsuario' como parâmetro (conforme documentação)
        const url = API_URL + '?idUsuario=' + encodeURIComponent(userId);
        console.log('🔵 GET /tarefas?idUsuario=' + userId + ' - Buscando tarefas do usuário');
        const result = await safeFetch(url, { method: 'GET', credentials: 'omit' });
        console.log('🟢 GET /tarefas?idUsuario=' + userId + ' - Resposta:', result);
        // Se servidor devolveu wrapper { data: [...] } ou array diretamente, normalize
        if (result && result.ok) {
            const data = Array.isArray(result.data) ? result.data : (result.data && Array.isArray(result.data.data) ? result.data.data : []);
            return { ok: true, status: result.status, data };
        }
        return result;
    }

    // UPDATE (PUT/PATCH) - tenta PUT em /tarefas/{id}
    async function updateTask(id, input) {
        if (id == null) return { ok: false, error: new Error('id required') };
        const payload = mapToApiPayload(input || {});
        const url = API_URL.replace(/\/?$/, '/') + encodeURIComponent(id);
        console.log('🔵 PUT ' + url + ' - Atualizando tarefa:', payload);
        const result = await safeFetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'omit'
        });
        console.log('🟢 PUT ' + url + ' - Resposta:', result);
        return result;
    }

    // DELETE - /tarefas/{id}
    async function deleteTask(id) {
        if (id == null) return { ok: false, error: new Error('id required') };
        const url = API_URL.replace(/\/?$/, '/') + encodeURIComponent(id);
        console.log('🔵 DELETE ' + url + ' - Deletando tarefa');
        const result = await safeFetch(url, { method: 'DELETE', credentials: 'omit' });
        console.log('🟢 DELETE ' + url + ' - Resposta:', result);
        return result;
    }

    // Expor utilitários em window.serverTarefa
    if (typeof window !== 'undefined') {
        window.serverTarefa = window.serverTarefa || {};
        window.serverTarefa.setApiUrl = setApiUrl;
        window.serverTarefa.createTask = createTask;
        window.serverTarefa.getTasks = getTasks;
        window.serverTarefa.updateTask = updateTask;
        window.serverTarefa.deleteTask = deleteTask;
        window.serverTarefa.getTasksForUser = getTasksForUser;
        window.serverTarefa.setCurrentUserId = setCurrentUserId;
        window.serverTarefa.getCurrentUserId = getCurrentUserId;
        // sem helpers de persistência local
        window.serverTarefa._internal = { DEFAULT_API };
        console.log('✅ window.serverTarefa foi inicializado:', window.serverTarefa);
    }

    // Module export for CommonJS (optional)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { setApiUrl, createTask, getTasks, updateTask, deleteTask };
    }
})();
