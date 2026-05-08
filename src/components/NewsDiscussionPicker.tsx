import { useMemo, useState } from 'react';
import type { NewsSuggestion } from './NewsSuggestionsPanel';

const DAY_MS = 24 * 60 * 60 * 1000;
type DateRange = 'all' | '1' | '3' | '7';

interface Props {
  article: NewsSuggestion | null;
  suggestions: NewsSuggestion[];
  onPick: (s: NewsSuggestion) => void;
  onClear: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export function NewsDiscussionPicker({ article, suggestions, onPick, onClear, t }: Props) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    suggestions.forEach(s => { if (s.source_feed) set.add(s.source_feed); });
    return Array.from(set).sort();
  }, [suggestions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = dateRange === 'all' ? null : Date.now() - parseInt(dateRange, 10) * DAY_MS;
    return suggestions.filter(s => {
      if (sourceFilter !== 'all' && s.source_feed !== sourceFilter) return false;
      if (cutoff !== null) {
        const fetched = new Date(s.fetched_at).getTime();
        if (!Number.isFinite(fetched) || fetched < cutoff) return false;
      }
      if (!q) return true;
      const haystack = [
        s.source_title || '',
        s.suggested_project?.project_name || '',
        s.suggested_summary || '',
        s.source_feed || '',
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [suggestions, search, sourceFilter, dateRange]);

  if (article) {
    return (
      <div style={{
        padding: 14, marginBottom: 16,
        border: '1px solid var(--border)', borderRadius: 8,
        background: 'var(--soft-bg, rgba(99,102,241,0.06))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--secondary)', marginBottom: 4 }}>
              {t('news_discussion.selected_label')}
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', lineHeight: 1.35, marginBottom: 4 }}>
              {article.suggested_project?.project_name || article.source_title}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              {article.source_feed} · {new Date(article.fetched_at).toLocaleDateString()}
              {article.source_url && (
                <> · <a href={article.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{t('news_discussion.open_source')}</a></>
              )}
            </div>
            {article.suggested_summary && (
              <p style={{ fontSize: '0.82rem', color: 'var(--secondary)', margin: 0, lineHeight: 1.5 }}>
                {article.suggested_summary}
              </p>
            )}
          </div>
          <button className="btn-icon" onClick={onClear} title={t('news_discussion.change')} style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
            ↻ {t('news_discussion.change')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: 14, marginBottom: 16,
      border: '1px dashed var(--border)', borderRadius: 8,
      background: 'var(--soft-bg, rgba(99,102,241,0.04))',
    }}>
      <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 4 }}>
        📰 {t('news_discussion.picker_title')}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginTop: 0, marginBottom: 10 }}>
        {t('news_discussion.picker_hint')}
      </p>

      {suggestions.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {t('news_discussion.empty_hint')}
        </p>
      ) : (
        <>
          <input
            type="search"
            placeholder={t('news_suggestions.search_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px', fontSize: '0.82rem',
              border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--card)', color: 'var(--text)', marginBottom: 6,
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              style={{ flex: 1, padding: '4px 6px', fontSize: '0.78rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', color: 'var(--text)' }}>
              <option value="all">{t('news_suggestions.source_all')}</option>
              {sourceOptions.map(src => <option key={src} value={src}>{src}</option>)}
            </select>
            <select value={dateRange} onChange={e => setDateRange(e.target.value as DateRange)}
              style={{ flex: 1, padding: '4px 6px', fontSize: '0.78rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', color: 'var(--text)' }}>
              <option value="all">{t('news_suggestions.range_all')}</option>
              <option value="1">{t('news_suggestions.range_1d')}</option>
              <option value="3">{t('news_suggestions.range_3d')}</option>
              <option value="7">{t('news_suggestions.range_7d')}</option>
            </select>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {t('news_suggestions.count_label', { shown: filtered.length, total: suggestions.length })}
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('news_suggestions.no_match')}</p>
            ) : filtered.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s)}
                style={{
                  textAlign: 'left', padding: 10, border: '1px solid var(--border)',
                  borderRadius: 6, background: 'var(--card)', cursor: 'pointer',
                  fontSize: '0.82rem', lineHeight: 1.45, color: 'var(--text)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 3 }}>
                  {s.suggested_project?.project_name || s.source_title}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  {s.source_feed} · {new Date(s.fetched_at).toLocaleDateString()}
                </div>
                {s.suggested_summary && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>
                    {s.suggested_summary.length > 140 ? s.suggested_summary.slice(0, 140) + '…' : s.suggested_summary}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
