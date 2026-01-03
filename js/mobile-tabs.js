// ======================================
// Mobile Kanban Tabs + Sidebar Controller
// Carrossel com abas + Sidebar de navegação
// Indicador Liquid Glass em tempo real
// Theme Toggle Controller
// ======================================

(function () {
    'use strict';

    // Flags para evitar múltiplas inicializações
    let sidebarInitialized = false;
    let tabsInitialized = false;
    let themeInitialized = false;
    let liquidIndicator = null;

    // Só executa em telas mobile (≤768px)
    function isMobile() {
        return window.innerWidth <= 768;
    }

    // ======================================
    // THEME TOGGLE CONTROLLER
    // ======================================
    function initThemeToggle() {
        const themeBtn = document.getElementById('btn-theme-toggle');
        if (!themeBtn) return;

        // Carrega tema salvo do localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            themeBtn.textContent = '🌙';
        } else {
            document.body.classList.remove('light-theme');
            themeBtn.textContent = '☀️';
        }

        if (!themeInitialized) {
            themeInitialized = true;

            themeBtn.addEventListener('click', function () {
                const isLight = document.body.classList.toggle('light-theme');

                // Atualiza ícone
                this.textContent = isLight ? '🌙' : '☀️';

                // Salva preferência
                localStorage.setItem('theme', isLight ? 'light' : 'dark');
            });
        }
    }

    // ======================================
    // SIDEBAR CONTROLLER
    // ======================================
    function initMobileSidebar() {
        const hamburger = document.getElementById('mobile-hamburger');
        const sidebar = document.getElementById('mobile-sidebar');
        const overlay = document.getElementById('mobile-sidebar-overlay');
        const closeBtn = document.getElementById('sidebar-close');

        if (!hamburger || !sidebar || !overlay) {
            return;
        }

        if (!isMobile()) {
            hamburger.style.display = 'none';
            sidebar.classList.remove('active');
            sidebar.classList.add('hidden');
            overlay.classList.remove('active');
            overlay.classList.add('hidden');
            return;
        }

        hamburger.style.display = 'flex';
        sidebar.classList.remove('hidden');
        overlay.classList.remove('hidden');

        if (!sidebarInitialized) {
            sidebarInitialized = true;

            hamburger.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                sidebar.classList.add('active');
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            });

            function closeSidebar() {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', closeSidebar);
            }
            overlay.addEventListener('click', closeSidebar);

            const menuMappings = [
                { sidebar: 'sidebar-nova-demanda', original: 'btn-nova-demanda' },
                { sidebar: 'sidebar-kanban', action: 'showKanban' },
                { sidebar: 'sidebar-por-usuario', original: 'btn-por-usuario' },
                { sidebar: 'sidebar-usuarios', original: 'btn-usuarios' },
                { sidebar: 'sidebar-relatorios', original: 'btn-relatorios' }
            ];

            menuMappings.forEach(mapping => {
                const sidebarBtn = document.getElementById(mapping.sidebar);
                if (!sidebarBtn) return;

                sidebarBtn.addEventListener('click', function () {
                    closeSidebar();

                    if (mapping.original) {
                        const originalBtn = document.getElementById(mapping.original);
                        if (originalBtn) {
                            // Esconde as abas do Kanban ao ir para outras seções
                            const tabsContainer = document.getElementById('mobile-kanban-tabs');
                            if (tabsContainer && mapping.sidebar !== 'sidebar-nova-demanda') {
                                tabsContainer.style.display = 'none';
                            }
                            setTimeout(() => originalBtn.click(), 100);
                        }
                    } else if (mapping.action === 'showKanban') {
                        const kanbanContainer = document.getElementById('kanban-container');
                        const tabsContainer = document.getElementById('mobile-kanban-tabs');
                        const otherSections = [
                            'tarefas-usuario-section',
                            'funcionarios-section',
                            'bi-dashboard-section'
                        ];

                        otherSections.forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.classList.add('hidden');
                        });

                        if (kanbanContainer) kanbanContainer.classList.remove('hidden');
                        if (tabsContainer) tabsContainer.style.display = 'flex';
                    }
                });
            });
        }
    }

    // ======================================
    // LIQUID INDICATOR - Tempo Real
    // ======================================
    function createLiquidIndicator(tabsContainer) {
        // Remove indicador existente se houver
        const existing = tabsContainer.querySelector('.liquid-indicator');
        if (existing) existing.remove();

        // Cria novo indicador
        liquidIndicator = document.createElement('div');
        liquidIndicator.className = 'liquid-indicator';
        tabsContainer.appendChild(liquidIndicator);

        return liquidIndicator;
    }

    function updateLiquidIndicator(kanbanContainer, tabsContainer, tabs) {
        if (!liquidIndicator || !tabs.length) return;

        const scrollLeft = kanbanContainer.scrollLeft;
        const containerWidth = kanbanContainer.clientWidth;
        const scrollWidth = kanbanContainer.scrollWidth - containerWidth;

        // Calcula a posição como porcentagem do scroll
        const scrollPercent = scrollWidth > 0 ? scrollLeft / scrollWidth : 0;

        // Calcula dimensões das abas
        const tabsArray = Array.from(tabs);
        const totalTabs = tabsArray.length;
        const tabWidth = tabsArray[0]?.offsetWidth || 0;
        const gap = 4; // gap entre abas

        // Posição máxima do indicador (última aba)
        const maxOffset = (totalTabs - 1) * (tabWidth + gap);

        // Posição atual do indicador baseada no scroll
        const indicatorOffset = scrollPercent * maxOffset;

        // Aplica transformação
        liquidIndicator.style.transform = `translateX(${indicatorOffset}px)`;

        // Calcula qual aba está mais próxima para atualizar estado 'active'
        const currentIndex = Math.round(scrollPercent * (totalTabs - 1));
        const clampedIndex = Math.max(0, Math.min(currentIndex, totalTabs - 1));

        tabsArray.forEach((tab, i) => {
            tab.classList.toggle('active', i === clampedIndex);
        });
    }

    // ======================================
    // KANBAN TABS (CARROSSEL)
    // ======================================
    function initMobileKanbanTabs() {
        const tabsContainer = document.getElementById('mobile-kanban-tabs');
        const kanbanContainer = document.getElementById('kanban-container');

        if (!tabsContainer || !kanbanContainer) return;

        const tabs = tabsContainer.querySelectorAll('.mobile-tab');
        const columns = kanbanContainer.querySelectorAll('.kanban-column');

        if (!isMobile()) {
            tabsContainer.style.display = 'none';
            // Remove indicador no desktop
            const indicator = tabsContainer.querySelector('.liquid-indicator');
            if (indicator) indicator.remove();
            return;
        }

        tabsContainer.style.display = 'flex';

        // Cria indicador líquido
        createLiquidIndicator(tabsContainer);

        if (!tabsInitialized) {
            tabsInitialized = true;

            // Click nas abas → scroll para a coluna
            tabs.forEach((tab, index) => {
                tab.addEventListener('click', function () {
                    const column = columns[index];
                    if (column) {
                        column.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
                    }
                });
            });

            // Scroll do carrossel → atualiza indicador em TEMPO REAL
            kanbanContainer.addEventListener('scroll', function () {
                requestAnimationFrame(() => {
                    updateLiquidIndicator(kanbanContainer, tabsContainer, tabs);
                });
            });
        }

        // Atualiza posição inicial do indicador
        setTimeout(() => {
            kanbanContainer.scrollLeft = 0;
            updateLiquidIndicator(kanbanContainer, tabsContainer, tabs);
        }, 150);
    }

    // ======================================
    // INICIALIZAÇÃO
    // ======================================
    function initAll() {
        initThemeToggle();
        initMobileSidebar();
        initMobileKanbanTabs();
    }

    let resizeTimeout;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Reset flags para permitir re-criação do indicador
            const tabsContainer = document.getElementById('mobile-kanban-tabs');
            if (tabsContainer) {
                const indicator = tabsContainer.querySelector('.liquid-indicator');
                if (indicator) indicator.remove();
            }
            initAll();
        }, 150);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }

    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const dashboardPage = document.getElementById('dashboard-page');
                if (dashboardPage && !dashboardPage.classList.contains('hidden')) {
                    setTimeout(initAll, 200);
                }
            }
        });
    });

    setTimeout(() => {
        const dashboardPage = document.getElementById('dashboard-page');
        if (dashboardPage) {
            observer.observe(dashboardPage, { attributes: true });
        }
    }, 100);
})();
