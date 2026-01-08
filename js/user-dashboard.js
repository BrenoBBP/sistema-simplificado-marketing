// User Dashboard - Personal overview for all users

let isUserDashboardActive = false;

// Cache demandas for click handler and PDF
let dashboardDemandasCache = [];

// Toggle user dashboard view
function toggleUserDashboard() {
    const section = document.getElementById('user-dashboard-section');
    const kanbanContainer = document.getElementById('kanban-container');
    const kanbanFilters = document.getElementById('kanban-filters');
    const tarefasUsuarioSection = document.getElementById('tarefas-usuario-section');
    const cronogramaSection = document.getElementById('cronograma-section');
    const funcionariosSection = document.getElementById('funcionarios-section');
    const biDashboardSection = document.getElementById('bi-dashboard-section');
    const btnMeuPainel = document.getElementById('btn-meu-painel');

    if (isUserDashboardActive) {
        // Close dashboard, show kanban
        section.classList.add('hidden');
        kanbanContainer.classList.remove('hidden');
        kanbanFilters?.classList.remove('hidden');
        isUserDashboardActive = false;

        if (btnMeuPainel) {
            btnMeuPainel.textContent = 'Meu Painel';
        }
    } else {
        // Open dashboard, hide others
        section.classList.remove('hidden');
        kanbanContainer.classList.add('hidden');
        kanbanFilters?.classList.add('hidden');
        tarefasUsuarioSection?.classList.add('hidden');
        cronogramaSection?.classList.add('hidden');
        funcionariosSection?.classList.add('hidden');
        biDashboardSection?.classList.add('hidden');

        // Reset other view states
        if (typeof isUserTasksViewActive !== 'undefined') isUserTasksViewActive = false;
        if (typeof isCronogramaViewActive !== 'undefined') isCronogramaViewActive = false;
        if (typeof isUsuariosViewActive !== 'undefined') isUsuariosViewActive = false;
        if (typeof biDashboardActive !== 'undefined') biDashboardActive = false;

        // Reset other button texts
        const btnPorUsuario = document.getElementById('btn-por-usuario');
        if (btnPorUsuario) {
            btnPorUsuario.textContent = 'Por Usuário';
            btnPorUsuario.classList.remove('btn-purple');
            btnPorUsuario.classList.add('btn-orange');
        }
        const btnCronograma = document.getElementById('btn-cronograma');
        if (btnCronograma) btnCronograma.textContent = 'Cronograma';
        const btnUsuarios = document.getElementById('btn-usuarios');
        if (btnUsuarios) btnUsuarios.textContent = 'Usuários';

        isUserDashboardActive = true;

        // Initialize filters with current month/year
        initDashboardFilters();
        loadUserDashboard();

        if (btnMeuPainel) {
            btnMeuPainel.textContent = 'Kanban';
        }
    }
}

// Initialize filter dropdowns with current date
function initDashboardFilters() {
    const now = new Date();
    const monthSelect = document.getElementById('dashboard-filter-month');
    const yearSelect = document.getElementById('dashboard-filter-year');
    const dayInput = document.getElementById('dashboard-filter-day');

    if (monthSelect) {
        monthSelect.value = String(now.getMonth() + 1);
    }
    if (yearSelect) {
        yearSelect.value = String(now.getFullYear());
    }
    // Clear day filter by default
    if (dayInput) {
        dayInput.value = '';
    }
}

// Load user dashboard data
async function loadUserDashboard() {
    if (!currentProfile?.id) return;

    const dayFilter = document.getElementById('dashboard-filter-day')?.value || '';
    const month = parseInt(document.getElementById('dashboard-filter-month')?.value) || 0;
    const year = parseInt(document.getElementById('dashboard-filter-year')?.value) || new Date().getFullYear();

    try {
        // Build query for user's demands
        let query = supabase
            .from('demandas')
            .select(`
                *,
                criador:profiles!demandas_criado_por_fkey(id, nome)
            `)
            .eq('atribuido_para', currentProfile.id)
            .order('updated_at', { ascending: false });

        // If day filter is set, use it (takes priority over month/year)
        if (dayFilter) {
            const startDate = `${dayFilter}T00:00:00`;
            const endDate = `${dayFilter}T23:59:59`;
            query = query.gte('created_at', startDate).lte('created_at', endDate);
        } else if (month > 0) {
            // Apply month filter
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            query = query.gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());
        } else {
            // Filter by year only
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            query = query.gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;

        // Calculate stats
        const demandas = data || [];

        // Store demandas in cache for click handler and PDF
        dashboardDemandasCache = demandas;

        const total = demandas.length;
        const aFazer = demandas.filter(d => d.status === 'A_FAZER' || d.status === 'FIXO').length;
        const emAndamento = demandas.filter(d => d.status === 'EM_ANDAMENTO').length;
        const concluidas = demandas.filter(d => d.status === 'APROVADO').length;

        // Update stat cards
        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-afazer').textContent = aFazer;
        document.getElementById('stat-andamento').textContent = emAndamento;
        document.getElementById('stat-concluidas').textContent = concluidas;

        // Render recent demands list
        renderDashboardDemands(demandas.slice(0, 10));

        // Add click event listener for demand items
        const container = document.getElementById('dashboard-demands-list');
        if (container) {
            container.addEventListener('click', handleDashboardDemandClick);
        }

    } catch (error) {
        console.error('Error loading user dashboard:', error);
    }
}

// Handle click on dashboard demand items
function handleDashboardDemandClick(e) {
    const item = e.target.closest('.demand-item');
    if (!item) return;

    const demandaId = item.dataset.demandaId;
    if (!demandaId) return;

    // Find the demanda in cache
    const demanda = dashboardDemandasCache.find(d => d.id === demandaId);
    if (demanda && typeof openDemandaModal === 'function') {
        openDemandaModal(demanda);
    }
}

// Render demands list
function renderDashboardDemands(demandas) {
    const container = document.getElementById('dashboard-demands-list');
    if (!container) return;

    if (demandas.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhuma demanda encontrada para o período selecionado.</p>';
        return;
    }

    container.innerHTML = demandas.map(d => {
        const statusLabel = STATUS_LABELS[d.status] || d.status;
        const statusClass = d.status.toLowerCase().replace('_', '-');
        const createdDate = formatDate(d.created_at);

        return `
            <div class="demand-item" data-demanda-id="${d.id}" style="cursor: pointer;">
                <div class="demand-item-main">
                    <span class="demand-item-title">${escapeHtml(d.titulo)}</span>
                    <span class="demand-item-status status-${statusClass}">${statusLabel}</span>
                </div>
                <div class="demand-item-meta">
                    <span>Criado: ${createdDate}</span>
                    <span>Por: ${d.criador?.nome || 'Desconhecido'}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Open PDF date selection modal
function openPdfModal() {
    const modal = document.getElementById('modal-pdf-date');
    const dateInput = document.getElementById('pdf-report-date');

    // Set default to today
    const today = new Date().toISOString().split('T')[0];
    if (dateInput) dateInput.value = today;

    modal?.classList.remove('hidden');
}

// Close PDF modal
function closePdfModal() {
    document.getElementById('modal-pdf-date')?.classList.add('hidden');
}

// Generate PDF report for selected date
async function generatePdfReport() {
    const dateValue = document.getElementById('pdf-report-date')?.value;

    if (!dateValue) {
        alert('Por favor, selecione uma data para o relatório.');
        return;
    }

    try {
        // Fetch demands for the selected date
        const startDate = `${dateValue}T00:00:00`;
        const endDate = `${dateValue}T23:59:59`;

        const { data, error } = await supabase
            .from('demandas')
            .select(`
                *,
                criador:profiles!demandas_criado_por_fkey(id, nome)
            `)
            .eq('atribuido_para', currentProfile.id)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const demandas = data || [];

        if (demandas.length === 0) {
            alert('Nenhuma demanda encontrada para a data selecionada.');
            return;
        }

        // Format date for display
        const dateObj = new Date(dateValue + 'T12:00:00');
        const formattedDate = dateObj.toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Generate PDF content using browser print
        const printWindow = window.open('', '_blank');

        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório de Demandas - ${formattedDate}</title>
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
            border-bottom: 2px solid #e67e22;
        }
        .header h1 { 
            color: #e67e22; 
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
            color: #e67e22;
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
            padding: 12px 10px; 
            text-align: left; 
            border-bottom: 1px solid #ddd;
        }
        th { 
            background: #e67e22; 
            color: white;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
        }
        tr:nth-child(even) {
            background: #fafafa;
        }
        .status {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            display: inline-block;
        }
        .status-a-fazer { background: #3498db; color: white; }
        .status-fixo { background: #9b59b6; color: white; }
        .status-em-andamento { background: #f39c12; color: white; }
        .status-para-aprovacao { background: #1abc9c; color: white; }
        .status-em-revisao { background: #e74c3c; color: white; }
        .status-aprovado { background: #27ae60; color: white; }
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
        <h1>📋 Relatório de Demandas</h1>
        <div class="subtitle">MSA Demandas - Sistema de Gestão</div>
        <div class="date">${formattedDate}</div>
        <div class="user-info">Colaborador: ${currentProfile?.nome || 'Usuário'}</div>
    </div>

    <div class="stats">
        <div class="stat-box">
            <div class="number">${demandas.length}</div>
            <div class="label">Total</div>
        </div>
        <div class="stat-box">
            <div class="number">${demandas.filter(d => d.status === 'A_FAZER' || d.status === 'FIXO').length}</div>
            <div class="label">A Fazer</div>
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
                <th>Previsão</th>
            </tr>
        </thead>
        <tbody>
            ${demandas.map(d => {
            const statusLabel = STATUS_LABELS[d.status] || d.status;
            const statusClass = d.status.toLowerCase().replace('_', '-');
            const createdDate = new Date(d.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const previsaoDate = d.data_previsao ? new Date(d.data_previsao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
            const description = d.descricao ? d.descricao.substring(0, 80) + (d.descricao.length > 80 ? '...' : '') : '-';

            return `
                    <tr>
                        <td><strong>${d.titulo}</strong></td>
                        <td style="max-width: 150px; font-size: 10px; color: #666;">${description}</td>
                        <td><span class="status status-${statusClass}">${statusLabel}</span></td>
                        <td>${d.criador?.nome || 'Desconhecido'}</td>
                        <td>${createdDate}</td>
                        <td>${previsaoDate}</td>
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
        closePdfModal();

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Erro ao gerar PDF: ' + error.message);
    }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    const btnMeuPainel = document.getElementById('btn-meu-painel');
    if (btnMeuPainel) {
        btnMeuPainel.addEventListener('click', toggleUserDashboard);
    }

    const filterBtn = document.getElementById('dashboard-filter-btn');
    if (filterBtn) {
        filterBtn.addEventListener('click', loadUserDashboard);
    }

    // PDF button
    const pdfBtn = document.getElementById('dashboard-pdf-btn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', openPdfModal);
    }

    // PDF modal buttons
    document.getElementById('close-modal-pdf')?.addEventListener('click', closePdfModal);
    document.getElementById('btn-cancelar-pdf')?.addEventListener('click', closePdfModal);
    document.getElementById('btn-gerar-pdf')?.addEventListener('click', generatePdfReport);

    // Day filter change - auto update when date is selected
    const dayFilter = document.getElementById('dashboard-filter-day');
    if (dayFilter) {
        dayFilter.addEventListener('change', () => {
            if (isUserDashboardActive) {
                loadUserDashboard();
            }
        });
    }
});
