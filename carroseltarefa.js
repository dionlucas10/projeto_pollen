        // Carrossel de tarefas (com integração com API e suporte a usuários)
        (function () {
            const STORAGE_KEY = 'pollen_tasks_v1';
            const USER_KEY = 'pollen_user_name';
            const USER_ID_KEY = 'pollen_user_id';
            const carousel = document.querySelector('.tasks-carousel');
            if (!carousel) return;
            const track = carousel.querySelector('.carousel-track');
            const prevBtn = carousel.querySelector('.prev-btn');
            const nextBtn = carousel.querySelector('.next-btn');
            const dotsContainer = carousel.querySelector('.carousel-dots');
            let slides = [];
            let dots = [];
            let tasksData = [];
            let currentIndex = 0;
            let autoplayId = null;
            let currentUserId = null;
            let isLoadingFromAPI = false;

            // Obter ID do usuário logado
            function getCurrentUser() {
                try {
                    const userName = localStorage.getItem(USER_KEY);
                    const userId = localStorage.getItem(USER_ID_KEY);
                    return { userName, userId: userId ? parseInt(userId) : null };
                } catch (e) {
                    return { userName: null, userId: null };
                }
            }

            function saveData() {
                try {
                    const copy = (tasksData || []).map(t => Object.assign({}, t));
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
                    console.debug('LocalStorage salvo com', copy.length, 'tarefas');
                } catch (e) {
                    console.warn('Não foi possível salvar em localStorage:', e && e.message ? e.message : e);
                }
            }

            function loadDataFromStorage() {
                try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    if (!raw) return [];
                    const parsed = JSON.parse(raw);
                    if (!Array.isArray(parsed)) return [];
                    return parsed.map(item => ({
                        id: item.id ?? item._id ?? item.idTarefa ?? item.id,
                        title: item.title ?? item.titulo ?? item.nome ?? '',
                        desc: item.desc ?? item.corpo ?? item.body ?? item.descricao ?? '',
                        done: Boolean(item.done ?? item.concluido ?? item.completed ?? false),
                        idCriador: Number(item.idCriador ?? item.idUsuario ?? 0) || null,
                        _local: !!item._local
                    }));
                } catch (e) {
                    console.warn('Erro ao ler localStorage:', e && e.message ? e.message : e);
                    return [];
                }
            }

            function loadDataFromDOM() {
                const initial = Array.from(track.children);
                if (!initial.length) return [];
                return initial.map(sl => {
                    const t = sl.querySelector('.task-title')?.textContent.trim() || '';
                    const d = sl.querySelector('.task-desc')?.textContent.trim() || '';
                    const done = sl.classList.contains('done') || false;
                    return { title: t, desc: d, done };
                });
            }

            // Carregar tarefas da API para o usuário logado
            async function loadDataFromAPI() {
                if (isLoadingFromAPI) return;
                isLoadingFromAPI = true;

                const user = getCurrentUser();
                console.log('Usuário atual:', user);

                if (!user.userId) {
                    console.warn('Usuário não identificado. Nenhuma tarefa carregada.');
                    tasksData = [];
                    isLoadingFromAPI = false;
                    return;
                }

                if (!(window.serverTarefa && window.serverTarefa.getTasksForUser)) {
                    console.error('window.serverTarefa.getTasksForUser não está disponível');
                    tasksData = [];
                    isLoadingFromAPI = false;
                    return;
                }

                try {
                    console.log('Carregando tarefas da API para userId:', user.userId);
                    try { console.log('serverTarefa._internal (info):', window.serverTarefa && window.serverTarefa._internal); } catch(e){}
                    const result = await window.serverTarefa.getTasksForUser(user.userId);
                    console.log('Resultado da API (getTasksForUser):', result);
                    if (result && !result.ok) {
                        console.error('getTasksForUser retornou erro:', { status: result.status, data: result.data, error: result.error });
                    }

                    const apiTasks = (result && result.ok && Array.isArray(result.data)) ? result.data.map(task => ({
                        id: task.id ?? task._id ?? task.idTarefa ?? null,
                        title: task.titulo ?? task.title ?? task.nome ?? '',
                        desc: task.corpo ?? task.desc ?? task.body ?? task.descricao ?? '',
                        done: Boolean(task.concluido ?? task.done ?? task.completed ?? false),
                        idCriador: Number(task.idUsuario ?? task.idCriador ?? task.idCreator ?? task.userId ?? 0) || null
                    })) : [];

                    // Carregar tarefas locais e manter as que não tiverem id de servidor
                    const localTasks = loadDataFromStorage();
                    const localOnly = localTasks.filter(t => !t.id || String(t.id).startsWith('local-') || t._local);

                    // Unir: priorizar API (por id) e então anexar locais não sincronizados
                    tasksData = apiTasks.slice();
                    if (localOnly.length) {
                        // garantir que não haja duplicatas óbvias
                        localOnly.forEach(lt => tasksData.push(Object.assign({}, lt, { _local: true })));
                    }
                    // Atualizar armazenamento local para refletir o estado atual (API + pendentes)
                    saveData();
                    console.log('Tarefas carregadas. API:', apiTasks.length, 'Locais (pendentes):', localOnly.length);
                } catch (e) {
                    console.error('Erro ao carregar tarefas da API:', e);
                    // Em caso de erro na API, carregar apenas as tarefas locais
                    tasksData = loadDataFromStorage();
                }

                isLoadingFromAPI = false;
            }

            async function loadData() {
                await loadDataFromAPI();
            }

            // cria um dot para o índice i
            function createDot(i) {
                const dot = document.createElement('button');
                dot.className = 'carousel-dot';
                dot.setAttribute('aria-label', 'Ir para slide ' + (i + 1));
                dot.addEventListener('click', () => goTo(i));
                dotsContainer.appendChild(dot);
                return dot;
            }

            // cria elemento do slide a partir do objeto de dados
            function createSlideElement(task) {
                const slide = document.createElement('div');
                slide.className = 'task-card' + (task.done ? ' done' : '');
                slide.setAttribute('role', 'listitem');
                slide.setAttribute('tabindex', '0');
                slide.innerHTML = `
                    <div class="task-top">
                        <label class="task-done"><input type="checkbox" class="task-done-checkbox" ${task.done ? 'checked' : ''} /> Concluída</label>
                    </div>
                    <h2 class="task-title">${escapeHTML(task.title)}</h2>
                    <p class="task-desc">${escapeHTML(task.desc)}</p>
                `;
                return slide;
            }

            // Bind handlers de interação para um slide (inclui checkbox toggle)
            function bindSlide(slide) {
                if (!slide.hasAttribute('tabindex')) slide.setAttribute('tabindex', '0');
                slide.addEventListener('click', (e) => {
                    // ignore clicks on the checkbox itself
                    if (e.target.closest('.task-done-checkbox')) return;
                    // play jump animation, then open modal in edit mode
                    slide.classList.add('jump');
                    const idx = Array.from(track.children).indexOf(slide);
                    setTimeout(() => { openModal('edit', idx); }, 220);
                });
                slide.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); slide.classList.add('jump'); }
                });
                slide.addEventListener('animationend', () => { slide.classList.remove('jump'); });

                const cb = slide.querySelector('.task-done-checkbox');
                if (cb) {
                    cb.addEventListener('change', async () => {
                        const idx = Array.from(track.children).indexOf(slide);
                        if (idx < 0 || idx >= tasksData.length) return;
                        tasksData[idx].done = !!cb.checked;
                        if (cb.checked) slide.classList.add('done'); else slide.classList.remove('done');
                        // Remover: saveData(); - Agora só atualiza na API

                        // Atualizar na API se existir ID
                        if (tasksData[idx].id && window.serverTarefa && window.serverTarefa.updateTask) {
                            const user = getCurrentUser();
                            await window.serverTarefa.updateTask(tasksData[idx].id, {
                                title: tasksData[idx].title,
                                desc: tasksData[idx].desc,
                                done: tasksData[idx].done,
                                idCriador: user.userId
                            });
                        }
                    });
                }
            }

            function renderAll() {
                track.innerHTML = '';
                dotsContainer.innerHTML = '';
                tasksData.forEach((task, i) => {
                    const slide = createSlideElement(task);
                    track.appendChild(slide);
                    bindSlide(slide);
                    createDot(i);
                });
                slides = Array.from(track.children);
                dots = Array.from(dotsContainer.children);
                // garantir índice válido
                if (currentIndex >= slides.length) currentIndex = Math.max(0, slides.length - 1);
                update();
            }

            function update() {
                const target = slides[currentIndex];
                if (!target) return;
                const offset = target.offsetLeft - track.offsetLeft;
                track.style.transform = `translateX(${-offset}px)`;
                dots.forEach(d => d.classList.remove('active'));
                if (dots[currentIndex]) dots[currentIndex].classList.add('active');
            }

            function prev() { currentIndex = Math.max(0, currentIndex - 1); update(); resetAutoplay(); }
            function next() { currentIndex = Math.min(slides.length - 1, currentIndex + 1); update(); resetAutoplay(); }
            function goTo(i) { currentIndex = Math.max(0, Math.min(slides.length - 1, i)); update(); resetAutoplay(); }

            prevBtn.addEventListener('click', prev);
            nextBtn.addEventListener('click', next);

            // Keyboard (navegação por setas)
            carousel.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') prev();
                if (e.key === 'ArrowRight') next();
            });

            // Autoplay
            function startAutoplay() {
                stopAutoplay();
                if (slides.length <= 1) return;
                autoplayId = setInterval(() => { currentIndex = (currentIndex + 1) % slides.length; update(); }, 4000);
            }
            function stopAutoplay() { if (autoplayId) clearInterval(autoplayId); autoplayId = null; }
            function resetAutoplay() { stopAutoplay(); startAutoplay(); }

            carousel.addEventListener('mouseenter', stopAutoplay);
            carousel.addEventListener('mouseleave', startAutoplay);

            // Touch support (swipe)
            let startX = 0;
            carousel.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; stopAutoplay(); }, { passive: true });
            carousel.addEventListener('touchend', (e) => {
                const endX = e.changedTouches[0].clientX;
                const diff = endX - startX;
                if (diff > 40) prev(); else if (diff < -40) next();
                startAutoplay();
            });

            // Resize: manter slide atual visível
            window.addEventListener('resize', update);

            // Função utilitária para escapar HTML simples (segurança básica)
            function escapeHTML(str) {
                return String(str).replace(/[&"'<>]/g, function (s) {
                    return ({ '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[s];
                });
            }

            // Adicionar tarefa na API
            async function addTaskToAPI(title, desc, done = false) {
                const user = getCurrentUser();
                console.log('📝 addTaskToAPI - Usuário:', user);

                if (!user.userId) {
                    console.error('❌ Usuário não identificado. Tarefa não será salva na API.');
                    alert('Você precisa estar logado para adicionar tarefas!');
                    return null;
                }

                if (!window.serverTarefa || !window.serverTarefa.createTask) {
                    console.error('❌ window.serverTarefa ou createTask não disponível');
                    console.log('window.serverTarefa:', window.serverTarefa);
                    return null;
                }

                try {
                    // Montar payload no formato esperado pelo backend
                    const payload = {
                        titulo: title,
                        corpo: desc,
                        idUsuario: Number(user.userId) || 0,
                        concluido: Boolean(done)
                    };
                    console.log('📤 Chamando createTask com payload:', payload);
                    try { console.log('serverTarefa._internal (info):', window.serverTarefa && window.serverTarefa._internal); } catch(e){}
                    const result = await window.serverTarefa.createTask(payload);
                    console.log('📥 Resposta de createTask:', result);
                    if (result && !result.ok) {
                        console.error('createTask retornou erro:', { status: result.status, data: result.data, error: result.error });
                    }

                    if (result && result.ok) {
                        // Se servidor retornou o item criado no body, normalize e retornar
                        const created = result.data && (typeof result.data === 'object') ? result.data : null;
                        return { ok: true, status: result.status, created };
                    }

                    // Senão, retornar objeto de erro para tratamento por quem chamou
                    return { ok: false, status: result && result.status, data: result && result.data, error: result && result.error };
                } catch (e) {
                    console.error('❌ Exceção ao enviar tarefa para API:', e);
                    return { ok: false, error: e };
                }
            }

            // Adicionar tarefa localmente (atualiza UI e storage + API)
            async function addTaskLocal(title, desc, done = false) {
                // Chama API
                const res = await addTaskToAPI(title, desc, done);
                // Se não conseguiu salvar na API, persistir localmente sem mostrar alerta
                if (!res || !res.ok) {
                    console.warn('Falha ao criar tarefa na API. Salvando localmente como pendente.', res);
                    const user = getCurrentUser();
                    const localTask = {
                        id: 'local-' + Date.now() + '-' + Math.round(Math.random() * 1000),
                        title,
                        desc,
                        done: !!done,
                        idCriador: user.userId || null,
                        _local: true
                    };
                    tasksData.push(localTask);
                    saveData();
                    renderAll();
                    goTo(Math.max(0, tasksData.length - 1));
                    startAutoplay();
                    return localTask;
                }

                // Após sucesso no POST, recarregar a lista do servidor para garantir consistência
                await loadDataFromAPI();
                renderAll();
                // ir para o último item
                goTo(Math.max(0, tasksData.length - 1));
                startAutoplay();
                return tasksData[tasksData.length - 1] ?? null;
            }

            // botão de adicionar tarefa -> abrir modal (o modal já existe no HTML)
            const addBtn = document.getElementById('addTaskBtn');
            const modal = document.getElementById('taskModal');
            const taskForm = document.getElementById('taskForm');
            const cancelBtn = document.getElementById('cancelTaskBtn');
            const titleInput = document.getElementById('taskTitle');
            const descInput = document.getElementById('taskDesc');
            const doneInput = document.getElementById('taskDone');

            if (addBtn && modal && taskForm) {
                let editIndex = -1;
                let modalMode = 'add'; // 'add' or 'edit'

                function openModal(mode = 'add', index = -1) {
                    modal.classList.add('open');
                    modal.setAttribute('aria-hidden', 'false');
                    modalMode = mode;
                    editIndex = index;
                    const deleteBtn = document.getElementById('deleteTaskBtn');
                    const submitBtn = document.getElementById('submitTaskBtn');
                    if (mode === 'add') {
                        if (deleteBtn) deleteBtn.style.display = 'none';
                        if (submitBtn) submitBtn.textContent = 'Adicionar';
                        taskForm.reset();
                    } else {
                        if (deleteBtn) deleteBtn.style.display = '';
                        if (submitBtn) submitBtn.textContent = 'Salvar';
                        const t = tasksData[index] || { title: '', desc: '', done: false };
                        titleInput.value = t.title;
                        descInput.value = t.desc;
                        if (doneInput) doneInput.checked = !!t.done;
                    }
                    setTimeout(() => { if (titleInput) titleInput.focus(); }, 50);
                    stopAutoplay();
                }

                function closeModal() {
                    modal.classList.remove('open');
                    modal.setAttribute('aria-hidden', 'true');
                    taskForm.reset();
                    addBtn.focus();
                    modalMode = 'add';
                    editIndex = -1;
                    startAutoplay();
                }

                addBtn.addEventListener('click', () => openModal('add'));
                cancelBtn && cancelBtn.addEventListener('click', closeModal);

                taskForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    console.log('📋 Form submit - modalMode:', modalMode);
                    
                    const title = titleInput.value.trim();
                    if (!title) { 
                        console.warn('⚠️ Título vazio');
                        titleInput.focus(); 
                        return; 
                    }
                    
                    const desc = descInput.value.trim();
                    const done = !!(doneInput && doneInput.checked);
                    
                    console.log('📝 Dados do form:', { title, desc, done, modalMode });
                    
                    if (modalMode === 'add') {
                        console.log('➕ Modo ADD - chamando addTaskLocal');
                        // adicionar via API
                        await addTaskLocal(title, desc, done);
                    } else if (modalMode === 'edit' && editIndex >= 0) {
                        console.log('✏️ Modo EDIT - atualizando tarefa index:', editIndex);
                        tasksData[editIndex].title = title;
                        tasksData[editIndex].desc = desc;
                        tasksData[editIndex].done = done;
                        // Remover: saveData(); - Agora só atualiza na API
                        renderAll();
                        goTo(editIndex);

                        // Atualizar na API se tiver ID
                        if (tasksData[editIndex].id && window.serverTarefa && window.serverTarefa.updateTask) {
                            const user = getCurrentUser();
                            await window.serverTarefa.updateTask(tasksData[editIndex].id, {
                                title: title,
                                desc: desc,
                                done: done,
                                idCriador: user.userId
                            });
                        }
                    }
                    closeModal();
                });

                // excluir tarefa
                const deleteBtn = document.getElementById('deleteTaskBtn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async () => {
                        if (modalMode === 'edit' && editIndex >= 0) {
                            if (!confirm('Excluir esta tarefa?')) return;
                            
                            const taskToDelete = tasksData[editIndex];
                            
                            // Deletar da API se tiver ID
                            if (taskToDelete.id && window.serverTarefa && window.serverTarefa.deleteTask) {
                                await window.serverTarefa.deleteTask(taskToDelete.id);
                            }

                            tasksData.splice(editIndex, 1);
                            // Remover: saveData(); - Agora só atualiza na API
                            renderAll();
                        }
                        closeModal();
                    });
                }

                // fechar ao clicar no overlay ou fora do conteúdo
                modal.addEventListener('click', (e) => {
                    if (e.target === modal || e.target.classList.contains('modal-overlay')) closeModal();
                });

                // ESC para fechar
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
                });
            }

            // Inicialização: carregar dados da API e renderizar
            (async () => {
                console.log('🚀 Iniciando carroseltarefa.js');
                console.log('window.serverTarefa disponível?', !!window.serverTarefa);
                await loadData();
                renderAll();
                startAutoplay();
                console.log('✅ Carrossel inicializado');
            })();
        })();