// Funcionarios Management Functions

// Load funcionarios for the table
async function loadFuncionarios() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('nome');

        if (error) throw error;

        renderFuncionariosTable(data || []);
    } catch (error) {
        console.error('Error loading funcionarios:', error);
    }
}

// Render funcionarios table
function renderFuncionariosTable(funcionarios) {
    const tbody = document.getElementById('funcionarios-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    funcionarios.forEach(func => {
        const tr = document.createElement('tr');
        // Don't show delete button for current user (can't delete yourself)
        const isCurrentUser = currentProfile && currentProfile.id === func.id;

        tr.innerHTML = `
            <td>${escapeHtml(func.nome)}</td>
            <td>${escapeHtml(func.email)}</td>
            <td><span class="cargo-badge cargo-${func.cargo}">${CARGOS[func.cargo]?.label || func.cargo}</span></td>
            <td>
                <button class="btn btn-primary btn-sm btn-edit-cargo" 
                    data-user-id="${func.id}" 
                    data-user-nome="${escapeHtml(func.nome)}" 
                    data-user-cargo="${func.cargo}">
                    Editar Cargo
                </button>
                ${!isCurrentUser ? `
                <button class="btn btn-excluir btn-sm btn-delete-user" 
                    data-user-id="${func.id}" 
                    data-user-nome="${escapeHtml(func.nome)}">
                    Excluir
                </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Add event listeners using delegation (prevents XSS from inline onclick)
    tbody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-cargo');
        if (editBtn) {
            const userId = editBtn.dataset.userId;
            const nome = editBtn.dataset.userNome;
            const cargo = editBtn.dataset.userCargo;
            openEditCargoModal(userId, nome, cargo);
            return;
        }

        const deleteBtn = e.target.closest('.btn-delete-user');
        if (deleteBtn) {
            const userId = deleteBtn.dataset.userId;
            const nome = deleteBtn.dataset.userNome;
            confirmDeleteUser(userId, nome);
        }
    });
}

// Open edit cargo modal
function openEditCargoModal(userId, nome, cargo) {
    const modal = document.getElementById('modal-editar-cargo');
    if (!modal) return;

    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-nome').value = nome;
    document.getElementById('edit-cargo').value = cargo;

    modal.classList.remove('hidden');
}

// Update user cargo
async function updateUserCargo(userId, newCargo) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ cargo: newCargo })
            .eq('id', userId);

        if (error) throw error;

        // Reload funcionarios
        await loadFuncionarios();
        await loadAllUsers();

        // Close modal
        document.getElementById('modal-editar-cargo').classList.add('hidden');

        alert('Cargo atualizado com sucesso!');
    } catch (error) {
        console.error('Error updating cargo:', error);
        alert('Erro ao atualizar cargo: ' + error.message);
    }
}

// Confirm delete user
function confirmDeleteUser(userId, nome) {
    // Check permission
    if (!canCreateUsers(currentProfile?.cargo)) {
        alert('Você não tem permissão para excluir usuários.');
        return;
    }

    // Show confirmation dialog
    const confirmed = confirm(`Tem certeza que deseja excluir o usuário "${nome}"?\n\nEsta ação não pode ser desfeita!`);

    if (confirmed) {
        deleteUser(userId, nome);
    }
}

// Delete user from profiles
async function deleteUser(userId, nome) {
    try {
        // Delete from profiles table
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        // Reload funcionarios
        await loadFuncionarios();
        await loadAllUsers();

        alert(`Usuário "${nome}" excluído com sucesso!`);
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Erro ao excluir usuário: ' + error.message);
    }
}

// Check if user can create new users (Diretor, Gerente, ADM only)
function canCreateUsers(cargo) {
    return ['ADM', 'DIRETOR', 'GERENTE'].includes(cargo);
}

// Open novo funcionario modal
function openNovoFuncionarioModal() {
    // Check permission
    if (!canCreateUsers(currentProfile?.cargo)) {
        alert('Você não tem permissão para criar novos usuários.');
        return;
    }

    const modal = document.getElementById('modal-novo-funcionario');
    if (!modal) return;

    // Reset form
    document.getElementById('form-novo-funcionario').reset();

    modal.classList.remove('hidden');
}

// Create new user
async function createNewUser(nome, email, whatsapp, senha, cargo, departamento) {
    try {
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: senha,
            options: {
                data: {
                    nome: nome
                }
            }
        });

        if (authError) throw authError;

        if (!authData.user) {
            throw new Error('Erro ao criar usuário. Verifique se o email já está cadastrado.');
        }

        // Create profile in profiles table (only using existing columns)
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: authData.user.id,
                email: email,
                nome: nome,
                cargo: cargo
            });

        if (profileError) throw profileError;

        // Reload funcionarios
        await loadFuncionarios();
        await loadAllUsers();

        // Close modal
        document.getElementById('modal-novo-funcionario').classList.add('hidden');

        alert(`Usuário "${nome}" criado com sucesso!\n\nEmail: ${email}\nCargo: ${CARGOS[cargo]?.label || cargo}`);

        return true;
    } catch (error) {
        console.error('Error creating user:', error);
        alert('Erro ao criar usuário: ' + error.message);
        return false;
    }
}

// Initialize funcionarios event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Novo Funcionário button
    const btnNovoFunc = document.getElementById('btn-novo-funcionario');
    if (btnNovoFunc) {
        btnNovoFunc.addEventListener('click', openNovoFuncionarioModal);
    }

    // Close modal buttons
    const closeNovoFunc = document.getElementById('close-modal-novo-func');
    if (closeNovoFunc) {
        closeNovoFunc.addEventListener('click', () => {
            document.getElementById('modal-novo-funcionario').classList.add('hidden');
        });
    }

    const cancelarNovoFunc = document.getElementById('btn-cancelar-novo-func');
    if (cancelarNovoFunc) {
        cancelarNovoFunc.addEventListener('click', () => {
            document.getElementById('modal-novo-funcionario').classList.add('hidden');
        });
    }

    // Form submit
    const formNovoFunc = document.getElementById('form-novo-funcionario');
    if (formNovoFunc) {
        formNovoFunc.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nome = document.getElementById('novo-func-nome').value.trim();
            const email = document.getElementById('novo-func-email').value.trim();
            const whatsapp = document.getElementById('novo-func-whatsapp').value.trim();
            const senha = document.getElementById('novo-func-senha').value;
            const cargo = document.getElementById('novo-func-cargo').value;
            const departamento = document.getElementById('novo-func-departamento').value;

            if (!nome || !email || !senha || !cargo) {
                alert('Por favor, preencha todos os campos obrigatórios.');
                return;
            }

            if (senha.length < 6) {
                alert('A senha deve ter pelo menos 6 caracteres.');
                return;
            }

            await createNewUser(nome, email, whatsapp, senha, cargo, departamento);
        });
    }

    // Edit cargo form submit
    const formEditCargo = document.getElementById('form-editar-cargo');
    if (formEditCargo) {
        formEditCargo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('edit-user-id').value;
            const newCargo = document.getElementById('edit-cargo').value;
            await updateUserCargo(userId, newCargo);
        });
    }

    // Close edit cargo modal
    const closeCargoModal = document.getElementById('close-modal-cargo');
    if (closeCargoModal) {
        closeCargoModal.addEventListener('click', () => {
            document.getElementById('modal-editar-cargo').classList.add('hidden');
        });
    }

    const cancelarCargo = document.getElementById('btn-cancelar-cargo');
    if (cancelarCargo) {
        cancelarCargo.addEventListener('click', () => {
            document.getElementById('modal-editar-cargo').classList.add('hidden');
        });
    }
});
