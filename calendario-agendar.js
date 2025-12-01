// Calendário animado para Projeto Pollen
// - Renderiza mês atual
// - Permite navegar entre meses
// - Ao clicar em um dia abre modal para adicionar título/descrição
// - Eventos são salvos em localStorage na chave 'pollenEvents'
// - Datas com evento aparecem marcadas e o dia atual tem destaque

(function(){
    const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const storageKey = 'pollenEvents';

    let current = new Date();

    const monthYearEl = document.getElementById('monthYear');
    const calendarGrid = document.getElementById('calendarGrid');
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');

    const modalOverlay = document.getElementById('modalOverlay');
    const eventForm = document.getElementById('eventForm');
    const eventDateInput = document.getElementById('eventDate');
    const eventTitle = document.getElementById('eventTitle');
    const eventBody = document.getElementById('eventBody');
    const cancelBtn = document.getElementById('cancelBtn');
    const deleteBtn = document.getElementById('deleteEvent');
    const eventsListEl = document.getElementById('eventsList');

    function loadEvents(){
        try{
            const raw = localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw) : {};
        }catch(e){
            console.error('Erro ao ler eventos:', e);
            return {};
        }
    }

    function saveEvents(data){
        try{
            localStorage.setItem(storageKey, JSON.stringify(data));
        }catch(e){console.error('Erro ao salvar eventos', e)}
    }

    function dateKey(year,month,day){
        return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }

    function render(){
        calendarGrid.innerHTML = '';
        const year = current.getFullYear();
        const month = current.getMonth();

        monthYearEl.textContent = `${MONTHS[month]} ${year}`;

        // Primeiro dia do mês
        const firstOfMonth = new Date(year, month, 1);
        const startDay = firstOfMonth.getDay(); // 0..6

        // Quantos dias no mês
        const daysInMonth = new Date(year, month+1, 0).getDate();
        // Dias do mês anterior para preencher
        const prevDays = startDay; // quantidade de células antes do dia 1
        const totalCells = Math.ceil((prevDays + daysInMonth) / 7) * 7;

        const events = loadEvents();
        const today = new Date();

        for(let i=0;i<totalCells;i++){
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            // calcula data referente à célula
            const dayNumber = i - prevDays + 1;
            let cellDate;
            if(dayNumber <= 0){
                // dias do mês anterior
                const prevMonthDate = new Date(year, month, 0); // último dia mês anterior
                const d = prevMonthDate.getDate() + dayNumber;
                cellDate = new Date(year, month-1, d);
                cell.classList.add('outside');
            } else if (dayNumber > daysInMonth){
                // próximo mês
                const d = dayNumber - daysInMonth;
                cellDate = new Date(year, month+1, d);
                cell.classList.add('outside');
            } else {
                cellDate = new Date(year, month, dayNumber);
            }

            const dayNumEl = document.createElement('div');
            dayNumEl.className = 'day-number';
            dayNumEl.textContent = cellDate.getDate();
            cell.appendChild(dayNumEl);

            const key = dateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
            if(events[key]){
                const dot = document.createElement('div');
                dot.className = 'event-dot';
                cell.appendChild(dot);
                cell.classList.add('has-event');
            }

            // destaque se for hoje
            if(cellDate.getFullYear() === today.getFullYear() && cellDate.getMonth() === today.getMonth() && cellDate.getDate() === today.getDate()){
                cell.classList.add('today');
            }

            // animação de entrada
            cell.style.animation = `fadeInUp .22s ease ${Math.min(i*8,180)}ms both`;

            // clique abre modal (apenas datas clicáveis)
            cell.addEventListener('click', ()=>openModalForDate(cellDate));

            calendarGrid.appendChild(cell);
        }

        // adicionar keyframes dinamicamente se não existir
        addKeyframesIfNeeded();
        // renderiza a lista de eventos para o mês atual
        renderEventList();
    }

    function renderEventList(){
        if(!eventsListEl) return;
        eventsListEl.innerHTML = '';
        const events = loadEvents();
        const year = current.getFullYear();
        const month = current.getMonth();
        const prefix = `${year}-${String(month+1).padStart(2,'0')}`;

        const items = Object.keys(events)
            .filter(k=>k.startsWith(prefix))
            .sort();

        const title = document.createElement('h3');
        title.textContent = 'Agendamentos deste mês';
        title.style.margin = '1rem 0 0.5rem 0';
        eventsListEl.appendChild(title);

        if(items.length === 0){
            const empty = document.createElement('p');
            empty.textContent = 'Nenhum agendamento para este mês.';
            empty.style.color = '#999';
            eventsListEl.appendChild(empty);

            // se não houver no mês atual, mostrar próximos agendamentos (fallback)
            const allKeys = Object.keys(events).sort();
            if(allKeys.length > 0){
                const sub = document.createElement('h4');
                sub.textContent = 'Outros agendamentos';
                sub.style.margin = '0.75rem 0 0.5rem 0';
                sub.style.color = '#ffffff';
                eventsListEl.appendChild(sub);

                const smallList = document.createElement('div');
                smallList.className = 'events-list-grid';

                allKeys.slice(0,5).forEach(key => {
                    const ev = events[key];
                    const card = document.createElement('div');
                    card.className = 'event-card';
                    const h = document.createElement('h4');
                    h.textContent = ev.title + ' — ' + (new Date(key+'T00:00:00')).toLocaleDateString();
                    card.appendChild(h);
                    smallList.appendChild(card);
                });

                eventsListEl.appendChild(smallList);
            }

            return;
        }

        const list = document.createElement('div');
        list.className = 'events-list-grid';

        items.forEach(key=>{
            const ev = events[key];
            const card = document.createElement('div');
            card.className = 'event-card';

            const h = document.createElement('h4');
            h.textContent = ev.title;
            card.appendChild(h);

            const dateP = document.createElement('p');
            const d = new Date(key + 'T00:00:00');
            dateP.textContent = d.toLocaleDateString();
            dateP.className = 'event-date';
            card.appendChild(dateP);

            if(ev.body){
                const bodyP = document.createElement('p');
                bodyP.textContent = ev.body;
                bodyP.className = 'event-body';
                card.appendChild(bodyP);
            }

            const actions = document.createElement('div');
            actions.className = 'event-actions';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn btn-edit';
            editBtn.textContent = 'Editar';
            editBtn.addEventListener('click', ()=>{
                // abrir modal para esta data
                openModalForDate(new Date(key + 'T00:00:00'));
            });

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn-delete';
            delBtn.textContent = 'Excluir';
            delBtn.addEventListener('click', ()=>{
                if(confirm('Excluir este agendamento?')){
                    const evs = loadEvents();
                    delete evs[key];
                    saveEvents(evs);
                    render();
                }
            });

            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            card.appendChild(actions);

            list.appendChild(card);
        });

        eventsListEl.appendChild(list);
    }

    function addKeyframesIfNeeded(){
        if(document.getElementById('calendar-animations')) return;
        const style = document.createElement('style');
        style.id = 'calendar-animations';
        style.textContent = `@keyframes fadeInUp{from{opacity:0;transform:translateY(8px) scale(.995)}to{opacity:1;transform:none}}`;
        document.head.appendChild(style);
    }

    function openModalForDate(date){
        const key = dateKey(date.getFullYear(), date.getMonth(), date.getDate());
        const events = loadEvents();
        const ev = events[key];

        eventDateInput.value = key;
        eventTitle.value = ev ? ev.title : '';
        eventBody.value = ev ? ev.body : '';

        // show/hide delete
        deleteBtn.style.display = ev ? 'inline-block' : 'none';

        modalOverlay.classList.add('show');
        modalOverlay.setAttribute('aria-hidden','false');
        // foco no título
        setTimeout(()=>eventTitle.focus(),80);
    }

    function closeModal(){
        modalOverlay.classList.remove('show');
        modalOverlay.setAttribute('aria-hidden','true');
    }

    // salvar evento
    eventForm.addEventListener('submit', (e)=>{
        e.preventDefault();
        const key = eventDateInput.value;
        if(!key) return;
        const title = eventTitle.value.trim();
        const body = eventBody.value.trim();
        const events = loadEvents();
        if(!title){
            alert('Por favor adicione um título para o agendamento.');
            return;
        }
        events[key] = { title, body, savedAt: new Date().toISOString() };
        saveEvents(events);
        closeModal();
        render();
    });

    cancelBtn.addEventListener('click', ()=>{ closeModal(); });

    deleteBtn.addEventListener('click', ()=>{
        const key = eventDateInput.value;
        if(!key) return;
        const events = loadEvents();
        if(events[key]){
            if(confirm('Excluir este agendamento?')){
                delete events[key];
                saveEvents(events);
                closeModal();
                render();
            }
        }
    });

    // Fechar modal clicando fora
    modalOverlay.addEventListener('click', (e)=>{
        if(e.target === modalOverlay) closeModal();
    });

    prevBtn.addEventListener('click', ()=>{
        current = new Date(current.getFullYear(), current.getMonth()-1, 1);
        render();
    });
    nextBtn.addEventListener('click', ()=>{
        current = new Date(current.getFullYear(), current.getMonth()+1, 1);
        render();
    });

    // inicializa
    render();

    // expor função útil no console para debug
    window.pollenCalendar = { render, loadEvents, saveEvents };
})();
