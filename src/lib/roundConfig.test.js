import { describe, it, expect } from 'vitest';
import { getRoundConfig } from './roundConfig';

const agents = {
  PM:  { is_active: true },
  CFO: { is_active: true },
  COO: { is_active: true },
  CEO: { is_active: true },
};

describe('getRoundConfig — 5 round flow (default)', () => {
  it('round 1 is initial with non-CEO agents', () => {
    const c = getRoundConfig(1, 5, agents);
    expect(c.type).toBe('initial');
    expect(c.agents).toEqual(['PM', 'CFO', 'COO']);
  });
  it('round 2 is feedback', () => {
    expect(getRoundConfig(2, 5, agents).type).toBe('feedback');
  });
  it('round 3 is ceo_check (CEO only)', () => {
    const c = getRoundConfig(3, 5, agents);
    expect(c.type).toBe('ceo_check');
    expect(c.agents).toEqual(['CEO']);
  });
  it('round 4 is final_views (non-CEO)', () => {
    const c = getRoundConfig(4, 5, agents);
    expect(c.type).toBe('final_views');
    expect(c.agents).toEqual(['PM', 'CFO', 'COO']);
  });
  it('round 5 is ceo_final', () => {
    const c = getRoundConfig(5, 5, agents);
    expect(c.type).toBe('ceo_final');
    expect(c.agents).toEqual(['CEO']);
  });
  it('post-final rounds are follow_up with everyone', () => {
    const c = getRoundConfig(6, 5, agents);
    expect(c.type).toBe('follow_up');
    expect(c.agents).toEqual(['PM', 'CFO', 'COO', 'CEO']);
  });
});

describe('getRoundConfig — 3 round flow (short)', () => {
  it('round 1 = initial', () => expect(getRoundConfig(1, 3, agents).type).toBe('initial'));
  it('round 2 = final_views', () => expect(getRoundConfig(2, 3, agents).type).toBe('final_views'));
  it('round 3 = ceo_final', () => expect(getRoundConfig(3, 3, agents).type).toBe('ceo_final'));
});

describe('getRoundConfig — 7 round flow (deep)', () => {
  it('R1 initial', () => expect(getRoundConfig(1, 7, agents).type).toBe('initial'));
  it('R2 feedback', () => expect(getRoundConfig(2, 7, agents).type).toBe('feedback'));
  it('R3 ceo_check', () => expect(getRoundConfig(3, 7, agents).type).toBe('ceo_check'));
  it('R4 feedback', () => expect(getRoundConfig(4, 7, agents).type).toBe('feedback'));
  it('R5 ceo_check', () => expect(getRoundConfig(5, 7, agents).type).toBe('ceo_check'));
  it('R6 final_views', () => expect(getRoundConfig(6, 7, agents).type).toBe('final_views'));
  it('R7 ceo_final', () => expect(getRoundConfig(7, 7, agents).type).toBe('ceo_final'));
});

describe('getRoundConfig — inactive agents are filtered', () => {
  it('skips agents with is_active=false', () => {
    const half = { PM: { is_active: true }, CFO: { is_active: false }, CEO: { is_active: true } };
    expect(getRoundConfig(1, 5, half).agents).toEqual(['PM']);
  });
  it('omits CEO from ceo_check when not active', () => {
    const noCeo = { PM: { is_active: true }, CFO: { is_active: true } };
    expect(getRoundConfig(3, 5, noCeo).agents).toEqual([]);
  });
});

describe('getRoundConfig — empty input', () => {
  it('returns empty arrays without crashing', () => {
    const c = getRoundConfig(1, 5, {});
    expect(c.agents).toEqual([]);
  });
  it('handles null customAgents', () => {
    expect(() => getRoundConfig(1, 5, null)).not.toThrow();
  });
});
