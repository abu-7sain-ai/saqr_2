-- Registering Aviator Prince 01
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM profiles LIMIT 1;

    INSERT INTO workers (user_id, number, name, type, market_type, owner, status, strategy_name, starting_capital, current_capital)
    VALUES (target_user_id, 2, 'طيار الأمير 01', 'paper', 'volatile', 'prince', 'running', 'aviator_volatile', 3000, 3000)
    ON CONFLICT (user_id, name) DO UPDATE 
    SET status = 'running', strategy_name = 'aviator_volatile';
END $$;
