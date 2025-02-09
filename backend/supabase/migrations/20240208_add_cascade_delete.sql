DO $$ 
BEGIN
    -- Drop the unique constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'token_distributions_contract_address_entity_key'
        AND table_name = 'token_distributions'
    ) THEN
        ALTER TABLE token_distributions 
        DROP CONSTRAINT token_distributions_contract_address_entity_key;
    END IF;

    -- Check if the foreign key constraint exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'token_distributions_contract_address_fkey'
        AND table_name = 'token_distributions'
    ) THEN
        -- Drop the existing constraint
        ALTER TABLE token_distributions 
        DROP CONSTRAINT token_distributions_contract_address_fkey;
    END IF;

    -- Add the new constraint with CASCADE
    ALTER TABLE token_distributions
    ADD CONSTRAINT token_distributions_contract_address_fkey 
    FOREIGN KEY (contract_address) 
    REFERENCES meme_coins(contract_address) 
    ON DELETE CASCADE;
END $$; 