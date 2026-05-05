// Maps an absolute round number → which prompt template to use and which
// agents speak. Lets the slider drive any total length (3–7 typical) plus
// an open-ended tail of "follow_up" rounds after the CEO final decision.

export type RoundType = 'initial' | 'feedback' | 'ceo_check' | 'final_views' | 'ceo_final' | 'follow_up';

export interface RoundConfig {
  type: RoundType;
  agents: string[];
}

interface AgentRecord {
  is_active?: boolean;
  [key: string]: unknown;
}

export function getRoundConfig(
  round: number,
  maxRounds: number,
  customAgents: Record<string, AgentRecord> | null | undefined
): RoundConfig {
  const agents = customAgents || {};
  const allActive = Object.keys(agents)
    .filter(k => agents[k]?.is_active);
  const nonCEO = allActive.filter(k => k !== 'CEO');
  const ceo    = allActive.includes('CEO') ? ['CEO'] : [];

  // Post-final follow-up: user has just asked a "what if X?" question.
  // Every active agent (incl. CEO) responds once.
  if (round > maxRounds) {
    return { type: 'follow_up', agents: allActive };
  }

  if (round === 1)              return { type: 'initial',     agents: nonCEO };
  if (round === maxRounds)      return { type: 'ceo_final',   agents: ceo };
  if (round === maxRounds - 1)  return { type: 'final_views', agents: nonCEO };

  // Mid-discussion: CEO check-in every 2 rounds starting at round 3.
  // 5-round flow: R3 = ceo_check, R4 = final_views, R5 = ceo_final.
  // 7-round flow: R3 = ceo_check, R4 = feedback, R5 = ceo_check, R6 = final_views, R7 = ceo_final.
  if (round >= 3 && (round - 3) % 2 === 0) {
    return { type: 'ceo_check', agents: ceo };
  }
  return { type: 'feedback', agents: nonCEO };
}
