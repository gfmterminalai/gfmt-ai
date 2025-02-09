import { createClient } from '@supabase/supabase-js';
import { config } from '../core/config';

async function main() {
  try {
    console.log('Testing Supabase connection...');
    
    const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
    
    // Try a simple query
    const { data, error } = await supabase
      .from('meme_coins')
      .select('contract_address')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    console.log('Successfully connected to Supabase!');
    console.log('Test query result:', data);
    
  } catch (error) {
    console.error('Connection test failed:', error);
    process.exit(1);
  }
}

main(); 