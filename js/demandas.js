// Demandas Functions

// Global state for demand actions
let currentDemandaForActions = null;

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

        if (filters.data) {
            const startDate = new Date(filters.data);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(filters.data);
            endDate.setHours(23, 59, 59, 999);

            query = query.gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());
        }

        // If not admin/manager, only show own demandas
        // Show demands assigned to current user OR created by current user but not yet assigned
        if (!canManageDemands(currentProfile?.cargo)) {
            query = query.or(`atribuido_para.eq.${currentProfile.id},and(criado_por.eq.${currentProfile.id},atribuido_para.is.null)`);
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

    // Filter demands to only show relevant ones:
    // 1. Demands assigned to current user
    // 2. Demands created by current user but not yet assigned to anyone
    const currentUserId = currentProfile?.id;
    const visibleDemandas = allDemandas.filter(d => {
        // If assigned to current user, show it
        if (d.atribuido_para === currentUserId) return true;
        // If created by current user and not assigned to anyone, show it
        if (d.criado_por === currentUserId && !d.atribuido_para) return true;
        // If user is admin/manager and demand has no assignment, show it
        if (canManageDemands(currentProfile?.cargo) && !d.atribuido_para) return true;
        // Otherwise, hide it
        return false;
    });

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

    // Calculate remaining time
    const tempoRestante = calcularTempoRestante(demanda.data_previsao);

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
        <div class="demand-card-timer ${tempoRestante.esgotado ? 'timer-esgotado' : ''}" data-previsao="${demanda.data_previsao || ''}">
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
function calcularTempoRestante(dataPrevisao) {
    if (!dataPrevisao) return { texto: 'Sem previsão', esgotado: false };

    const agora = new Date();
    const previsao = new Date(dataPrevisao);
    const diff = previsao - agora;

    if (diff <= 0) {
        return { texto: 'Tempo restante: Tempo esgotado!', esgotado: true };
    }

    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((diff % (1000 * 60)) / 1000);

    let texto = 'Tempo restante: ';
    if (dias > 0) texto += `${dias}d `;
    texto += `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

    return { texto, esgotado: false };
}

// Timer update interval
let timerInterval = null;

function startTimerUpdates() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        document.querySelectorAll('.demand-card-timer[data-previsao]').forEach(timerEl => {
            const dataPrevisao = timerEl.dataset.previsao;
            if (dataPrevisao) {
                const tempo = calcularTempoRestante(dataPrevisao);
                timerEl.textContent = tempo.texto;
                timerEl.classList.toggle('timer-esgotado', tempo.esgotado);
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
    const filterData = document.getElementById('filter-data')?.value;

    return {
        usuario: filterUsuario || null,
        data: filterData || null
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

        const demandaData = {
            titulo,
            descricao: descricao || null,
            criado_por: currentUser.id,
            atribuido_para: atribuido_para || null,
            status: status || 'NA_FILA',
            data_previsao: data_previsao || null,
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
        const updateData = {
            titulo: document.getElementById('editar-titulo').value,
            descricao: document.getElementById('editar-descricao').value || null,
            data_previsao: document.getElementById('editar-previsao').value || null,
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

