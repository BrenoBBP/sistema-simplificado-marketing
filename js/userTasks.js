// Tarefas por Usuário - User Tasks View
// Accessible only to Directors and Managers

let userTasksSubscription = null;
let isUserTasksViewActive = false;

// Filter state
let userTasksFilterDateStart = '';
let userTasksFilterDateEnd = '';
let userTasksFilterPerson = '';
let userTasksFilterMode = 'hoje'; // 'hoje', 'ontem', 'periodo'

// Helper function to get today's date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// Helper function to get yesterday's date in YYYY-MM-DD format
function getYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
}

// Set filter by mode
function setDateFilterMode(mode) {
    userTasksFilterMode = mode;

    // Update button states
    document.querySelectorAll('.filter-quick-btn').forEach(btn => btn.classList.remove('active'));

    const periodInputs = document.getElementById('filter-period-inputs');

    if (mode === 'hoje') {
        document.getElementById('filter-btn-hoje')?.classList.add('active');
        userTasksFilterDateStart = getTodayDate();
        userTasksFilterDateEnd = getTodayDate();
        periodInputs?.classList.add('hidden');
    } else if (mode === 'ontem') {
        document.getElementById('filter-btn-ontem')?.classList.add('active');
        userTasksFilterDateStart = getYesterdayDate();
        userTasksFilterDateEnd = getYesterdayDate();
        periodInputs?.classList.add('hidden');
    } else if (mode === 'periodo') {
        document.getElementById('filter-btn-periodo')?.classList.add('active');
        periodInputs?.classList.remove('hidden');
        // Use the input values if set, otherwise clear
        const startInput = document.getElementById('user-tasks-filter-date-start');
        const endInput = document.getElementById('user-tasks-filter-date-end');
        userTasksFilterDateStart = startInput?.value || '';
        userTasksFilterDateEnd = endInput?.value || '';
    }

    if (isUserTasksViewActive) {
        loadUserTasksView();
    }
}
// Toggle the user tasks view
function toggleUserTasksView() {
    const section = document.getElementById('tarefas-usuario-section');
    const kanbanContainer = document.getElementById('kanban-container');
    const kanbanFilters = document.getElementById('kanban-filters');
    const filtersSection = document.getElementById('filters-section');
    const funcionariosSection = document.getElementById('funcionarios-section');
    const cronogramaSection = document.getElementById('cronograma-section');
    const userDashboardSection = document.getElementById('user-dashboard-section');
    const btnPorUsuario = document.getElementById('btn-por-usuario');

    if (isUserTasksViewActive) {
        // Close user tasks view, show kanban
        section.classList.add('hidden');
        kanbanContainer.classList.remove('hidden');
        kanbanFilters?.classList.remove('hidden');
        if (canManageDemands(currentProfile?.cargo)) {
            filtersSection?.classList.remove('hidden');
        }
        isUserTasksViewActive = false;
        unsubscribeUserTasks();

        // Change button text back to "Por Usuário"
        if (btnPorUsuario) {
            btnPorUsuario.textContent = 'Por Usuário';
            btnPorUsuario.classList.remove('btn-purple');
            btnPorUsuario.classList.add('btn-orange');
        }
    } else {
        // Open user tasks view, hide kanban
        section.classList.remove('hidden');
        kanbanContainer.classList.add('hidden');
        kanbanFilters?.classList.add('hidden');
        filtersSection?.classList.add('hidden');
        funcionariosSection?.classList.add('hidden');
        cronogramaSection?.classList.add('hidden');
        userDashboardSection?.classList.add('hidden');
        // Hide BI Dashboard if active
        document.getElementById('bi-dashboard-section')?.classList.add('hidden');

        // Reset other view states
        if (typeof biDashboardActive !== 'undefined') biDashboardActive = false;
        if (typeof isCronogramaViewActive !== 'undefined') isCronogramaViewActive = false;
        if (typeof isUserDashboardActive !== 'undefined') isUserDashboardActive = false;
        if (typeof isUsuariosViewActive !== 'undefined') isUsuariosViewActive = false;

        // Reset other button texts
        const btnCronograma = document.getElementById('btn-cronograma');
        if (btnCronograma) btnCronograma.textContent = 'Cronograma';
        const btnMeuPainel = document.getElementById('btn-meu-painel');
        if (btnMeuPainel) btnMeuPainel.textContent = 'Meu Painel';
        const btnUsuarios = document.getElementById('btn-usuarios');
        if (btnUsuarios) btnUsuarios.textContent = 'Usuários';

        isUserTasksViewActive = true;
        loadUserTasksView();
        subscribeToUserTasks();
        populatePersonFilter();

        // Change button text to "Kanban"
        if (btnPorUsuario) {
            btnPorUsuario.textContent = 'Kanban';
            btnPorUsuario.classList.remove('btn-orange');
            btnPorUsuario.classList.add('btn-purple');
        }
    }
}

// Populate the person filter dropdown
async function populatePersonFilter() {
    const select = document.getElementById('user-tasks-filter-person');
    if (!select) return;

    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, nome, cargo')
            .order('nome');

        if (error) throw error;

        // Filter out requester-only users (SOLICITANTE)
        const filteredUsers = users.filter(user => !isRequesterOnlyRole(user.cargo));

        // Keep the "Todas" option and add users
        select.innerHTML = '<option value="">Todas</option>';
        filteredUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.nome;
            select.appendChild(option);
        });

        // Restore previous filter value if any
        if (userTasksFilterPerson) {
            select.value = userTasksFilterPerson;
        }
    } catch (error) {
        console.error('Error populating person filter:', error);
    }
}

// Load user tasks view with filters
async function loadUserTasksView() {
    try {
        // Get all users
        const { data: allUsersData, error: usersError } = await supabase
            .from('profiles')
            .select('*')
            .order('nome');

        if (usersError) throw usersError;

        // Filter out requester-only users (SOLICITANTE)
        const users = allUsersData.filter(user => !isRequesterOnlyRole(user.cargo));

        // Build query for demands
        let query = supabase
            .from('demandas')
            .select(`
                *,
                criador:profiles!demandas_criado_por_fkey(id, nome, email),
                atribuido:profiles!demandas_atribuido_para_fkey(id, nome, email)
            `)
            .eq('status', 'EM_ANDAMENTO')
            .order('created_at', { ascending: false });

        // Apply date filter if set
        if (userTasksFilterDateStart && userTasksFilterDateEnd) {
            const startOfDay = `${userTasksFilterDateStart}T00:00:00`;
            const endOfDay = `${userTasksFilterDateEnd}T23:59:59`;
            query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
        } else if (userTasksFilterDateStart) {
            const startOfDay = `${userTasksFilterDateStart}T00:00:00`;
            query = query.gte('created_at', startOfDay);
        } else if (userTasksFilterDateEnd) {
            const endOfDay = `${userTasksFilterDateEnd}T23:59:59`;
            query = query.lte('created_at', endOfDay);
        }

        // Apply person filter if set
        if (userTasksFilterPerson) {
            query = query.eq('atribuido_para', userTasksFilterPerson);
        }

        const { data: demandas, error: demandasError } = await query;

        if (demandasError) throw demandasError;

        // Filter users if person filter is active
        const filteredUsers = userTasksFilterPerson
            ? users.filter(u => u.id === userTasksFilterPerson)
            : users;

        renderUserTasksKanban(filteredUsers, demandas);
    } catch (error) {
        console.error('Error loading user tasks:', error);
    }
}

// Cache demandas for click handler
let userTasksDemandasCache = [];

// Render the user tasks kanban
function renderUserTasksKanban(users, demandas) {
    const container = document.getElementById('user-kanban-container');
    if (!container) return;

    // Store demandas for click handler
    userTasksDemandasCache = demandas;

    container.innerHTML = '';

    users.forEach(user => {
        // Filter demandas assigned to this user
        const userDemandas = demandas.filter(d => d.atribuido_para === user.id);

        const column = document.createElement('div');
        column.className = 'user-kanban-column';
        column.dataset.userId = user.id;

        column.innerHTML = `
            <div class="user-column-header">
                <span class="user-column-name">${escapeHtml(user.nome)}</span>
                <span class="user-column-count">${userDemandas.length}</span>
            </div>
            <div class="user-column-cards" id="user-cards-${user.id}">
                ${userDemandas.length === 0 ?
                '<p class="empty-message">Nenhuma tarefa pendente.</p>' :
                userDemandas.map(d => createUserTaskCardHTML(d)).join('')
            }
            </div>
        `;

        container.appendChild(column);
    });

    // Add click event delegation for all user task cards
    container.addEventListener('click', handleUserTaskCardClick);
}

// Handle click on user task cards
function handleUserTaskCardClick(e) {
    const card = e.target.closest('.user-task-card');
    if (!card) return;

    const demandaId = card.dataset.demandaId;
    if (!demandaId) return;

    // Find the demanda in cache
    const demanda = userTasksDemandasCache.find(d => d.id === demandaId);
    if (demanda && typeof openDemandaModal === 'function') {
        openDemandaModal(demanda);
    }
}

// Create HTML for a user task card
function createUserTaskCardHTML(demanda) {
    const taskId = `TSK-${new Date(demanda.created_at).getFullYear()}${String(new Date(demanda.created_at).getMonth() + 1).padStart(2, '0')}${String(new Date(demanda.created_at).getDate()).padStart(2, '0')}${demanda.id.substring(0, 8).toUpperCase()}`;
    const createdDate = formatDate(demanda.created_at);
    const previsaoDate = demanda.data_previsao ? formatDate(demanda.data_previsao) : '-';
    const criadorNome = demanda.criador?.nome || 'Desconhecido';

    return `
        <div class="user-task-card" data-demanda-id="${demanda.id}" style="cursor: pointer;">
            <div class="user-task-id">${taskId}</div>
            <div class="user-task-title">${escapeHtml(demanda.titulo)}</div>
            <div class="user-task-meta">
                <span>Criado em: ${createdDate}</span>
                <span>Previsão: ${previsaoDate}</span>
                <span class="user-task-assignee">(${escapeHtml(criadorNome)})</span>
            </div>
        </div>
    `;
}

// Subscribe to real-time updates for demandas
function subscribeToUserTasks() {
    if (userTasksSubscription) return;

    userTasksSubscription = supabase
        .channel('user-tasks-channel')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'demandas' },
            (payload) => {
                console.log('Real-time update:', payload);
                // Reload the view when any demanda changes
                if (isUserTasksViewActive) {
                    loadUserTasksView();
                }
            }
        )
        .subscribe();

    console.log('Subscribed to real-time demanda updates');
}

// Unsubscribe from real-time updates
function unsubscribeUserTasks() {
    if (userTasksSubscription) {
        supabase.removeChannel(userTasksSubscription);
        userTasksSubscription = null;
        console.log('Unsubscribed from real-time updates');
    }
}

// Check if user can access user tasks view (Directors/Managers only)
function canAccessUserTasksView(cargo) {
    return ['DIRETOR', 'GERENTE', 'ADM'].includes(cargo);
}

// Update button visibility based on user role
function updateUserTasksButtonVisibility() {
    const btn = document.getElementById('btn-por-usuario');
    if (!btn) return;

    if (currentProfile && canAccessUserTasksView(currentProfile.cargo)) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

// Track if usuarios view is active
let isUsuariosViewActive = false;

// Toggle the usuarios (employee management) view
function toggleUsuariosView() {
    const funcionariosSection = document.getElementById('funcionarios-section');
    const kanbanContainer = document.getElementById('kanban-container');
    const kanbanFilters = document.getElementById('kanban-filters');
    const tarefasUsuarioSection = document.getElementById('tarefas-usuario-section');
    const filtersSection = document.getElementById('filters-section');
    const cronogramaSection = document.getElementById('cronograma-section');
    const userDashboardSection = document.getElementById('user-dashboard-section');
    const btnUsuarios = document.getElementById('btn-usuarios');
    const btnPorUsuario = document.getElementById('btn-por-usuario');

    if (isUsuariosViewActive) {
        // Close usuarios view, show kanban
        funcionariosSection.classList.add('hidden');
        kanbanContainer.classList.remove('hidden');
        kanbanFilters?.classList.remove('hidden');
        if (canManageDemands(currentProfile?.cargo)) {
            filtersSection?.classList.remove('hidden');
        }
        isUsuariosViewActive = false;

        // Change button text back to "Usuários"
        if (btnUsuarios) {
            btnUsuarios.textContent = 'Usuários';
        }
        // Show Por Usuário button again
        if (btnPorUsuario && canAccessUserTasksView(currentProfile?.cargo)) {
            btnPorUsuario.classList.remove('hidden');
        }
    } else {
        // Open usuarios view, hide kanban
        funcionariosSection.classList.remove('hidden');
        kanbanContainer.classList.add('hidden');
        kanbanFilters?.classList.add('hidden');
        tarefasUsuarioSection?.classList.add('hidden');
        filtersSection?.classList.add('hidden');
        cronogramaSection?.classList.add('hidden');
        userDashboardSection?.classList.add('hidden');
        // Hide BI Dashboard if active
        document.getElementById('bi-dashboard-section')?.classList.add('hidden');

        // Reset other view states
        if (typeof biDashboardActive !== 'undefined') biDashboardActive = false;
        if (typeof isCronogramaViewActive !== 'undefined') isCronogramaViewActive = false;
        if (typeof isUserDashboardActive !== 'undefined') isUserDashboardActive = false;

        // Reset other button texts
        const btnCronograma = document.getElementById('btn-cronograma');
        if (btnCronograma) btnCronograma.textContent = 'Cronograma';
        const btnMeuPainel = document.getElementById('btn-meu-painel');
        if (btnMeuPainel) btnMeuPainel.textContent = 'Meu Painel';

        isUsuariosViewActive = true;

        // Close user tasks view if open
        if (isUserTasksViewActive) {
            isUserTasksViewActive = false;
            unsubscribeUserTasks();
            if (btnPorUsuario) {
                btnPorUsuario.textContent = 'Por Usuário';
                btnPorUsuario.classList.remove('btn-purple');
                btnPorUsuario.classList.add('btn-orange');
            }
        }

        // Change button text to "Kanban"
        if (btnUsuarios) {
            btnUsuarios.textContent = 'Kanban';
        }
        // Hide Por Usuário button while in usuarios view
        btnPorUsuario?.classList.add('hidden');

        // Load employees
        if (typeof loadFuncionarios === 'function') {
            loadFuncionarios();
        }
    }
}

// Initialize event listeners for user tasks
document.addEventListener('DOMContentLoaded', () => {
    const btnPorUsuario = document.getElementById('btn-por-usuario');
    if (btnPorUsuario) {
        btnPorUsuario.addEventListener('click', toggleUserTasksView);
    }

    const btnUsuarios = document.getElementById('btn-usuarios');
    if (btnUsuarios) {
        btnUsuarios.addEventListener('click', toggleUsuariosView);
    }

    // Quick date filter buttons
    const btnHoje = document.getElementById('filter-btn-hoje');
    if (btnHoje) {
        btnHoje.addEventListener('click', () => setDateFilterMode('hoje'));
    }

    const btnOntem = document.getElementById('filter-btn-ontem');
    if (btnOntem) {
        btnOntem.addEventListener('click', () => setDateFilterMode('ontem'));
    }

    const btnPeriodo = document.getElementById('filter-btn-periodo');
    if (btnPeriodo) {
        btnPeriodo.addEventListener('click', () => setDateFilterMode('periodo'));
    }

    // Period date inputs
    const filterDateStart = document.getElementById('user-tasks-filter-date-start');
    if (filterDateStart) {
        filterDateStart.addEventListener('change', (e) => {
            userTasksFilterDateStart = e.target.value;
            if (isUserTasksViewActive && userTasksFilterMode === 'periodo') {
                loadUserTasksView();
            }
        });
    }

    const filterDateEnd = document.getElementById('user-tasks-filter-date-end');
    if (filterDateEnd) {
        filterDateEnd.addEventListener('change', (e) => {
            userTasksFilterDateEnd = e.target.value;
            if (isUserTasksViewActive && userTasksFilterMode === 'periodo') {
                loadUserTasksView();
            }
        });
    }

    const filterPerson = document.getElementById('user-tasks-filter-person');
    if (filterPerson) {
        filterPerson.addEventListener('change', (e) => {
            userTasksFilterPerson = e.target.value;
            if (isUserTasksViewActive) {
                loadUserTasksView();
            }
        });
    }

    const clearFiltersBtn = document.getElementById('user-tasks-clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            userTasksFilterPerson = '';
            if (filterPerson) filterPerson.value = '';

            // Reset to "Hoje" as default
            setDateFilterMode('hoje');
        });
    }

    // Initialize with "Hoje" as default on page load
    setDateFilterMode('hoje');
});
