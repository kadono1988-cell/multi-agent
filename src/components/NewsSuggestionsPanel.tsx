import { useTranslation } from 'react-i18next';
import { dismissSuggestion } from '../lib/news_suggestions';

export interface NewsSuggestion {
  id: string;
  source_title: string;
  source_feed: string;
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
}

export function NewsSuggestionsPanel({ suggestions, onClose, onApply, onDismissed }: NewsSuggestionsPanelProps) {
  const { t } = useTranslation();

  const handleDismiss = async (id: string) => {
    try {
      await dismissSuggestion(id);
      onDismissed(id);
    } catch (e) {
      console.error('dismiss failed:', e);
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
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {suggestions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t('news_suggestions.panel_empty') as string}
          </p>
        ) : (
          suggestions.map(s => (
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
                  {t('news_suggestions.apply') as string}
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
