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
        
        // Se for um dropdown, previne o comportamento padrão
        if (this.classList.contains('dropdown-item')) {
            e.preventDefault();
            // Aqui você pode adicionar lógica para expandir o dropdown
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
