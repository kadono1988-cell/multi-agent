import { supabase } from './supabase';

export async function fetchPendingSuggestions() {
  const { data, error } = await supabase
    .from('news_suggestions')
    .select('*')
    .eq('status', 'pending')
    .order('fetched_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export async function dismissSuggestion(id: string, reason = ''): Promise<void> {
  const { error } = await supabase
    .from('news_suggestions')
    .update({ status: 'dismissed', dismissed_at: new Date().toISOString(), dismissed_reason: reason })
    .eq('id', id);
  if (error) throw error;
}

export async function markSuggestionApplied(id: string, projectId: string): Promise<void> {
  const { error } = await supabase
    .from('news_suggestions')
    .update({ status: 'applied', applied_to_project_id: projectId, applied_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
