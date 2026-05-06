import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

interface ParsedAgent {
  id: string;
  name: string;
  style: string;
  tier: string;
  department: string;
  is_active: string;
  body: string;
  raw: string;
}

function parseMd(raw: string): ParsedAgent {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  const fm: Record<string, string> = {};
  const body = fmMatch ? fmMatch[2].trim() : raw.trim();
  if (fmMatch) {
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const col = line.indexOf(':');
      if (col > 0) fm[line.slice(0, col).trim()] = line.slice(col + 1).trim();
    }
  }
  return {
    id: fm.id || '',
    name: fm.name || '',
    style: fm.style || '',
    tier: fm.tier || '',
    department: fm.department || '',
    is_active: fm.is_active || 'true',
    body,
    raw,
  };
}

// Extract named sections from body (思考パターン / 注視する論点 / 既知バイアス)
function extractSections(body: string): { intro: string; sections: { title: string; content: string }[] } {
  const SECTION_KEYS = ['思考パターン', '注視する論点', '既知バイアス'];
  const parts: { title: string; content: string }[] = [];
  let intro = body;

  for (const key of SECTION_KEYS) {
    const regex = new RegExp(`(${key})[：:](.*?)(?=(?:思考パターン|注視する論点|既知バイアス)[：:]|$)`, 's');
    const m = body.match(regex);
    if (m) {
      if (parts.length === 0) intro = body.slice(0, m.index ?? 0).trim();
      parts.push({ title: key, content: m[2].trim() });
    }
  }

  if (parts.length === 0) intro = body;
  return { intro, sections: parts };
}

const TIER_COLOR: Record<string, { bg: string; fg: string }> = {
  '1': { bg: '#dbeafe', fg: '#1e40af' },
  '2': { bg: '#dcfce7', fg: '#166534' },
  '3': { bg: '#f3e8ff', fg: '#6b21a8' },
  '4': { bg: '#fef9c3', fg: '#854d0e' },
};

interface AgentProfileModalProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

export function AgentProfileModal({ agentId, agentName, onClose }: AgentProfileModalProps) {
  const [agent, setAgent] = useState<ParsedAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/agents/${agentId}.md`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => { setAgent(parseMd(text)); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [agentId]);

  const tierColor = TIER_COLOR[agent?.tier || ''] || { bg: '#f1f5f9', fg: '#475569' };
  const tierLabel = agent?.tier
    ? (agent.is_active === 'false' ? 'EXT' : `T${agent.tier}`)
    : '';

  const { intro, sections } = agent ? extractSections(agent.body) : { intro: '', sections: [] };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', color: 'var(--card-foreground)',
          borderRadius: 10, padding: '1.5rem 1.75rem',
          maxWidth: 560, width: '94vw', maxHeight: '85vh',
          overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {tierLabel && (
                <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: 4, fontWeight: 700, backgroundColor: tierColor.bg, color: tierColor.fg }}>
                  {tierLabel}
                </span>
              )}
              {agent?.department && (
                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>{agent.department}</span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{agentName}</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--secondary)', fontFamily: 'monospace' }}>{agentId}</p>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {loading && <p style={{ color: 'var(--secondary)' }}>読み込み中...</p>}
        {error && <p style={{ color: '#ef4444' }}>エラー: {error}</p>}

        {agent && (
          <>
            {/* Speaking style */}
            {agent.style && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--bg)', borderLeft: '3px solid var(--accent)', borderRadius: '0 6px 6px 0' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--secondary)', fontWeight: 600, marginBottom: 4 }}>発言スタイル</div>
                <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>{agent.style}</p>
              </div>
            )}

            {/* Intro paragraph */}
            {intro && (
              <p style={{ fontSize: '0.87rem', lineHeight: 1.7, marginBottom: '1rem', color: 'var(--text)' }}>{intro}</p>
            )}

            {/* Structured sections */}
            {sections.map(({ title, content }) => (
              <div key={title} style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{title}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.65, color: 'var(--text)' }}>
                  {/* Render / separated items as bullets */}
                  {content.includes('/') ? (
                    <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                      {content.split(/[/／]/).map((item, i) => (
                        <li key={i} style={{ marginBottom: 2 }}>{item.trim()}</li>
                      ))}
                    </ul>
                  ) : content}
                </p>
              </div>
            ))}

            {/* Collapsible raw system prompt */}
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowRaw(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {showRaw ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                システムプロンプト全文 (.md)
              </button>
              {showRaw && (
                <pre style={{
                  marginTop: 8, padding: '0.75rem', background: 'var(--bg)',
                  borderRadius: 6, fontSize: '0.78rem', lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  color: 'var(--secondary)', maxHeight: 300, overflowY: 'auto',
                }}>
                  {agent.raw}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
