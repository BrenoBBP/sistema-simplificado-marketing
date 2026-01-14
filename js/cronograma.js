// Cronograma - Schedule View
// Accessible only to ADM/DIRETOR/GERENTE

let isCronogramaViewActive = false;

// Day names in Portuguese
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Escape HTML for PDF generation
function escapeHtmlForCronogramaPdf(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Check if user can access cronograma
function canAccessCronograma(cargo) {
    return ['DIRETOR', 'GERENTE', 'ADM'].includes(cargo);
}

// Update cronograma button visibility
function updateCronogramaButtonVisibility() {
    const btn = document.getElementById('btn-cronograma');
    if (!btn) return;

    if (currentProfile && canAccessCronograma(currentProfile.cargo)) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

// Toggle cronograma view
function toggleCronogramaView() {
    const section = document.getElementById('cronograma-section');
    const kanbanContainer = document.getElementById('kanban-container');
    const kanbanFilters = document.getElementById('kanban-filters');
    const tarefasUsuarioSection = document.getElementById('tarefas-usuario-section');
    const funcionariosSection = document.getElementById('funcionarios-section');
    const biDashboardSection = document.getElementById('bi-dashboard-section');
    const userDashboardSection = document.getElementById('user-dashboard-section');
    const btnCronograma = document.getElementById('btn-cronograma');

    if (isCronogramaViewActive) {
        // Close cronograma, show kanban
        section.classList.add('hidden');
        kanbanContainer.classList.remove('hidden');
        kanbanFilters?.classList.remove('hidden');
        isCronogramaViewActive = false;

        if (btnCronograma) {
            btnCronograma.textContent = 'Cronograma';
        }
    } else {
        // Open cronograma, hide others
        section.classList.remove('hidden');
        kanbanContainer.classList.add('hidden');
        kanbanFilters?.classList.add('hidden');
        tarefasUsuarioSection?.classList.add('hidden');
        funcionariosSection?.classList.add('hidden');
        biDashboardSection?.classList.add('hidden');
        userDashboardSection?.classList.add('hidden');

        // Reset other view states and button texts
        if (typeof isUserTasksViewActive !== 'undefined') isUserTasksViewActive = false;
        if (typeof isUsuariosViewActive !== 'undefined') isUsuariosViewActive = false;
        if (typeof biDashboardActive !== 'undefined') biDashboardActive = false;
        if (typeof isUserDashboardActive !== 'undefined') isUserDashboardActive = false;

        // Reset other button texts
        const btnPorUsuario = document.getElementById('btn-por-usuario');
        if (btnPorUsuario) {
            btnPorUsuario.textContent = 'Por Usuário';
            btnPorUsuario.classList.remove('btn-purple');
            btnPorUsuario.classList.add('btn-orange');
        }
        const btnMeuPainel = document.getElementById('btn-meu-painel');
        if (btnMeuPainel) btnMeuPainel.textContent = 'Meu Painel';
        const btnUsuarios = document.getElementById('btn-usuarios');
        if (btnUsuarios) btnUsuarios.textContent = 'Usuários';

        isCronogramaViewActive = true;

        // Initialize filters with current month/year
        initCronogramaFilters();
        populateCronogramaUserFilter();

        if (btnCronograma) {
            btnCronograma.textContent = 'Kanban';
        }
    }
}

// Initialize filter dropdowns with current date
function initCronogramaFilters() {
    const now = new Date();
    const monthSelect = document.getElementById('cronograma-filter-month');
    const yearSelect = document.getElementById('cronograma-filter-year');

    if (monthSelect) {
        monthSelect.value = String(now.getMonth() + 1);
    }
    if (yearSelect) {
        yearSelect.value = String(now.getFullYear());
    }
}

// Populate user filter dropdown
async function populateCronogramaUserFilter() {
    const select = document.getElementById('cronograma-filter-user');
    if (!select) return;

    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, nome, cargo')
            .order('nome');

        if (error) throw error;

        // Filter out requester-only users (SOLICITANTE)
        const filteredUsers = users.filter(user => !isRequesterOnlyRole(user.cargo));

        // No "Todos" option - user must select a specific person
        select.innerHTML = '';
        filteredUsers.forEach((user, index) => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.nome;
            if (index === 0) option.selected = true; // Select first user by default
            select.appendChild(option);
        });

        // Auto-load cronograma with first user selected
        if (filteredUsers.length > 0) {
            loadCronograma();
        }
    } catch (error) {
        console.error('Error populating cronograma user filter:', error);
    }
}

// Cache demandas for click handler
let cronogramaDemandasCache = [];

// Load cronograma data
async function loadCronograma() {
    const userId = document.getElementById('cronograma-filter-user')?.value || '';
    const month = parseInt(document.getElementById('cronograma-filter-month')?.value) || (new Date().getMonth() + 1);
    const year = parseInt(document.getElementById('cronograma-filter-year')?.value) || new Date().getFullYear();
    const statusFilter = document.getElementById('cronograma-filter-status')?.value || 'APROVADO';

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    try {
        // Build query
        let query = supabase
            .from('demandas')
            .select(`
                *,
                criador:profiles!demandas_criado_por_fkey(id, nome),
                atribuido:profiles!demandas_atribuido_para_fkey(id, nome)
            `)
            .gte('updated_at', startDate.toISOString())
            .lte('updated_at', endDate.toISOString())
            .order('updated_at', { ascending: false });

        // Filter by status
        if (statusFilter === 'TODOS') {
            query = query.in('status', ['APROVADO', 'EM_ANDAMENTO']);
        } else {
            query = query.eq('status', statusFilter);
        }

        // Filter by user if selected
        if (userId) {
            query = query.eq('atribuido_para', userId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Store demandas in cache for click handler
        cronogramaDemandasCache = data || [];

        renderCronograma(data || [], year, month);
    } catch (error) {
        console.error('Error loading cronograma:', error);
    }
}

// Render cronograma with day columns
function renderCronograma(demandas, year, month) {
    const container = document.getElementById('cronograma-kanban');
    if (!container) return;

    // Group demandas by day (using updated_at for completion date)
    const demandasByDay = {};

    demandas.forEach(demanda => {
        const date = new Date(demanda.updated_at);
        const day = date.getDate();
        if (!demandasByDay[day]) {
            demandasByDay[day] = [];
        }
        demandasByDay[day].push(demanda);
    });

    // Get sorted days
    const days = Object.keys(demandasByDay).map(Number).sort((a, b) => b - a);

    if (days.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhuma demanda encontrada para o período selecionado.</p>';
        return;
    }

    // Render columns
    container.innerHTML = days.map(day => {
        const date = new Date(year, month - 1, day);
        const dayName = DIAS_SEMANA[date.getDay()];
        const dayDemandas = demandasByDay[day];

        return `
            <div class="cronograma-day-column">
                <div class="cronograma-day-header">
                    <span class="cronograma-day-number">Dia ${day}</span>
                    <span class="cronograma-day-name">(${dayName})</span>
                    <span class="cronograma-day-count">${dayDemandas.length}</span>
                </div>
                <div class="cronograma-day-cards">
                    ${dayDemandas.map(d => createCronogramaCard(d)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Handle click on cronograma cards
function handleCronogramaCardClick(e) {
    const card = e.target.closest('.cronograma-card');
    if (!card) return;

    const demandaId = card.dataset.demandaId;
    if (!demandaId) return;

    // Find the demanda in cache
    const demanda = cronogramaDemandasCache.find(d => d.id === demandaId);
    if (demanda && typeof openDemandaModal === 'function') {
        openDemandaModal(demanda);
    }
}

// Create cronograma card HTML
function createCronogramaCard(demanda) {
    const taskId = `TSK-${new Date(demanda.created_at).getFullYear()}${String(new Date(demanda.created_at).getMonth() + 1).padStart(2, '0')}${String(new Date(demanda.created_at).getDate()).padStart(2, '0')}${demanda.id.substring(0, 8).toUpperCase()}`;
    const createdDate = formatDate(demanda.created_at);
    const previsaoDate = demanda.data_previsao ? formatDate(demanda.data_previsao) : '-';
    const atribuidoNome = demanda.atribuido?.nome || 'Não atribuído';
    const isAndamento = demanda.status === 'EM_ANDAMENTO';

    return `
        <div class="cronograma-card ${isAndamento ? 'andamento' : ''}" data-demanda-id="${demanda.id}" style="cursor: pointer;">
            <div class="cronograma-card-id">${taskId}</div>
            <div class="cronograma-card-title">${escapeHtml(demanda.titulo)}</div>
            <div class="cronograma-card-info">
                <span>Criado: ${createdDate}</span>
                <span>Previsão: ${previsaoDate}</span>
            </div>
            <div class="cronograma-card-footer">
                <span class="cronograma-card-user">${escapeHtml(atribuidoNome)}</span>
                ${isAndamento ? '<span class="cronograma-card-status">Em Andamento</span>' : ''}
            </div>
        </div>
    `;
}

// Initialize cronograma event listeners
document.addEventListener('DOMContentLoaded', () => {
    const btnCronograma = document.getElementById('btn-cronograma');
    if (btnCronograma) {
        btnCronograma.addEventListener('click', toggleCronogramaView);
    }

    const filterBtn = document.getElementById('cronograma-filter-btn');
    if (filterBtn) {
        filterBtn.addEventListener('click', loadCronograma);
    }

    // PDF button
    const pdfBtn = document.getElementById('cronograma-pdf-btn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', openCronogramaPdfModal);
    }

    // PDF modal buttons
    document.getElementById('close-modal-pdf-cronograma')?.addEventListener('click', closeCronogramaPdfModal);
    document.getElementById('btn-cancelar-pdf-cronograma')?.addEventListener('click', closeCronogramaPdfModal);
    document.getElementById('btn-gerar-pdf-cronograma')?.addEventListener('click', generateCronogramaPdfReport);

    // Initialize click event listener for cronograma cards (once, not on each render)
    const cronogramaContainer = document.getElementById('cronograma-kanban');
    if (cronogramaContainer) {
        cronogramaContainer.addEventListener('click', handleCronogramaCardClick);
    }
});

// Open PDF date range selection modal
function openCronogramaPdfModal() {
    const modal = document.getElementById('modal-pdf-cronograma');
    const startInput = document.getElementById('pdf-cronograma-date-start');
    const endInput = document.getElementById('pdf-cronograma-date-end');

    // Set default dates: first day of current month to today
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    if (startInput) startInput.value = firstDayOfMonth.toISOString().split('T')[0];
    if (endInput) endInput.value = today.toISOString().split('T')[0];

    modal?.classList.remove('hidden');
}

// Close PDF modal
function closeCronogramaPdfModal() {
    document.getElementById('modal-pdf-cronograma')?.classList.add('hidden');
}

// Generate PDF report for selected date range
async function generateCronogramaPdfReport() {
    const startDate = document.getElementById('pdf-cronograma-date-start')?.value;
    const endDate = document.getElementById('pdf-cronograma-date-end')?.value;
    const userId = document.getElementById('cronograma-filter-user')?.value || '';

    if (!startDate || !endDate) {
        alert('Por favor, selecione a data de início e fim.');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        alert('A data de início deve ser anterior à data de fim.');
        return;
    }

    try {
        // Get selected user name
        const userSelect = document.getElementById('cronograma-filter-user');
        const selectedUserName = userSelect?.options[userSelect.selectedIndex]?.text || 'Todos';

        // Fetch demands for the selected date range
        let query = supabase
            .from('demandas')
            .select(`
                *,
                criador:profiles!demandas_criado_por_fkey(id, nome),
                atribuido:profiles!demandas_atribuido_para_fkey(id, nome)
            `)
            .gte('updated_at', `${startDate}T00:00:00`)
            .lte('updated_at', `${endDate}T23:59:59`)
            .in('status', ['APROVADO', 'EM_ANDAMENTO'])
            .order('updated_at', { ascending: true });

        // Filter by user if selected
        if (userId) {
            query = query.eq('atribuido_para', userId);
        }

        const { data, error } = await query;

        if (error) throw error;

        const demandas = data || [];

        if (demandas.length === 0) {
            alert('Nenhuma demanda encontrada para o período selecionado.');
            return;
        }

        // Format dates for display
        const startDateObj = new Date(startDate + 'T12:00:00');
        const endDateObj = new Date(endDate + 'T12:00:00');
        const formattedStartDate = startDateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const formattedEndDate = endDateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

        // Generate PDF content using browser print
        const printWindow = window.open('', '_blank');

        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório de Entregas - ${formattedStartDate} a ${formattedEndDate}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            padding: 40px; 
            color: #333;
            background: white;
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #9b59b6;
        }
        .header h1 { 
            color: #9b59b6; 
            font-size: 24px;
            margin-bottom: 5px;
        }
        .header .subtitle {
            color: #666;
            font-size: 14px;
        }
        .header .date { 
            font-size: 16px; 
            color: #555;
            margin-top: 10px;
        }
        .header .user-info {
            font-size: 14px;
            color: #777;
            margin-top: 5px;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        .stat-box {
            text-align: center;
            padding: 15px 25px;
            border-radius: 8px;
            background: #f5f5f5;
            min-width: 100px;
        }
        .stat-box .number {
            font-size: 28px;
            font-weight: bold;
            color: #9b59b6;
        }
        .stat-box .label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
        }
        th, td { 
            padding: 10px 8px; 
            text-align: left; 
            border-bottom: 1px solid #ddd;
            font-size: 11px;
        }
        th { 
            background: #9b59b6; 
            color: white;
            font-weight: 600;
            font-size: 10px;
            text-transform: uppercase;
        }
        tr:nth-child(even) {
            background: #fafafa;
        }
        .status {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            display: inline-block;
        }
        .status-em-andamento { background: #f39c12; color: white; }
        .status-aprovado { background: #27ae60; color: white; }
        .description {
            max-width: 350px;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 10px;
            color: #666;
            line-height: 1.4;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 11px;
            color: #999;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        @media print {
            body { padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📅 Relatório de Entregas</h1>
        <div class="subtitle">MSA Demandas - Cronograma de Entregas</div>
        <div class="date">${formattedStartDate} a ${formattedEndDate}</div>
        <div class="user-info">Colaborador: ${selectedUserName}</div>
    </div>

    <div class="stats">
        <div class="stat-box">
            <div class="number">${demandas.length}</div>
            <div class="label">Total</div>
        </div>
        <div class="stat-box">
            <div class="number">${demandas.filter(d => d.status === 'EM_ANDAMENTO').length}</div>
            <div class="label">Em Andamento</div>
        </div>
        <div class="stat-box">
            <div class="number">${demandas.filter(d => d.status === 'APROVADO').length}</div>
            <div class="label">Concluídas</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Título</th>
                <th>Descrição</th>
                <th>Status</th>
                <th>Solicitante</th>
                <th>Criado em</th>
                <th>Atualizado em</th>
            </tr>
        </thead>
        <tbody>
            ${demandas.map(d => {
            const statusLabel = STATUS_LABELS[d.status] || d.status;
            const statusClass = d.status.toLowerCase().replace('_', '-');
            const createdDate = new Date(d.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const updatedDate = new Date(d.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const description = d.descricao || '-';

            return `
                    <tr>
                        <td><strong>${escapeHtml(d.titulo)}</strong></td>
                        <td class="description">${escapeHtml(description)}</td>
                        <td><span class="status status-${statusClass}">${statusLabel}</span></td>
                        <td>${escapeHtmlForCronogramaPdf(d.criador?.nome || 'Desconhecido')}</td>
                        <td>${createdDate}</td>
                        <td>${updatedDate}</td>
                    </tr>
                `;
        }).join('')}
        </tbody>
    </table>

    <div class="footer">
        <p>Gerado automaticamente pelo Sistema MSA Demandas em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <p>Desenvolvido por Easy4u | © ${new Date().getFullYear()} GRUPO MSA</p>
    </div>

    <script>
        window.onload = function() {
            window.print();
        }
    </script>
</body>
</html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Close modal
        closeCronogramaPdfModal();

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Erro ao gerar PDF: ' + error.message);
    }
}
