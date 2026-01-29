-- ============================================
-- Migração: Adicionar campos de Observações e Checklist
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- Adicionar coluna de observações (texto livre para notas)
ALTER TABLE demandas ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Adicionar coluna de checklist (JSON array para armazenar itens de checkbox)
-- Formato esperado: [{"id": "uuid", "texto": "Item", "concluido": false}, ...]
ALTER TABLE demandas ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;

-- Índice para busca em observações (opcional, para performance)
CREATE INDEX IF NOT EXISTS idx_demandas_observacoes ON demandas USING gin(to_tsvector('portuguese', COALESCE(observacoes, '')));
