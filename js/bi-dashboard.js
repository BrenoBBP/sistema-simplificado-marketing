// BI Dashboard Functions

let biDashboardActive = false;
let biAllDemandas = [];

// Load BI Dashboard
async function loadBIDashboard(filterUserId = null) {
    try {
        // Fetch all demandas for BI
        const { data, error } = await supabase
            .from('demandas')
            .select(`
                *,
                criador:profiles!demandas_criado_por_fkey(id, nome, email, cargo),
                atribuido:profiles!demandas_atribuido_para_fkey(id, nome, email, cargo)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        biAllDemandas = data || [];

        // Filter by user if specified
        let filteredDemandas = biAllDemandas;
        if (filterUserId) {
            filteredDemandas = biAllDemandas.filter(d => d.atribuido_para === filterUserId);
        }

        // Update KPIs
        updateKPIs(filteredDemandas);

        // Update Charts
        updateStatusChart(filteredDemandas);
        updateUsersChart(biAllDemandas);

        // Update Table
        updateBITable(biAllDemandas, filterUserId);

        // Populate user filter dropdown
        populateBIUserFilter();

    } catch (error) {
        console.error('Error loading BI dashboard:', error);
    }
}

// Update KPI Cards
function updateKPIs(demandas) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Demandas abertas (não concluídas)
    const abertas = demandas.filter(d => d.status !== 'APROVADO').length;

    // Concluídas nos últimos 30 dias
    const concluidas = demandas.filter(d => {
        if (d.status !== 'APROVADO') return false;
        const updatedAt = new Date(d.updated_at);
        return updatedAt >= thirtyDaysAgo;
    }).length;

    // Em andamento
    const emAndamento = demandas.filter(d => d.status === 'EM_ANDAMENTO').length;

    // Atrasadas (com data_previsao no passado e não concluídas)
    const atrasadas = demandas.filter(d => {
        if (d.status === 'APROVADO') return false;
        if (!d.data_previsao) return false;
        return new Date(d.data_previsao) < now;
    }).length;

    // Update DOM
    document.getElementById('kpi-abertas').textContent = abertas;
    document.getElementById('kpi-concluidas').textContent = concluidas;
    document.getElementById('kpi-andamento').textContent = emAndamento;
    document.getElementById('kpi-atrasadas').textContent = atrasadas;
}

// Update Status Distribution Chart (Donut)
function updateStatusChart(demandas) {
    const container = document.getElementById('chart-status');
    if (!container) return;

    const statusCount = {
        'A_FAZER': 0,
        'FIXO': 0,
        'EM_ANDAMENTO': 0,
        'PARA_APROVACAO': 0,
        'EM_REVISAO': 0,
        'APROVADO': 0
    };

    demandas.forEach(d => {
        if (statusCount[d.status] !== undefined) {
            statusCount[d.status]++;
        }
    });

    const total = demandas.length;
    const colors = {
        'A_FAZER': '#0984e3',
        'FIXO': '#6c6c7c',
        'EM_ANDAMENTO': '#00b894',
        'PARA_APROVACAO': '#e17055',
        'EM_REVISAO': '#6c5ce7',
        'APROVADO': '#00cec9'
    };

    const labels = {
        'A_FAZER': 'A Fazer',
        'FIXO': 'Fixo',
        'EM_ANDAMENTO': 'Em Andamento',
        'PARA_APROVACAO': 'Para Aprovação',
        'EM_REVISAO': 'Em Revisão',
        'APROVADO': 'Concluído'
    };

    // Build conic gradient
    let gradientParts = [];
    let currentAngle = 0;

    Object.entries(statusCount).forEach(([status, count]) => {
        if (count > 0) {
            const percentage = (count / total) * 100;
            const endAngle = currentAngle + percentage;
            gradientParts.push(`${colors[status]} ${currentAngle}% ${endAngle}%`);
            currentAngle = endAngle;
        }
    });

    const gradient = gradientParts.length > 0
        ? `conic-gradient(${gradientParts.join(', ')})`
        : 'conic-gradient(#2d2d44 0% 100%)';

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
            <div class="donut-chart-container">
                <div class="donut-chart" style="background: ${gradient}">
                    <div class="donut-center">
                        <span class="donut-center-value">${total}</span>
                        <span class="donut-center-label">Total</span>
                    </div>
                </div>
            </div>
            <div class="chart-legend">
                ${Object.entries(statusCount).filter(([, c]) => c > 0).map(([status, count]) => `
                    <div class="legend-item">
                        <span class="legend-color" style="background: ${colors[status]}"></span>
                        ${labels[status]} (${count})
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Update Users Performance Chart (Bar)
function updateUsersChart(demandas) {
    const container = document.getElementById('chart-usuarios');
    if (!container) return;

    // Count demandas by user
    const userCounts = {};

    demandas.forEach(d => {
        if (d.atribuido?.nome) {
            const nome = d.atribuido.nome;
            if (!userCounts[nome]) {
                userCounts[nome] = { total: 0, concluidas: 0 };
            }
            userCounts[nome].total++;
            if (d.status === 'APROVADO') {
                userCounts[nome].concluidas++;
            }
        }
    });

    const maxCount = Math.max(...Object.values(userCounts).map(u => u.total), 1);

    const barColors = ['#0984e3', '#00b894', '#6c5ce7', '#e17055', '#fdcb6e', '#00cec9'];

    const barsHtml = Object.entries(userCounts).map(([nome, counts], index) => {
        const heightPercent = (counts.total / maxCount) * 180;
        const color = barColors[index % barColors.length];
        const firstName = nome.split(' ')[0];

        return `
            <div class="chart-bar-item">
                <span class="chart-bar-value">${counts.total}</span>
                <div class="chart-bar" style="height: ${heightPercent}px; background: linear-gradient(180deg, ${color}, ${color}88);"></div>
                <span class="chart-bar-label" title="${nome}">${firstName}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="chart-bars" style="width: 100%;">
            ${barsHtml || '<p style="color: var(--text-muted);">Sem dados</p>'}
        </div>
    `;
}

// Update BI Table
function updateBITable(demandas, filterUserId) {
    const tbody = document.getElementById('bi-table-tbody');
    if (!tbody) return;

    // Group by user
    const userStats = {};

    demandas.forEach(d => {
        const userId = d.atribuido_para;
        const userName = d.atribuido?.nome || 'Não atribuído';

        if (!userStats[userId || 'unassigned']) {
            userStats[userId || 'unassigned'] = {
                nome: userName,
                a_fazer: 0,
                em_andamento: 0,
                para_aprovacao: 0,
                concluidas: 0,
                total: 0
            };
        }

        const stats = userStats[userId || 'unassigned'];
        stats.total++;

        switch (d.status) {
            case 'A_FAZER':
            case 'FIXO':
                stats.a_fazer++;
                break;
            case 'EM_ANDAMENTO':
                stats.em_andamento++;
                break;
            case 'PARA_APROVACAO':
            case 'EM_REVISAO':
                stats.para_aprovacao++;
                break;
            case 'APROVADO':
                stats.concluidas++;
                break;
        }
    });

    // Filter if user selected
    let filteredStats = Object.entries(userStats);
    if (filterUserId) {
        filteredStats = filteredStats.filter(([id]) => id === filterUserId);
    }

    tbody.innerHTML = filteredStats.map(([id, stats]) => `
        <tr>
            <td class="user-name">${escapeHtml(stats.nome)}</td>
            <td class="count-cell">${stats.a_fazer}</td>
            <td class="count-cell">${stats.em_andamento}</td>
            <td class="count-cell">${stats.para_aprovacao}</td>
            <td class="count-cell">${stats.concluidas}</td>
            <td class="count-cell"><span class="count-highlight">${stats.total}</span></td>
        </tr>
    `).join('');

    if (filteredStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum dado encontrado</td></tr>';
    }
}

// Populate BI User Filter (only populate once, don't overwrite existing options)
function populateBIUserFilter() {
    const select = document.getElementById('bi-filter-usuario');
    if (!select) return;

    // Only populate if empty (just the default option)
    if (select.options.length <= 1) {
        allUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.nome;
            select.appendChild(option);
        });
    }
}

// Show BI Dashboard
function showBIDashboard() {
    biDashboardActive = true;

    // Hide other sections
    document.getElementById('kanban-container').classList.add('hidden');
    document.getElementById('tarefas-usuario-section')?.classList.add('hidden');
    document.getElementById('funcionarios-section')?.classList.add('hidden');

    // Show BI section
    document.getElementById('bi-dashboard-section').classList.remove('hidden');

    // Reset filter to Visão Geral when opening
    const select = document.getElementById('bi-filter-usuario');
    if (select) {
        select.value = '';
    }

    // Load data with no filter (general view)
    loadBIDashboard(null);
}

// Hide BI Dashboard
function hideBIDashboard() {
    biDashboardActive = false;

    // Hide BI section
    document.getElementById('bi-dashboard-section').classList.add('hidden');

    // Show kanban
    document.getElementById('kanban-container').classList.remove('hidden');
}

// Setup BI Dashboard Event Listeners
function setupBIDashboardListeners() {
    // Relatórios BI button
    document.getElementById('btn-relatorios')?.addEventListener('click', () => {
        showBIDashboard();
    });

    // Voltar ao Kanban button
    document.getElementById('btn-voltar-kanban')?.addEventListener('click', () => {
        hideBIDashboard();
    });

    // User filter change
    document.getElementById('bi-filter-usuario')?.addEventListener('change', (e) => {
        loadBIDashboard(e.target.value || null);
    });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    setupBIDashboardListeners();
});
