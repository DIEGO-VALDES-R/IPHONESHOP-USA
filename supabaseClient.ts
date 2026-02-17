import { createClient } from '@supabase/supabase-js';

// NOTE: In a real environment, these would come from import.meta.env or process.env
// For this demo generator, we will allow the user to input them or use placeholders.

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'public-anon-key';

// We export a function to initialize because we might want to let the user input keys in the UI
// if the environment variables are not set in this sandbox.
export const getSupabase = () => {
    return createClient(supabaseUrl, supabaseKey);
};

export const supabase = createClient(supabaseUrl, supabaseKey);
