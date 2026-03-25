import { supabase } from 'src/supabase';

export async function resolveUrlToken(token: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('url_tokens')
    .select('ids')
    .eq('token', token)
    .single();
  if (error || !data) return [];
  return (data as { ids: string[] }).ids;
}
