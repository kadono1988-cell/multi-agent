import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SOURCE_COLORS = {
  '有価証券報告書':         { bg: '#dbeafe', fg: '#1e40af' },
  '統合報告書':             { bg: '#dcfce7', fg: '#166534' },
  '決算説明会資料':         { bg: '#fef9c3', fg: '#854d0e' },
  '中期経営計画資料':       { bg: '#f3e8ff', fg: '#6b21a8' },
  'コーポレートガバナンス報告書': { bg: '#fee2e2', fg: '#991b1b' },
};

function SourceBadge({ type }) {
  const c = SOURCE_COLORS[type] || { bg: '#f1f5f9', fg: '#475569' };
  return (
    <span style={{
      fontSize: '0.72rem', padding: '2px 7px', borderRadius: 4, fontWeight: 600,
      backgroundColor: c.bg, color: c.fg,
    }}>
      {type}
    </span>
  );
}

export function RagLibraryTab({ isDemo }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocs = async () => {
    if (isDemo) { setDocs([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('rag_documents')
      .select('*')
      .order('ingested_at', { ascending: false });
    if (err) setError(err.message);
    else setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const toggleActive = async (doc) => {
    const next = !doc.is_active;
    await supabase.from('rag_documents').update({ is_active: next }).eq('id', doc.id);
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_active: next } : d));
  };

  const totalChunks = docs.reduce((s, d) => s + (d.chunk_count || 0), 0);
  const activeChunks = docs.filter(d => d.is_active).reduce((s, d) => s + (d.chunk_count || 0), 0);

  return (
    <div className="analytics-page">
      <h2 style={{ marginBottom: '0.4rem' }}>📚 鹿島建設 RAGライブラリ</h2>
      <p style={{ color: 'var(--secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
        公式資料から生成されたナレッジチャンク。議論中、関連箇所が自動的にエージェントへ注入されます。
      </p>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {[
          { label: '登録ドキュメント', value: docs.length },
          { label: '有効チャンク', value: activeChunks },
          { label: '総チャンク', value: totalChunks },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ flex: '1', minWidth: 140, padding: '0.9rem 1.2rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Document list */}
      {loading ? (
        <p style={{ color: 'var(--secondary)' }}>読み込み中...</p>
      ) : error ? (
        <p style={{ color: '#ef4444' }}>エラー: {error}</p>
      ) : docs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>
            RAGライブラリが空です
          </p>
          <code style={{ fontSize: '0.8rem', background: 'var(--bg)', padding: '4px 8px', borderRadius: 4 }}>
            node scripts/ingest_kajima_docs.mjs
          </code>
          <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginTop: '0.5rem' }}>
            を実行してドキュメントを取り込んでください
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {docs.map(doc => (
            <div key={doc.id} className="card" style={{
              display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
              opacity: doc.is_active ? 1 : 0.5,
            }}>
              {/* Toggle */}
              <label className="switch" style={{ flexShrink: 0 }}>
                <input type="checkbox" checked={!!doc.is_active} onChange={() => toggleActive(doc)} />
                <span className="slider" />
              </label>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: 3 }}>
                  <SourceBadge type={doc.source_type} />
                  {doc.period && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>{doc.period}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.file_name}
                </div>
              </div>

              {/* Stats */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{doc.chunk_count ?? 0}
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--secondary)', marginLeft: 3 }}>chunks</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--secondary)' }}>
                  {doc.ingested_at ? new Date(doc.ingested_at).toLocaleDateString('ja-JP') : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Re-ingest hint */}
      {docs.length > 0 && (
        <div style={{ marginTop: '1.5rem', fontSize: '0.78rem', color: 'var(--secondary)' }}>
          年次更新:
          <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 3, marginLeft: 6 }}>
            node scripts/ingest_kajima_docs.mjs --update
          </code>
        </div>
      )}
    </div>
  );
}
