-- ============================================
-- RLS (Row Level Security) Implementation Script
-- Sistema Marketing - MSA Demandas
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- ATENÇÃO: Este script irá:
-- 1. Reativar RLS nas tabelas
-- 2. Remover policies antigas
-- 3. Criar novas policies mais seguras

-- ============================================
-- PASSO 1: Remover políticas existentes
-- ============================================

DROP POLICY IF EXISTS "Profiles são visíveis para usuários autenticados" ON profiles;
DROP POLICY IF EXISTS "Usuários podem criar próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Update de perfis" ON profiles;
DROP POLICY IF EXISTS "Leitura de demandas" ON demandas;
DROP POLICY IF EXISTS "Criação de demandas" ON demandas;
DROP POLICY IF EXISTS "Atualização de demandas" ON demandas;
DROP POLICY IF EXISTS "Deleção de demandas" ON demandas;
DROP POLICY IF EXISTS "allow_all_select" ON demandas;
DROP POLICY IF EXISTS "allow_all_insert" ON demandas;
DROP POLICY IF EXISTS "allow_all_update" ON demandas;
DROP POLICY IF EXISTS "allow_all_delete" ON demandas;

-- ============================================
-- PASSO 2: Habilitar RLS
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE demandas ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASSO 3: Função auxiliar para verificar cargo
-- ============================================

CREATE OR REPLACE FUNCTION get_user_cargo(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_cargo TEXT;
BEGIN
    SELECT cargo INTO user_cargo FROM profiles WHERE id = user_id;
    RETURN COALESCE(user_cargo, 'COLABORADOR');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- PASSO 4: Políticas para PROFILES
-- ============================================

-- SELECT: Todos usuários autenticados podem ver perfis (necessário para dropdowns)
CREATE POLICY "profiles_select_authenticated"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- INSERT: Usuários só podem criar seu próprio perfil
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- UPDATE: Próprio perfil OU ADM/DIRETOR podem atualizar qualquer perfil
CREATE POLICY "profiles_update_own_or_admin"
ON profiles FOR UPDATE
TO authenticated
USING (
    auth.uid() = id 
    OR get_user_cargo(auth.uid()) IN ('ADM', 'DIRETOR')
)
WITH CHECK (
    auth.uid() = id 
    OR get_user_cargo(auth.uid()) IN ('ADM', 'DIRETOR')
);

-- DELETE: Apenas ADM pode deletar perfis (exceto o próprio)
CREATE POLICY "profiles_delete_admin_only"
ON profiles FOR DELETE
TO authenticated
USING (
    get_user_cargo(auth.uid()) IN ('ADM', 'DIRETOR')
    AND id != auth.uid()  -- Não pode deletar a si mesmo
);

-- ============================================
-- PASSO 5: Políticas para DEMANDAS
-- ============================================

-- SELECT: 
-- - ADM/DIRETOR/GERENTE: veem todas
-- - Outros: veem demandas onde são criador ou atribuído
CREATE POLICY "demandas_select"
ON demandas FOR SELECT
TO authenticated
USING (
    get_user_cargo(auth.uid()) IN ('ADM', 'DIRETOR', 'GERENTE')
    OR criado_por = auth.uid()
    OR atribuido_para = auth.uid()
);

-- INSERT: 
-- - ADM/DIRETOR/GERENTE: podem criar para qualquer pessoa
-- - Outros: só podem criar demandas para si mesmos
CREATE POLICY "demandas_insert"
ON demandas FOR INSERT
TO authenticated
WITH CHECK (
    -- Gerentes podem criar demandas para qualquer pessoa
    get_user_cargo(auth.uid()) IN ('ADM', 'DIRETOR', 'GERENTE')
    -- Outros precisam ser o criador
    OR criado_por = auth.uid()
);

-- UPDATE:
-- - ADM/DIRETOR/GERENTE: podem atualizar qualquer demanda
-- - Criador: pode atualizar suas demandas
-- - Atribuído: pode atualizar demandas atribuídas a ele (mudar status, etc)
CREATE POLICY "demandas_update"
ON demandas FOR UPDATE
TO authenticated
USING (
    get_user_cargo(auth.uid()) IN ('ADM', 'DIRETOR', 'GERENTE')
    OR criado_por = auth.uid()
    OR atribuido_para = auth.uid()
)
WITH CHECK (
    get_user_cargo(auth.uid()) IN ('ADM', 'DIRETOR', 'GERENTE')
    OR criado_por = auth.uid()
    OR atribuido_para = auth.uid()
);

-- DELETE:
-- - ADM/DIRETOR: podem deletar qualquer demanda
-- - Criador: pode deletar suas próprias demandas
CREATE POLICY "demandas_delete"
ON demandas FOR DELETE
TO authenticated
USING (
    get_user_cargo(auth.uid()) IN ('ADM', 'DIRETOR')
    OR criado_por = auth.uid()
);

-- ============================================
-- PASSO 6: Verificar se as políticas foram criadas
-- ============================================

-- Execute esta query para verificar as policies ativas:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('profiles', 'demandas');

-- ============================================
-- RESUMO DAS PERMISSÕES
-- ============================================
-- 
-- PROFILES:
-- | Ação   | ADM/DIRETOR | GERENTE | COLABORADOR |
-- |--------|-------------|---------|-------------|
-- | SELECT | ✅ Todos    | ✅ Todos| ✅ Todos    |
-- | INSERT | ✅ Próprio  | ✅ Próprio | ✅ Próprio |
-- | UPDATE | ✅ Todos    | ✅ Próprio | ✅ Próprio |
-- | DELETE | ✅ Outros   | ❌      | ❌          |
--
-- DEMANDAS:
-- | Ação   | ADM/DIRETOR | GERENTE | COLABORADOR           |
-- |--------|-------------|---------|----------------------|
-- | SELECT | ✅ Todas    | ✅ Todas| ✅ Próprias/atribuídas|
-- | INSERT | ✅ Todas    | ✅ Todas| ✅ Próprias           |
-- | UPDATE | ✅ Todas    | ✅ Todas| ✅ Próprias/atribuídas|
-- | DELETE | ✅ Todas    | ❌      | ✅ Próprias           |
