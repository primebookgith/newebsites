import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plcdgqwrwwitkmbsghkh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsY2RncXdyd3dpdGttYnNnaGtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzUzMTQ2MSwiZXhwIjoyMDkzMTA3NDYxfQ.CKhpQfZMGpvNalEfrdrj-erZFYV-iOZGBLiAUAVMOTw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);