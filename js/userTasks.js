// Tarefas por Usuário - User Tasks View
// Accessible only to Directors and Managers

let userTasksSubscription = null;
let isUserTasksViewActive = false;

// Toggle the user tasks view
function toggleUserTasksView() {
    const section = document.getElementById('tarefas-usuario-section');
    const kanbanContainer = document.getElementById('kanban-container');
    const filtersSection = document.getElementById('filters-section');
    const funcionariosSection = document.getElementById('funcionarios-section');
    const btnPorUsuario = document.getElementById('btn-por-usuario');

    if (isUserTasksViewActive) {
        // Close user tasks view, show kanban
        section.classList.add('hidden');
        kanbanContainer.classList.remove('hidden');
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
        filtersSection?.classList.add('hidden');
        funcionariosSection?.classList.add('hidden');
        // Hide BI Dashboard if active
        document.getElementById('bi-dashboard-section')?.classList.add('hidden');
        if (typeof biDashboardActive !== 'undefined') biDashboardActive = false;
        isUserTasksViewActive = true;
        loadUserTasksView();
        subscribeToUserTasks();

        // Change button text to "Kanban"
        if (btnPorUsuario) {
            btnPorUsuario.textContent = 'Kanban';
            btnPorUsuario.classList.remove('btn-orange');
            btnPorUsuario.classList.add('btn-purple');
        }
    }
}

// Load user tasks view
async function loadUserTasksView() {
    try {
        // Get all users
        const { data: users, error: usersError } = await supabase
            .from('profiles')
            .select('*')
            .order('nome');

        if (usersError) throw usersError;

        // Get all demands in production
        const { data: demandas, error: demandasError } = await supabase
            .from('demandas')
            .select(`
                *,
                criador:profiles!demandas_criado_por_fkey(id, nome, email),
                atribuido:profiles!demandas_atribuido_para_fkey(id, nome, email)
            `)
            .eq('status', 'EM_ANDAMENTO')
            .order('created_at', { ascending: false });

        if (demandasError) throw demandasError;

        renderUserTasksKanban(users, demandas);
    } catch (error) {
        console.error('Error loading user tasks:', error);
    }
}

// Render the user tasks kanban
function renderUserTasksKanban(users, demandas) {
    const container = document.getElementById('user-kanban-container');
    if (!container) return;

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
}

// Create HTML for a user task card
function createUserTaskCardHTML(demanda) {
    const taskId = `TSK-${new Date(demanda.created_at).getFullYear()}${String(new Date(demanda.created_at).getMonth() + 1).padStart(2, '0')}${String(new Date(demanda.created_at).getDate()).padStart(2, '0')}${demanda.id.substring(0, 8).toUpperCase()}`;
    const createdDate = formatDate(demanda.created_at);
    const previsaoDate = demanda.data_previsao ? formatDate(demanda.data_previsao) : '-';
    const criadorNome = demanda.criador?.nome || 'Desconhecido';

    return `
        <div class="user-task-card" data-demanda-id="${demanda.id}">
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
    const tarefasUsuarioSection = document.getElementById('tarefas-usuario-section');
    const filtersSection = document.getElementById('filters-section');
    const btnUsuarios = document.getElementById('btn-usuarios');
    const btnPorUsuario = document.getElementById('btn-por-usuario');

    if (isUsuariosViewActive) {
        // Close usuarios view, show kanban
        funcionariosSection.classList.add('hidden');
        kanbanContainer.classList.remove('hidden');
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
        tarefasUsuarioSection?.classList.add('hidden');
        filtersSection?.classList.add('hidden');
        // Hide BI Dashboard if active
        document.getElementById('bi-dashboard-section')?.classList.add('hidden');
        if (typeof biDashboardActive !== 'undefined') biDashboardActive = false;
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
});
