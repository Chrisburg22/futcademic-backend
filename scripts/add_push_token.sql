-- Agregar columna push_token a tabla users para notificaciones push
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS push_token TEXT;
