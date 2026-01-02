-- ============================================
-- SOLUÇÃO SIMPLES: Desativar RLS na tabela demandas
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- Opção 1: DESATIVAR RLS completamente (mais simples)
ALTER TABLE demandas DISABLE ROW LEVEL SECURITY;

-- ============================================
-- OU se preferir manter RLS ativo, use a Opção 2 abaixo:
-- ============================================

-- Opção 2: Remover e recriar políticas permissivas
-- DROP POLICY IF EXISTS "Atualização de demandas" ON demandas;
-- DROP POLICY IF EXISTS "Leitura de demandas" ON demandas;
-- DROP POLICY IF EXISTS "Criação de demandas" ON demandas;
-- DROP POLICY IF EXISTS "Deleção de demandas" ON demandas;

-- CREATE POLICY "allow_all_select" ON demandas FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "allow_all_insert" ON demandas FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "allow_all_update" ON demandas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "allow_all_delete" ON demandas FOR DELETE TO authenticated USING (true);
