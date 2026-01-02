// Main App - Event Listeners and Initialization

document.addEventListener('DOMContentLoaded', () => {
    // Check session on load
    checkSession();

    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const iconMoon = themeToggleBtn.querySelector('.icon-moon');
    const iconSun = themeToggleBtn.querySelector('.icon-sun');
    const html = document.documentElement;

    function applyTheme(theme) {
        if (theme === 'light') {
            html.setAttribute('data-theme', 'light');
            iconMoon.classList.add('hidden');
            iconSun.classList.remove('hidden');
        } else {
            html.removeAttribute('data-theme');
            iconMoon.classList.remove('hidden');
            iconSun.classList.add('hidden');
        }
        localStorage.setItem('theme', theme);
    }

    // Initialize Theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });

    // Mobile Sidebar Logic (Off-canvas)
    const mobileMenuBtn = document.getElementById('mobile-menu-toggle');
    const navLinks = document.getElementById('nav-links');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        const isActive = navLinks.classList.contains('active');

        if (isActive) {
            navLinks.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            // Reset Hamburger Icon
            const spans = mobileMenuBtn.querySelectorAll('span');
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        } else {
            navLinks.classList.add('active');
            sidebarOverlay.classList.add('active');
            // Animate Hamburger Icon
            const spans = mobileMenuBtn.querySelectorAll('span');
            spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
        }
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebar();
        });

        // Close on Overlay Click
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', toggleSidebar);
        }

        // Close on Link Click
        const links = navLinks.querySelectorAll('button.nav-tab'); // Only nav-tabs, not the close button
        links.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 900) toggleSidebar();
            });
        });

        // Close Button Logic
        const closeBtn = document.getElementById('menu-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSidebar();
            });
        }
    }

    // Setup drag and drop
    setupDragDrop();

    // Login form
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        await login(email, password);
    });

    // Register form
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('reg-nome').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        await register(nome, email, password);
    });

    // Toggle login/register pages
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterPage();
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginPage();
    });

    // Logout button
    document.getElementById('btn-sair')?.addEventListener('click', logout);

    // Nova Demanda button
    document.getElementById('btn-nova-demanda')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-nova-demanda');
        if (modal) {
            // Set default date/time
            const now = new Date();
            now.setDate(now.getDate() + 7); // 7 days from now
            const dateStr = now.toISOString().slice(0, 16);
            document.getElementById('data-previsao').value = dateStr;

            modal.classList.remove('hidden');
        }
    });

    // Close modal buttons
    document.getElementById('close-modal-demanda')?.addEventListener('click', () => {
        document.getElementById('modal-nova-demanda').classList.add('hidden');
    });

    document.getElementById('btn-cancelar-demanda')?.addEventListener('click', () => {
        document.getElementById('modal-nova-demanda').classList.add('hidden');
    });

    document.getElementById('close-modal-cargo')?.addEventListener('click', () => {
        document.getElementById('modal-editar-cargo').classList.add('hidden');
    });

    document.getElementById('btn-cancelar-cargo')?.addEventListener('click', () => {
        document.getElementById('modal-editar-cargo').classList.add('hidden');
    });

    document.getElementById('close-modal-ver')?.addEventListener('click', () => {
        document.getElementById('modal-ver-demanda').classList.add('hidden');
    });

    // Confirmation modal for starting tasks
    document.getElementById('close-modal-confirmar')?.addEventListener('click', fecharModalConfirmarInicio);
    document.getElementById('btn-cancelar-inicio')?.addEventListener('click', fecharModalConfirmarInicio);
    document.getElementById('btn-confirmar-inicio')?.addEventListener('click', confirmarInicioTarefa);

    // Nova Demanda form
    document.getElementById('form-nova-demanda')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            const atribuirPara = document.getElementById('atribuir-para').value;

            // Validate user selection is required
            if (!atribuirPara) {
                alert('Por favor, selecione um usuário para atribuir a demanda.');
                return;
            }

            const arquivoInput = document.getElementById('arquivo');
            const data = {
                titulo: document.getElementById('titulo').value,
                descricao: document.getElementById('descricao').value,
                atribuido_para: atribuirPara,
                status: document.getElementById('status-inicial').value,
                data_previsao: document.getElementById('data-previsao').value || null,
                horas_estimadas: parseFloat(document.getElementById('horas-estimadas').value) || 8,
                arquivo: arquivoInput?.files[0] || null
            };

            await createDemanda(data);

            // Clear form and close modal
            document.getElementById('form-nova-demanda').reset();
            document.getElementById('modal-nova-demanda').classList.add('hidden');

            alert('Demanda criada com sucesso!');
        } catch (error) {
            alert('Erro ao criar demanda: ' + error.message);
        }
    });

    // Edit cargo form
    document.getElementById('form-editar-cargo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('edit-user-id').value;
        const newCargo = document.getElementById('edit-cargo').value;
        await updateUserCargo(userId, newCargo);
    });

    // Save status button
    document.getElementById('btn-salvar-status')?.addEventListener('click', async () => {
        const modal = document.getElementById('modal-ver-demanda');
        const demandaId = modal?.dataset.demandaId;
        const newStatus = document.getElementById('mudar-status').value;

        if (demandaId && newStatus) {
            await updateDemandaStatus(demandaId, newStatus);
            modal.classList.add('hidden');
        }
    });

    // Column tab switching (A Fazer / Fixos)
    document.querySelectorAll('.column-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const column = tab.closest('.kanban-column');
            if (!column) return;

            // Remove active from sibling tabs
            column.querySelectorAll('.column-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const subtab = tab.dataset.subtab;
            const cardsAFazer = document.getElementById('cards-A_FAZER');
            const cardsFixo = document.getElementById('cards-FIXO');

            if (subtab === 'a-fazer') {
                cardsAFazer?.classList.remove('hidden');
                cardsFixo?.classList.add('hidden');
            } else if (subtab === 'fixos') {
                cardsAFazer?.classList.add('hidden');
                cardsFixo?.classList.remove('hidden');
            }
        });
    });

    // Filter buttons
    document.getElementById('btn-aplicar-filtro')?.addEventListener('click', () => {
        loadDemandas(getCurrentFilters());
    });

    document.getElementById('btn-limpar-filtro')?.addEventListener('click', () => {
        document.getElementById('filter-usuario').value = '';
        document.getElementById('filter-data').value = '';
        loadDemandas();
    });

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });

    // Action buttons in modal-ver-demanda
    document.getElementById('btn-excluir-demanda')?.addEventListener('click', excluirDemanda);
    document.getElementById('btn-duplicar-demanda')?.addEventListener('click', duplicarDemanda);
    document.getElementById('btn-delegar-demanda')?.addEventListener('click', abrirModalDelegar);
    document.getElementById('btn-editar-demanda')?.addEventListener('click', abrirModalEditar);

    // Delegate modal
    document.getElementById('close-modal-delegar')?.addEventListener('click', fecharModalDelegar);
    document.getElementById('btn-cancelar-delegar')?.addEventListener('click', fecharModalDelegar);
    document.getElementById('btn-confirmar-delegar')?.addEventListener('click', confirmarDelegacao);

    // Edit demanda modal
    document.getElementById('close-modal-editar-demanda')?.addEventListener('click', fecharModalEditar);
    document.getElementById('btn-cancelar-editar-demanda')?.addEventListener('click', fecharModalEditar);
    document.getElementById('form-editar-demanda')?.addEventListener('submit', salvarEdicaoDemanda);

    // Modal tab switching (Detalhes / Anexos)
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            if (tabName && typeof switchModalTab === 'function') {
                switchModalTab(tabName);
            }
        });
    });
});
