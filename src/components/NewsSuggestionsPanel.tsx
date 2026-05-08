import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dismissSuggestion } from '../lib/news_suggestions';

export interface NewsSuggestion {
  id: string;
  source_title: string;
  source_feed: string;
  source_url?: string;
  fetched_at: string;
  suggested_summary?: string;
  suggested_project?: {
    project_name?: string;
    [key: string]: unknown;
  };
}

interface NewsSuggestionsPanelProps {
  suggestions: NewsSuggestion[];
  onClose: () => void;
  onApply: (s: NewsSuggestion) => void;
  onDismissed: (id: string) => void;
  onRefresh?: () => Promise<void>;
  /** Override the apply button label (e.g. "議題に設定") */
  applyLabel?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

type DateRange = 'all' | '1' | '3' | '7';

export function NewsSuggestionsPanel({ suggestions, onClose, onApply, onDismissed, onRefresh, applyLabel }: NewsSuggestionsPanelProps) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
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

  const handleDismiss = async (id: string) => {
    try {
      await dismissSuggestion(id);
      onDismissed(id);
    } catch (e) {
      console.error('dismiss failed:', e);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 1100, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'flex-end', padding: '60px 16px 0 0',
      }}
    >
      <div
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20, width: 380, maxHeight: '75vh',
          overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong style={{ fontSize: '0.95rem' }}>{t('news_suggestions.panel_title') as string}</strong>
          <div style={{ display: 'flex', gap: 4 }}>
            {onRefresh && (
              <button
                className="btn-icon"
                title={t('news_suggestions.refresh') as string}
                onClick={handleRefresh}
                disabled={refreshing}
                style={{ opacity: refreshing ? 0.5 : 1 }}
              >
                {refreshing ? '…' : '↻'}
              </button>
            )}
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        {suggestions.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <input
              type="search"
              placeholder={t('news_suggestions.search_placeholder') as string}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px', fontSize: '0.82rem',
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'var(--card)', color: 'var(--text)', marginBottom: 6,
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                style={{
                  flex: 1, padding: '4px 6px', fontSize: '0.78rem',
                  border: '1px solid var(--border)', borderRadius: 6,
                  background: 'var(--card)', color: 'var(--text)',
                }}
              >
                <option value="all">{t('news_suggestions.source_all') as string}</option>
                {sourceOptions.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value as DateRange)}
                style={{
                  flex: 1, padding: '4px 6px', fontSize: '0.78rem',
                  border: '1px solid var(--border)', borderRadius: 6,
                  background: 'var(--card)', color: 'var(--text)',
                }}
              >
                <option value="all">{t('news_suggestions.range_all') as string}</option>
                <option value="1">{t('news_suggestions.range_1d') as string}</option>
                <option value="3">{t('news_suggestions.range_3d') as string}</option>
                <option value="7">{t('news_suggestions.range_7d') as string}</option>
              </select>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {t('news_suggestions.count_label', { shown: filtered.length, total: suggestions.length }) as string}
            </div>
          </div>
        )}

        {suggestions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t('news_suggestions.panel_empty') as string}
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t('news_suggestions.no_match') as string}
          </p>
        ) : (
          filtered.map(s => (
            <div
              key={s.id}
              style={{
                border: '1px solid var(--border)', borderRadius: 8,
                padding: 12, marginBottom: 10, fontSize: '0.85rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
                {s.suggested_project?.project_name || s.source_title}
              </div>
              {s.suggested_summary && (
                <p style={{ color: 'var(--text-muted)', margin: '4px 0', fontSize: '0.8rem' }}>
                  {s.suggested_summary}
                </p>
              )}
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 8 }}>
                {t('news_suggestions.source') as string}: {s.source_feed} ·{' '}
                {t('news_suggestions.fetched') as string}: {new Date(s.fetched_at).toLocaleDateString()}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  onClick={() => onApply(s)}
                >
                  {applyLabel || (t('news_suggestions.apply') as string)}
                </button>
                <button
                  className="btn"
                  style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  onClick={() => handleDismiss(s.id)}
                >
                  {t('news_suggestions.dismiss') as string}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
