import React, { useMemo } from 'react';
import type { Message } from '../lib/gemini';
import type { AgentsMap } from '../lib/agents_manager';

// Keyword-based sentiment scoring (no extra API call)
const POSITIVE_KW = ['賛成', '同意', '支持', '前向き', '評価', '適切', '妥当', '推進', '賛同', '歓迎', '可能性', 'agree', 'support', 'positive'];
const NEGATIVE_KW = ['懸念', 'リスク', '問題', '困難', '反対', '課題', '危険', '不安', '厳しい', '疑問', '懸案', '慎重', '難しい', '再考', '反発', 'concern', 'risk', 'issue'];

function sentimentScore(text: string): number {
  const lower = text.toLowerCase();
  let pos = 0, neg = 0;
  for (const kw of POSITIVE_KW) if (lower.includes(kw)) pos++;
  for (const kw of NEGATIVE_KW) if (lower.includes(kw)) neg++;
  const total = pos + neg;
  if (total === 0) return 0;
  return (pos - neg) / total;
}

function sentimentCell(score: number): { bg: string; label: string; fg: string } {
  if (score > 0.25)  return { bg: '#d1fae5', fg: '#065f46', label: '賛' };
  if (score < -0.25) return { bg: '#fee2e2', fg: '#991b1b', label: '懸' };
  return { bg: '#f1f5f9', fg: '#475569', label: '中' };
}

interface DiscussionHeatmapProps {
  messages: Message[];
  participants: string[];
  agents: AgentsMap;
  maxRounds?: number;
}

export function DiscussionHeatmap({ messages, participants, agents, maxRounds = 5 }: DiscussionHeatmapProps) {
  const rounds = useMemo(() => {
    const used = [...new Set(messages.map(m => m.round_number).filter(Boolean))].sort((a, b) => (a ?? 0) - (b ?? 0));
    return used.length > 0 ? used : Array.from({ length: maxRounds }, (_, i) => i + 1);
  }, [messages, maxRounds]);

  // Aggregate messages by (round, agent)
  const grid = useMemo(() => {
    const map: Record<string, Record<number, string>> = {};
    for (const m of messages) {
      if (!m.round_number) continue;
      if (!map[m.agent_role]) map[m.agent_role] = {};
      map[m.agent_role][m.round_number] = (map[m.agent_role][m.round_number] || '') + ' ' + m.content;
    }
    return map;
  }, [messages]);

  if (participants.length === 0 || messages.length === 0) return null;

  const colWidth = Math.max(60, Math.min(120, Math.floor(560 / participants.length)));

  return (
    <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: 300 }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--secondary)', borderBottom: '1px solid var(--border)', minWidth: 48 }}>R</th>
            {participants.map(id => (
              <th key={id} style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--secondary)', borderBottom: '1px solid var(--border)', width: colWidth, maxWidth: colWidth }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: colWidth - 12 }} title={agents[id]?.name || id}>
                  {(agents[id]?.name || id).replace(/担当|部長|所長|部門/, '').slice(0, 8)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map(r => (
            <tr key={r}>
              <td style={{ padding: '4px 8px', fontWeight: 600, color: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}>R{r}</td>
              {participants.map(id => {
                const text = grid[id]?.[r as number];
                if (!text) {
                  return (
                    <td key={id} style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '1px solid var(--border)', background: 'transparent' }}>
                      <span style={{ color: 'var(--border)', fontSize: '0.7rem' }}>—</span>
                    </td>
                  );
                }
                const score = sentimentScore(text);
                const cell = sentimentCell(score);
                return (
                  <td key={id} style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}
                    title={text.trim().slice(0, 120)}>
                    <span style={{
                      display: 'inline-block', borderRadius: 4,
                      padding: '2px 7px', fontWeight: 700,
                      background: cell.bg, color: cell.fg, fontSize: '0.72rem',
                    }}>
                      {cell.label}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: '0.72rem', color: 'var(--secondary)' }}>
        <span><span style={{ background: '#d1fae5', color: '#065f46', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>賛</span> 支持傾向</span>
        <span><span style={{ background: '#f1f5f9', color: '#475569', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>中</span> 中立</span>
        <span><span style={{ background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>懸</span> 懸念傾向</span>
        <span style={{ marginLeft: 'auto' }}>—: 未発言</span>
      </div>
    </div>
  );
}
