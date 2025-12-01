// Toggle sidebar collapse
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggleBtn');
const mainContent = document.getElementById('mainContent');

toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    
    // Salva o estado no localStorage
    if (sidebar.classList.contains('collapsed')) {
        localStorage.setItem('sidebarCollapsed', 'true');
    } else {
        localStorage.setItem('sidebarCollapsed', 'false');
    }
});

// Restaura o estado do sidebar ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    }

    // Marcar o item ativo com base na página atual
    try {
        const currentFile = window.location.pathname.split('/').pop();
        // Procura um nav-item cujo href corresponda ao arquivo atual
        let matched = null;
        document.querySelectorAll('.nav-item').forEach(nav => {
            const href = nav.getAttribute('href');
            if (!href) return;
            // comparação direta (relativa) ou via href absoluto
            const hrefFile = href.split('/').pop();
            if (hrefFile === currentFile || href === currentFile) matched = nav;
            // também aceita quando href é './' ou '' (não marcado)
        });

        if (matched) {
            // remove active de outros e aplica no encontrado
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            matched.classList.add('active');
        }
    } catch (err) {
        // silencioso: se algo falhar, não quebrou a sidebar
        console.warn('Não foi possível marcar o item ativo automaticamente:', err);
    }
});

// Adiciona interatividade aos itens do menu
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        // Remove active de todos os itens
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
        });
        
        // Adiciona active ao item clicado
        this.classList.add('active');
        
        // Se for um dropdown e não possuir um link válido (ex: href="#"), previne o comportamento padrão
        if (this.classList.contains('dropdown-item')) {
            const href = this.getAttribute('href');
            const isPlaceholder = !href || href === '#';
            if (isPlaceholder) {
                e.preventDefault();
                // Aqui você pode adicionar lógica para expandir o dropdown
            }
            // Se o item tiver um href válido (ex: 'colmeia.html'), deixamos o comportamento padrão
        }
    });
});

// Adiciona efeito de hover nos itens do menu
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('mouseenter', function() {
        if (sidebar.classList.contains('collapsed')) {
            // Pode adicionar tooltip aqui quando colapsado
        }
    });
});
