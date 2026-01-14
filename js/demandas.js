// Demandas Functions

// Global state for demand actions
let currentDemandaForActions = null;

// Kanban date filter state
let kanbanFilterDateStart = '';
let kanbanFilterDateEnd = '';
let kanbanFilterMode = 'todos'; // 'todos', 'hoje', 'ontem', 'periodo'

// Helper functions for dates
function getKanbanTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function getKanbanYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
}

// Set Kanban date filter mode
function setKanbanDateFilterMode(mode) {
    kanbanFilterMode = mode;

    // Update button states
    document.querySelectorAll('#kanban-filters .filter-quick-btn').forEach(btn => btn.classList.remove('active'));

    const periodInputs = document.getElementById('kanban-period-inputs');

    if (mode === 'todos') {
        document.getElementById('kanban-filter-todos')?.classList.add('active');
        kanbanFilterDateStart = '';
        kanbanFilterDateEnd = '';
        periodInputs?.classList.add('hidden');
    } else if (mode === 'hoje') {
        document.getElementById('kanban-filter-hoje')?.classList.add('active');
        kanbanFilterDateStart = getKanbanTodayDate();
        kanbanFilterDateEnd = getKanbanTodayDate();
        periodInputs?.classList.add('hidden');
    } else if (mode === 'ontem') {
        document.getElementById('kanban-filter-ontem')?.classList.add('active');
        kanbanFilterDateStart = getKanbanYesterdayDate();
        kanbanFilterDateEnd = getKanbanYesterdayDate();
        periodInputs?.classList.add('hidden');
    } else if (mode === 'periodo') {
        document.getElementById('kanban-filter-periodo')?.classList.add('active');
        periodInputs?.classList.remove('hidden');
        // Use the input values if set, otherwise clear
        const startInput = document.getElementById('kanban-filter-date-start');
        const endInput = document.getElementById('kanban-filter-date-end');
        kanbanFilterDateStart = startInput?.value || '';
        kanbanFilterDateEnd = endInput?.value || '';
    }

    // Reload demandas with new filter
    loadDemandas(getCurrentFilters());
}

// Initialize Kanban filter event listeners
function initKanbanFilters() {
    const btnTodos = document.getElementById('kanban-filter-todos');
    if (btnTodos) {
        btnTodos.addEventListener('click', () => setKanbanDateFilterMode('todos'));
    }

    const btnHoje = document.getElementById('kanban-filter-hoje');
    if (btnHoje) {
        btnHoje.addEventListener('click', () => setKanbanDateFilterMode('hoje'));
    }

    const btnOntem = document.getElementById('kanban-filter-ontem');
    if (btnOntem) {
        btnOntem.addEventListener('click', () => setKanbanDateFilterMode('ontem'));
    }

    const btnPeriodo = document.getElementById('kanban-filter-periodo');
    if (btnPeriodo) {
        btnPeriodo.addEventListener('click', () => setKanbanDateFilterMode('periodo'));
    }

    // Period date inputs
    const filterDateStart = document.getElementById('kanban-filter-date-start');
    if (filterDateStart) {
        filterDateStart.addEventListener('change', (e) => {
            kanbanFilterDateStart = e.target.value;
            if (kanbanFilterMode === 'periodo') {
                loadDemandas(getCurrentFilters());
            }
        });
    }

    const filterDateEnd = document.getElementById('kanban-filter-date-end');
    if (filterDateEnd) {
        filterDateEnd.addEventListener('change', (e) => {
            kanbanFilterDateEnd = e.target.value;
            if (kanbanFilterMode === 'periodo') {
                loadDemandas(getCurrentFilters());
            }
        });
    }
}

// Call init when DOM is ready
document.addEventListener('DOMContentLoaded', initKanbanFilters);

// Load all demandas
async function loadDemandas(filters = {}) {
    try {
        let query = supabase
            .from('demandas')
            .select(`
                *,
                criador:profiles!demandas_criado_por_fkey(id, nome, email, cargo),
                atribuido:profiles!demandas_atribuido_para_fkey(id, nome, email, cargo)
            `)
            .order('created_at', { ascending: false });

        // Apply filters
        if (filters.usuario) {
            query = query.eq('atribuido_para', filters.usuario);
        }

        // Apply date range filter
        if (filters.dataInicio && filters.dataFim) {
            const startDate = `${filters.dataInicio}T00:00:00`;
            const endDate = `${filters.dataFim}T23:59:59`;
            query = query.gte('created_at', startDate).lte('created_at', endDate);
        } else if (filters.dataInicio) {
            const startDate = `${filters.dataInicio}T00:00:00`;
            query = query.gte('created_at', startDate);
        } else if (filters.dataFim) {
            const endDate = `${filters.dataFim}T23:59:59`;
            query = query.lte('created_at', endDate);
        }

        // IMPORTANT: The Kanban is PERSONAL - show only demands assigned to the current user
        // For viewing other users' demands, use "Por Usuário" or "Cronograma" views
        // This applies to ALL users, including admins and managers
        if (currentProfile?.id) {
            query = query.eq('atribuido_para', currentProfile.id);
        }

        const { data, error } = await query;

        if (error) throw error;

        allDemandas = data || [];
        renderKanban();
    } catch (error) {
        console.error('Error loading demandas:', error);
    }
}

// Render Kanban board
function renderKanban() {
    const statuses = ['A_FAZER', 'FIXO', 'EM_ANDAMENTO', 'PARA_APROVACAO', 'EM_REVISAO', 'APROVADO'];

    // All demands in allDemandas are already filtered to the current user by loadDemandas()
    const visibleDemandas = allDemandas;

    statuses.forEach(status => {
        const container = document.getElementById(`cards-${status}`);
        if (!container) return;

        const demandasForStatus = visibleDemandas.filter(d => d.status === status);
        const count = demandasForStatus.length;


        // Update count - for A_FAZER column, count both A_FAZER and FIXO
        const column = container.closest('.kanban-column');
        if (column && status === 'A_FAZER') {
            const fixoCount = visibleDemandas.filter(d => d.status === 'FIXO').length;
            const countEl = column.querySelector('.column-count');
            if (countEl) countEl.textContent = count + fixoCount;
        } else if (column && status !== 'FIXO') {
            const countEl = column.querySelector('.column-count');
            if (countEl) countEl.textContent = count;
        }

        // Clear and render cards
        container.innerHTML = '';

        if (demandasForStatus.length === 0) {
            const emptyMsg = status === 'FIXO' ? 'Nenhuma demanda fixa.' : 'Nenhuma demanda aqui.';
            container.innerHTML = `<p class="empty-message">${emptyMsg}</p>`;
        } else {
            demandasForStatus.forEach(demanda => {
                container.appendChild(createDemandCard(demanda));
            });
        }
    });

    // Start timer updates
    startTimerUpdates();
}

// Create demand card element
function createDemandCard(demanda) {
    const card = document.createElement('div');
    card.className = 'demand-card';
    card.draggable = true;
    card.dataset.id = demanda.id;

    // Generate task ID
    const createdDate = new Date(demanda.created_at);
    const taskId = `TSK-${createdDate.getFullYear()}${String(createdDate.getMonth() + 1).padStart(2, '0')}${String(createdDate.getDate()).padStart(2, '0')}${demanda.id.substring(0, 8).toUpperCase()}`;

    // Format dates
    const criadoFormatado = formatDate(demanda.created_at);
    const previsaoFormatada = demanda.data_previsao ? formatDate(demanda.data_previsao) : '-';
    const horasEstimadas = demanda.horas_estimadas || 8;

    // Get requester info
    const criadorNome = demanda.criador?.nome || 'Desconhecido';
    const criadorInitials = getInitials(demanda.criador?.nome);

    // Check if can show start button (only in A_FAZER status)
    const showStartButton = demanda.status === 'A_FAZER' || demanda.status === 'FIXO';

    // Calculate remaining time (pass status to stop timer when completed)
    const tempoRestante = calcularTempoRestante(demanda.data_previsao, demanda.status);

    card.innerHTML = `
        <div class="demand-card-id">${taskId}</div>
        <div class="demand-card-title">${escapeHtml(demanda.titulo)}</div>
        <div class="demand-card-info">
            <div class="info-row">
                <span class="info-label">Criado:</span>
                <span class="info-value">${criadoFormatado}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Previsão:</span>
                <span class="info-value ${tempoRestante.esgotado ? 'text-danger' : ''}">${previsaoFormatada}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Tempo Estimado:</span>
                <span class="info-value">${horasEstimadas}h</span>
            </div>
        </div>
        <div class="demand-card-timer ${tempoRestante.esgotado ? 'timer-esgotado' : ''} ${tempoRestante.concluida ? 'timer-concluida' : ''}" data-previsao="${demanda.data_previsao || ''}" data-status="${demanda.status}">
            ${tempoRestante.texto}
        </div>
        <div class="demand-card-footer">
            <div class="demand-card-requester">
                <span class="requester-name">(${escapeHtml(criadorNome)})</span>
                <span class="user-avatar">${criadorInitials}</span>
            </div>
            ${showStartButton ? `
                <button class="btn btn-primary btn-sm btn-iniciar" data-demanda-id="${demanda.id}" data-demanda-titulo="${escapeHtml(demanda.titulo)}">
                    Iniciar <span>›</span>
                </button>
            ` : ''}
        </div>
    `;

    // Click to view details (but not on the start button)
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-iniciar')) {
            openDemandaModal(demanda);
        }
    });

    // Drag events
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    // Start button event
    const btnIniciar = card.querySelector('.btn-iniciar');
    if (btnIniciar) {
        btnIniciar.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirModalConfirmarInicio(demanda.id, demanda.titulo);
        });
    }

    return card;
}

// Calculate remaining time
function calcularTempoRestante(dataPrevisao, status = null) {
    // If demand is completed (APROVADO), show "Demanda concluída" and stop timer
    if (status === 'APROVADO') {
        return { texto: '✅ Demanda concluída', esgotado: false, concluida: true };
    }

    if (!dataPrevisao) return { texto: 'Sem previsão', esgotado: false, concluida: false };

    const agora = new Date();
    const previsao = new Date(dataPrevisao);
    const diff = previsao - agora;

    if (diff <= 0) {
        return { texto: 'Tempo restante: Tempo esgotado!', esgotado: true, concluida: false };
    }

    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((diff % (1000 * 60)) / 1000);

    let texto = 'Tempo restante: ';
    if (dias > 0) texto += `${dias}d `;
    texto += `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

    return { texto, esgotado: false, concluida: false };
}

// Timer update interval
let timerInterval = null;

function startTimerUpdates() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        document.querySelectorAll('.demand-card-timer[data-previsao]').forEach(timerEl => {
            const dataPrevisao = timerEl.dataset.previsao;
            const status = timerEl.dataset.status;

            // Skip updating completed demands - they don't need timer updates
            // Also check if the timer already shows concluded message
            if (status === 'APROVADO') {
                // Ensure completed demands always show the correct message
                if (!timerEl.textContent.includes('concluída')) {
                    timerEl.textContent = '✅ Demanda concluída';
                    timerEl.classList.remove('timer-esgotado');
                    timerEl.classList.add('timer-concluida');
                }
                return;
            }

            if (dataPrevisao) {
                const tempo = calcularTempoRestante(dataPrevisao, status);
                timerEl.textContent = tempo.texto;
                timerEl.classList.toggle('timer-esgotado', tempo.esgotado);
                timerEl.classList.toggle('timer-concluida', tempo.concluida);
            }
        });
    }, 1000);
}

// Modal confirmar início
let demandaParaIniciar = null;

function abrirModalConfirmarInicio(demandaId, titulo) {
    demandaParaIniciar = demandaId;
    document.getElementById('confirmar-tarefa-nome').textContent = titulo;
    document.getElementById('modal-confirmar-inicio').classList.remove('hidden');
}

function fecharModalConfirmarInicio() {
    demandaParaIniciar = null;
    document.getElementById('modal-confirmar-inicio').classList.add('hidden');
}

async function confirmarInicioTarefa() {
    if (!demandaParaIniciar) return;

    await updateDemandaStatus(demandaParaIniciar, 'EM_ANDAMENTO');
    fecharModalConfirmarInicio();
}

// HTML Escape
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Drag and Drop handlers
let draggedCard = null;

function handleDragStart(e) {
    draggedCard = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedCard = null;
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.classList.remove('drag-over');
    });
}

function setupDragDrop() {
    const columns = document.querySelectorAll('.column-cards');

    columns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            column.closest('.kanban-column').classList.add('drag-over');
        });

        column.addEventListener('dragleave', (e) => {
            column.closest('.kanban-column').classList.remove('drag-over');
        });

        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            column.closest('.kanban-column').classList.remove('drag-over');

            if (!draggedCard) return;

            const demandaId = draggedCard.dataset.id;
            const newStatus = column.closest('.kanban-column').dataset.status;

            await updateDemandaStatus(demandaId, newStatus);
        });
    });
}

// Update demanda status
async function updateDemandaStatus(demandaId, newStatus) {
    try {
        const updateData = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        // Auto-assign to current user when starting the task
        if (newStatus === 'EM_ANDAMENTO' && currentProfile?.id) {
            updateData.atribuido_para = currentProfile.id;
        }

        const { error } = await supabase
            .from('demandas')
            .update(updateData)
            .eq('id', demandaId);

        if (error) throw error;

        // Reload to refresh UI
        await loadDemandas(getCurrentFilters());

        // Also refresh user tasks view if active
        if (isUserTasksViewActive && typeof loadUserTasksView === 'function') {
            await loadUserTasksView();
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Erro ao atualizar status: ' + error.message);
    }
}

// Get current filters
function getCurrentFilters() {
    const filterUsuario = document.getElementById('filter-usuario')?.value;

    return {
        usuario: filterUsuario || null,
        dataInicio: kanbanFilterDateStart || null,
        dataFim: kanbanFilterDateEnd || null
    };
}

// Create new demanda
async function createDemanda(data) {
    try {
        const { titulo, descricao, atribuido_para, status, data_previsao, horas_estimadas, arquivo } = data;

        let arquivoUrl = null;

        // Upload file if present
        if (arquivo && arquivo.size > 0) {
            const fileExt = arquivo.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `anexos/${currentUser.id}/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('demandas-anexos')
                .upload(filePath, arquivo, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Error uploading file:', uploadError);
                // Continue without file - don't block demand creation
            } else {
                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('demandas-anexos')
                    .getPublicUrl(filePath);

                arquivoUrl = urlData?.publicUrl || null;
            }
        }

        // Convert datetime-local value to proper ISO string with timezone
        // datetime-local returns "YYYY-MM-DDTHH:MM" without timezone info
        // We need to treat it as local time and convert to ISO with proper offset
        let dataPrevisaoISO = null;
        if (data_previsao) {
            // Create date from local datetime string
            const localDate = new Date(data_previsao);
            // Convert to ISO string (this preserves the local time correctly)
            dataPrevisaoISO = localDate.toISOString();
        }

        const demandaData = {
            titulo,
            descricao: descricao || null,
            criado_por: currentUser.id,
            atribuido_para: atribuido_para || null,
            status: status || 'NA_FILA',
            data_previsao: dataPrevisaoISO,
            horas_estimadas: horas_estimadas || 8,
            arquivo_url: arquivoUrl
        };

        const { data: newDemanda, error } = await supabase
            .from('demandas')
            .insert([demandaData])
            .select()
            .single();

        if (error) throw error;

        // Reload demandas
        await loadDemandas(getCurrentFilters());

        return newDemanda;
    } catch (error) {
        console.error('Error creating demanda:', error);
        throw error;
    }
}

// Open demanda detail modal
function openDemandaModal(demanda) {
    const modal = document.getElementById('modal-ver-demanda');
    if (!modal) return;

    // Store for action buttons
    currentDemandaForActions = demanda;

    document.getElementById('ver-titulo').textContent = demanda.titulo;
    document.getElementById('ver-descricao').textContent = demanda.descricao || 'Sem descrição';
    document.getElementById('ver-criador').textContent = demanda.criador?.nome || 'Desconhecido';
    document.getElementById('ver-atribuido').textContent = demanda.atribuido?.nome || 'Não atribuído';
    document.getElementById('ver-status').textContent = STATUS_LABELS[demanda.status] || demanda.status;
    document.getElementById('ver-previsao').textContent = formatDate(demanda.data_previsao);
    document.getElementById('ver-horas').textContent = demanda.horas_estimadas + 'h';
    document.getElementById('ver-criado').textContent = formatDate(demanda.created_at);

    // Set current status in dropdown
    const statusSelect = document.getElementById('mudar-status');
    if (statusSelect) {
        statusSelect.value = demanda.status;
    }

    // Store demanda id for save button
    modal.dataset.demandaId = demanda.id;

    // Reset tabs to "Detalhes" tab
    resetModalTabs();

    // Display attachment in Anexos tab
    renderAnexos(demanda.arquivo_url);

    modal.classList.remove('hidden');
}

// Reset modal tabs to default (Detalhes)
function resetModalTabs() {
    const tabs = document.querySelectorAll('.modal-tab');
    const contents = document.querySelectorAll('.modal-tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    // Activate first tab
    const firstTab = document.querySelector('.modal-tab[data-tab="detalhes"]');
    const firstContent = document.getElementById('tab-detalhes');
    if (firstTab) firstTab.classList.add('active');
    if (firstContent) firstContent.classList.add('active');
}

// Switch modal tabs
function switchModalTab(tabName) {
    const tabs = document.querySelectorAll('.modal-tab');
    const contents = document.querySelectorAll('.modal-tab-content');

    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    contents.forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
}

// Render attachment preview
function renderAnexos(arquivoUrl) {
    const container = document.getElementById('anexos-container');
    if (!container) return;

    if (!arquivoUrl) {
        container.innerHTML = '<p class="empty-message">Nenhum anexo nesta demanda.</p>';
        return;
    }

    // Check if it's an image
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(arquivoUrl);

    if (isImage) {
        container.innerHTML = `
            <div class="anexo-item">
                <img src="${arquivoUrl}" alt="Anexo" class="anexo-imagem" onclick="window.open('${arquivoUrl}', '_blank')">
                <br>
                <a href="${arquivoUrl}" target="_blank" class="anexo-link">
                    📥 Abrir em nova aba
                </a>
            </div>
        `;
    } else {
        // For non-image files, show download link
        const fileName = arquivoUrl.split('/').pop();
        container.innerHTML = `
            <div class="anexo-item">
                <p style="margin-bottom: 10px; color: var(--text-secondary);">📎 Arquivo anexado:</p>
                <a href="${arquivoUrl}" target="_blank" class="anexo-link">
                    📥 Baixar ${fileName}
                </a>
            </div>
        `;
    }
}

// Load users for dropdowns
async function loadAllUsers() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('nome');

        if (error) throw error;

        allUsers = data || [];
        populateUserDropdowns();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Populate user dropdowns
function populateUserDropdowns() {
    const atribuirSelect = document.getElementById('atribuir-para');
    const filterSelect = document.getElementById('filter-usuario');

    if (atribuirSelect) {
        // Start with placeholder - no pre-selection allowed
        atribuirSelect.innerHTML = '<option value="">Selecione um usuário...</option>';
        allUsers.forEach(user => {
            // Add "★ Eu - " prefix if this is the current logged-in user
            const isCurrentUser = currentProfile && currentProfile.id === user.id;
            const prefix = isCurrentUser ? '★ Eu - ' : '';
            atribuirSelect.innerHTML += `<option value="${user.id}">${prefix}${escapeHtml(user.nome)} (${user.cargo})</option>`;
        });
    }

    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Todos os usuários</option>';
        allUsers.forEach(user => {
            filterSelect.innerHTML += `<option value="${user.id}">${escapeHtml(user.nome)}</option>`;
        });
    }
}

// currentDemandaForActions is declared at top of file

// Excluir demanda
async function excluirDemanda() {
    if (!currentDemandaForActions) return;

    if (!confirm('Tem certeza que deseja excluir esta demanda? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('demandas')
            .delete()
            .eq('id', currentDemandaForActions.id);

        if (error) throw error;

        // Close modal and reload
        document.getElementById('modal-ver-demanda').classList.add('hidden');
        await loadDemandas(getCurrentFilters());

        // Also refresh user tasks view if active
        if (isUserTasksViewActive && typeof loadUserTasksView === 'function') {
            await loadUserTasksView();
        }

        alert('Demanda excluída com sucesso!');
    } catch (error) {
        console.error('Error deleting demanda:', error);
        alert('Erro ao excluir demanda: ' + error.message);
    }
}

// Duplicar demanda
async function duplicarDemanda() {
    if (!currentDemandaForActions) return;

    try {
        const demandaData = {
            titulo: currentDemandaForActions.titulo + ' (Cópia)',
            descricao: currentDemandaForActions.descricao || null,
            criado_por: currentUser.id,
            atribuido_para: null,
            status: 'A_FAZER',
            data_previsao: currentDemandaForActions.data_previsao || null,
            horas_estimadas: currentDemandaForActions.horas_estimadas || 8,
            arquivo_url: null
        };

        const { error } = await supabase
            .from('demandas')
            .insert([demandaData]);

        if (error) throw error;

        // Close modal and reload
        document.getElementById('modal-ver-demanda').classList.add('hidden');
        await loadDemandas(getCurrentFilters());

        alert('Demanda duplicada com sucesso!');
    } catch (error) {
        console.error('Error duplicating demanda:', error);
        alert('Erro ao duplicar demanda: ' + error.message);
    }
}

// Abrir modal de delegação
function abrirModalDelegar() {
    if (!currentDemandaForActions) return;

    // Populate user dropdown (exclude current user)
    const delegarSelect = document.getElementById('delegar-usuario');
    if (delegarSelect) {
        delegarSelect.innerHTML = '<option value="">Selecione um usuário...</option>';
        allUsers.forEach(user => {
            if (user.id !== currentProfile?.id) {
                delegarSelect.innerHTML += `<option value="${user.id}">${escapeHtml(user.nome)} (${user.cargo})</option>`;
            }
        });
    }

    document.getElementById('modal-delegar').classList.remove('hidden');
}

// Fechar modal de delegação
function fecharModalDelegar() {
    document.getElementById('modal-delegar').classList.add('hidden');
}

// Confirmar delegação
async function confirmarDelegacao() {
    const novoUsuarioId = document.getElementById('delegar-usuario').value;

    if (!novoUsuarioId) {
        alert('Selecione um usuário para delegar a demanda.');
        return;
    }

    if (!currentDemandaForActions || !currentDemandaForActions.id) {
        alert('Erro: demanda não encontrada. Recarregue a página e tente novamente.');
        return;
    }

    const demandaId = currentDemandaForActions.id;

    try {
        const { error } = await supabase
            .from('demandas')
            .update({
                atribuido_para: novoUsuarioId,
                updated_at: new Date().toISOString()
            })
            .eq('id', demandaId);

        if (error) throw error;

        // Clear state
        currentDemandaForActions = null;

        // Close modals and reload
        fecharModalDelegar();
        document.getElementById('modal-ver-demanda').classList.add('hidden');
        await loadDemandas(getCurrentFilters());

        // Also refresh user tasks view if active
        if (isUserTasksViewActive && typeof loadUserTasksView === 'function') {
            await loadUserTasksView();
        }

        alert('Demanda delegada com sucesso!');
    } catch (error) {
        console.error('Error delegating demanda:', error);
        alert('Erro ao delegar demanda: ' + error.message);
    }
}

// Abrir modal de edição
function abrirModalEditar() {
    if (!currentDemandaForActions) return;

    // Fill the edit form with current values
    document.getElementById('editar-demanda-id').value = currentDemandaForActions.id;
    document.getElementById('editar-titulo').value = currentDemandaForActions.titulo || '';
    document.getElementById('editar-descricao').value = currentDemandaForActions.descricao || '';
    document.getElementById('editar-horas').value = currentDemandaForActions.horas_estimadas || 8;

    // Format date for datetime-local input
    if (currentDemandaForActions.data_previsao) {
        const date = new Date(currentDemandaForActions.data_previsao);
        const dateStr = date.toISOString().slice(0, 16);
        document.getElementById('editar-previsao').value = dateStr;
    } else {
        document.getElementById('editar-previsao').value = '';
    }

    document.getElementById('modal-editar-demanda').classList.remove('hidden');
}

// Fechar modal de edição
function fecharModalEditar() {
    document.getElementById('modal-editar-demanda').classList.add('hidden');
}

// Salvar edição da demanda
async function salvarEdicaoDemanda(e) {
    e.preventDefault();

    const demandaId = document.getElementById('editar-demanda-id').value;

    try {
        // Convert datetime-local value to proper ISO string with timezone
        const previsaoValue = document.getElementById('editar-previsao').value;
        let dataPrevisaoISO = null;
        if (previsaoValue) {
            const localDate = new Date(previsaoValue);
            dataPrevisaoISO = localDate.toISOString();
        }

        const updateData = {
            titulo: document.getElementById('editar-titulo').value,
            descricao: document.getElementById('editar-descricao').value || null,
            data_previsao: dataPrevisaoISO,
            horas_estimadas: parseFloat(document.getElementById('editar-horas').value) || 8,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('demandas')
            .update(updateData)
            .eq('id', demandaId);

        if (error) throw error;

        // Close modals and reload
        fecharModalEditar();
        document.getElementById('modal-ver-demanda').classList.add('hidden');
        await loadDemandas(getCurrentFilters());

        // Also refresh user tasks view if active
        if (isUserTasksViewActive && typeof loadUserTasksView === 'function') {
            await loadUserTasksView();
        }

        alert('Demanda atualizada com sucesso!');
    } catch (error) {
        console.error('Error updating demanda:', error);
        alert('Erro ao atualizar demanda: ' + error.message);
    }
}

