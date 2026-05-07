import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plcdgqwrwwitkmbsghkh.supabase.co';
const supabaseAnonKey = 'sb_publishable_vGe6NG1vU4HLHjhPpm7LYQ_G-TXWMXf';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);