-- ============================================
-- SQL Script para configurar o Supabase
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- 1. Criar tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    nome TEXT NOT NULL,
    cargo TEXT NOT NULL DEFAULT 'COLABORADOR' CHECK (cargo IN ('ADM', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'COLABORADOR')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de demandas
CREATE TABLE IF NOT EXISTS demandas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT,
    criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
    atribuido_para UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'NA_FILA' CHECK (status IN ('NA_FILA', 'EM_PRODUCAO', 'PARA_APROVACAO', 'EM_REVISAO', 'APROVADO')),
    data_previsao TIMESTAMP WITH TIME ZONE,
    horas_estimadas DECIMAL(10,2) DEFAULT 8,
    arquivo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE demandas ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para profiles

-- Todos podem ler perfis (necessário para listar usuários)
CREATE POLICY "Profiles são visíveis para usuários autenticados" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- Usuários podem inserir seu próprio perfil
CREATE POLICY "Usuários podem criar próprio perfil" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Usuários podem atualizar seu próprio perfil, ADM e DIRETOR podem atualizar qualquer perfil
CREATE POLICY "Update de perfis" 
ON profiles FOR UPDATE 
TO authenticated 
USING (
    auth.uid() = id 
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND cargo IN ('ADM', 'DIRETOR')
    )
);

-- 5. Políticas para demandas

-- Leitura: Usuários comuns veem suas demandas, ADM/DIRETOR/GERENTE veem todas
CREATE POLICY "Leitura de demandas" 
ON demandas FOR SELECT 
TO authenticated 
USING (
    criado_por = auth.uid() 
    OR atribuido_para = auth.uid()
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND cargo IN ('ADM', 'DIRETOR', 'GERENTE')
    )
);

-- Inserção: Qualquer usuário autenticado pode criar demandas
CREATE POLICY "Criação de demandas" 
ON demandas FOR INSERT 
TO authenticated 
WITH CHECK (criado_por = auth.uid());

-- Atualização: Usuário atribuído, criador ou gerentes podem atualizar
CREATE POLICY "Atualização de demandas" 
ON demandas FOR UPDATE 
TO authenticated 
USING (
    criado_por = auth.uid() 
    OR atribuido_para = auth.uid()
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND cargo IN ('ADM', 'DIRETOR', 'GERENTE')
    )
);

-- Deleção: Apenas criador ou ADM/DIRETOR podem deletar
CREATE POLICY "Deleção de demandas" 
ON demandas FOR DELETE 
TO authenticated 
USING (
    criado_por = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND cargo IN ('ADM', 'DIRETOR')
    )
);

-- 6. Criar trigger para atualizar updated_at automaticamente

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_demandas_updated_at
    BEFORE UPDATE ON demandas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Trigger para criar perfil automaticamente quando usuário se registra

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nome, cargo)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
        'COLABORADOR'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- CRIAÇÃO DO USUÁRIO ADMINISTRADOR
-- ============================================
-- IMPORTANTE: Esta parte deve ser executada APÓS criar o usuário via Supabase Auth
-- Primeiro, crie o usuário no painel Authentication > Users
-- Depois execute o comando abaixo para definir como ADM

-- UPDATE profiles 
-- SET cargo = 'ADM', nome = 'Breno' 
-- WHERE email = 'breno.com.br.br@gmail.com';
