// Authentication Functions

// Login
async function login(email, password) {
    try {
        clearError('login-error');

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        currentUser = data.user;
        await loadUserProfile();
        showDashboard();

        return true;
    } catch (error) {
        console.error('Login error:', error);
        showError('login-error', error.message || 'Erro ao fazer login');
        return false;
    }
}

// Register
async function register(nome, email, password) {
    try {
        clearError('register-error');

        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password
        });

        if (error) throw error;

        // Create or update profile (use upsert in case trigger already created it)
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert([{
                id: data.user.id,
                email: email,
                nome: nome,
                cargo: 'COLABORADOR'
            }], { onConflict: 'id' });

        if (profileError) {
            console.warn('Profile creation warning:', profileError);
            // Don't throw - profile might already exist from trigger
        }

        currentUser = data.user;
        await loadUserProfile();
        showDashboard();

        return true;
    } catch (error) {
        console.error('Register error:', error);
        showError('register-error', error.message || 'Erro ao cadastrar');
        return false;
    }
}

// Logout
async function logout() {
    try {
        await supabase.auth.signOut();
        currentUser = null;
        currentProfile = null;
        showLoginPage();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Load User Profile
async function loadUserProfile() {
    if (!currentUser) return;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) {
            // Profile might not exist yet (for first-time users)
            if (error.code === 'PGRST116') {
                // Create profile
                const { data: newProfile, error: createError } = await supabase
                    .from('profiles')
                    .upsert([{
                        id: currentUser.id,
                        email: currentUser.email,
                        nome: currentUser.email.split('@')[0],
                        cargo: 'COLABORADOR'
                    }], { onConflict: 'id' })
                    .select()
                    .single();

                if (createError) throw createError;
                currentProfile = newProfile;
            } else {
                throw error;
            }
        } else {
            currentProfile = data;
        }

        updateUserInfo();
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Update UI with user info
function updateUserInfo() {
    if (!currentProfile) return;

    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) {
        const cargoLabel = CARGOS[currentProfile.cargo]?.label || currentProfile.cargo;
        userInfoEl.textContent = `Olá, ${currentProfile.nome}! (Perfil: ${cargoLabel.toLowerCase()})`;
    }

    // Show/hide admin features
    const filtersSection = document.getElementById('filters-section');
    const btnDeckAprovacao = document.getElementById('btn-deck-aprovacao');
    const btnRelatorios = document.getElementById('btn-relatorios');
    const btnUsuarios = document.getElementById('btn-usuarios');

    if (canManageDemands(currentProfile.cargo)) {
        filtersSection?.classList.remove('hidden');
        btnDeckAprovacao?.classList.remove('hidden');
        btnRelatorios?.classList.remove('hidden');
    } else {
        filtersSection?.classList.add('hidden');
        btnDeckAprovacao?.classList.add('hidden');
        btnRelatorios?.classList.add('hidden');
    }

    // Show/hide employee management button (same permissions)
    if (canManageEmployees(currentProfile.cargo)) {
        btnUsuarios?.classList.remove('hidden');
    } else {
        btnUsuarios?.classList.add('hidden');
    }

    // Show/hide user tasks button (Directors/Managers only)
    if (typeof updateUserTasksButtonVisibility === 'function') {
        updateUserTasksButtonVisibility();
    }
}

// Check session on load
async function checkSession() {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            currentUser = session.user;
            await loadUserProfile();
            showDashboard();
        } else {
            showLoginPage();
        }
    } catch (error) {
        console.error('Session check error:', error);
        showLoginPage();
    }
}

// Page Navigation
function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('register-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.add('hidden');
}

function showRegisterPage() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('register-page').classList.remove('hidden');
    document.getElementById('dashboard-page').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('register-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.remove('hidden');

    // Load data
    loadAllUsers();
    loadDemandas();
}
