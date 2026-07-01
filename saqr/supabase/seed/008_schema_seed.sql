-- Seed: 008_comprehensive_schema_alignment_seed.sql

-- Seed Plans
INSERT INTO public.plans (name, metadata) VALUES
('Free', '{"max_workers": 1, "features": ["basic_kitchen"]}'::jsonb),
('P1', '{"max_workers": 3, "features": ["basic_kitchen", "telegram_alerts"]}'::jsonb),
('P2', '{"max_workers": 10, "features": ["advanced_kitchen", "telegram_alerts", "priority_support"]}'::jsonb),
('P3', '{"max_workers": -1, "features": ["full_access", "telegram_alerts", "priority_support", "custom_bots"]}'::jsonb)
ON CONFLICT (name) DO UPDATE SET metadata = EXCLUDED.metadata;

-- Seed System Settings
INSERT INTO public.system_settings (key, value, description) VALUES
('maintenance_mode', 'false'::jsonb, 'Toggle global maintenance mode'),
('min_capital_required', '100'::jsonb, 'Minimum capital required to start a worker'),
('platform_version', '"1.0.0"'::jsonb, 'Current version of the Saqr platform')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Activity Log Entry
INSERT INTO public.activity_logs (action, details, severity)
VALUES ('Schema alignment complete', '{"version": "1.0.0", "migrations_applied": ["008"]}'::jsonb, 'info');
