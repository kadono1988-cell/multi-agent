import React, { useState } from 'react';
import { generateDebriefing, AgentDebriefing, Message, Project, Session } from '../lib/gemini';
import type { AgentsMap } from '../lib/agents_manager';

interface DebriefingPanelProps {
  messages: Message[];
  participants: string[];
  project: Project;
  session: Session;
  agents: AgentsMap;
  locale?: string;
}

const STANCE_COLORS = ['#dbeafe', '#dcfce7', '#f3e8ff', '#fef9c3', '#fee2e2', '#e0f2fe', '#fce7f3'];

export function DebriefingPanel({ messages, participants, project, session, agents, locale = 'ja' }: DebriefingPanelProps) {
  const [result, setResult] = useState<Record<string, AgentDebriefing> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateDebriefing({ messages, participants, project, session, agents, locale });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem' }}>
          {locale === 'en' ? 'Post-session Debriefing' : 'セッション デブリーフィング'}
        </h3>
        {!result && (
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '4px 12px' }}
            onClick={run}
            disabled={loading}
          >
            {loading ? '生成中...' : locale === 'en' ? 'Generate' : '生成'}
          </button>
        )}
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
        {locale === 'en'
          ? 'Why did each agent take that stance? Analysis from their domain/KPI perspective.'
          : '各エージェントがなぜその立場をとったか、担当領域・KPIの観点から分析します。'}
      </p>

      {error && <p style={{ color: '#ef4444', fontSize: '0.83rem' }}>エラー: {error}</p>}

      {loading && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--secondary)', fontSize: '0.85rem' }}>
          Gemini が分析中...
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {participants
            .filter(id => result[id])
            .map((id, idx) => {
              const d = result[id];
              const accentBg = STANCE_COLORS[idx % STANCE_COLORS.length];
              return (
                <div key={id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {/* Agent header */}
                  <div style={{ background: accentBg, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '0.88rem' }}>{d.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: '#475569', fontFamily: 'monospace' }}>{id}</span>
                  </div>

                  <div style={{ padding: '10px 12px' }}>
                    {/* Stance */}
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>
                      {locale === 'en' ? 'Stance: ' : '立場: '}
                      <span style={{ fontWeight: 400 }}>{d.stance}</span>
                    </div>

                    {/* Key concerns */}
                    {d.key_concerns.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--secondary)', marginBottom: 3 }}>
                          {locale === 'en' ? 'Key concerns' : '重視した論点'}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                          {d.key_concerns.map((c, i) => (
                            <li key={i} style={{ fontSize: '0.82rem', lineHeight: 1.55 }}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Why */}
                    <div style={{ fontSize: '0.82rem', color: 'var(--secondary)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                      {d.why}
                    </div>
                  </div>
                </div>
              );
            })}

          <button
            className="btn"
            style={{ fontSize: '0.75rem', marginTop: 4 }}
            onClick={() => { setResult(null); setError(null); }}
          >
            {locale === 'en' ? 'Reset' : 'リセット'}
          </button>
        </div>
      )}
    </div>
  );
}
