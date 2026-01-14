// Supabase Configuration
const SUPABASE_URL = 'https://jkqzdjixhbndnukrgztk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprcXpkaml4aGJuZG51a3JnenRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMDE4MTksImV4cCI6MjA4MjU3NzgxOX0.pMxGoisSOIocWAaEW-VgYrxIhB_bskgr-CyRCxD2YVw';

// Initialize Supabase Client - use different variable name to not shadow the CDN library
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global State
let currentUser = null;
let currentProfile = null;
let allUsers = [];
let allDemandas = [];

// Cargo Hierarchy
const CARGOS = {
    ADM: { level: 5, label: 'ADM' },
    DIRETOR: { level: 4, label: 'Diretor' },
    GERENTE: { level: 3, label: 'Gerente' },
    COORDENADOR: { level: 2, label: 'Coordenador' },
    COLABORADOR: { level: 1, label: 'Colaborador' },
    DESIGN: { level: 1, label: 'Design' },
    AUDIOVISUAL: { level: 1, label: 'Audio Visual' },
    SOLICITANTE: { level: 0, label: 'Solicitante', requesterOnly: true }
};

// Cargos that are "requester only" - should not appear in user reports/filters
const REQUESTER_ONLY_CARGOS = ['SOLICITANTE'];

// Status Labels
const STATUS_LABELS = {
    A_FAZER: 'A Fazer',
    FIXO: 'Fixo',
    EM_ANDAMENTO: 'Em Andamento',
    PARA_APROVACAO: 'Para Aprovação',
    EM_REVISAO: 'Em Revisão',
    APROVADO: 'Aprovado'
};

// Helper Functions
function canManageEmployees(cargo) {
    return ['ADM', 'DIRETOR'].includes(cargo);
}

function canManageDemands(cargo) {
    return ['ADM', 'DIRETOR', 'GERENTE'].includes(cargo);
}

// Check if cargo is requester-only (should be hidden from reports)
function isRequesterOnlyRole(cargo) {
    return REQUESTER_ONLY_CARGOS.includes(cargo);
}

function formatDate(dateString) {
    if (!dateString) return '-';

    // Ensure the date string is interpreted as UTC
    // Supabase may return dates with +00:00 suffix or without timezone indicator
    let dateStr = String(dateString);
    if (dateStr.includes('+00:00')) {
        dateStr = dateStr.replace('+00:00', 'Z');
    }
    // If the date doesn't have any timezone indicator, add Z to treat as UTC
    if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
        dateStr = dateStr + 'Z';
    }

    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
        .map(word => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
    }
}

function clearError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = '';
        el.style.display = 'none';
    }
}

// Expose to global scope for access from other scripts
window.supabase = supabaseClient;
window.CARGOS = CARGOS;
window.REQUESTER_ONLY_CARGOS = REQUESTER_ONLY_CARGOS;
window.STATUS_LABELS = STATUS_LABELS;
window.canManageEmployees = canManageEmployees;
window.canManageDemands = canManageDemands;
window.isRequesterOnlyRole = isRequesterOnlyRole;
window.formatDate = formatDate;
window.getInitials = getInitials;
window.showError = showError;
window.clearError = clearError;

// Expose state getters/setters
window.getCurrentUser = () => currentUser;
window.setCurrentUser = (user) => { currentUser = user; };
window.getCurrentProfile = () => currentProfile;
window.setCurrentProfile = (profile) => { currentProfile = profile; };
window.getAllUsers = () => allUsers;
window.setAllUsers = (users) => { allUsers = users; };
window.getAllDemandas = () => allDemandas;
window.setAllDemandas = (demandas) => { allDemandas = demandas; };
