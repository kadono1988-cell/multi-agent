import { describe, it, expect } from 'vitest';
import { extractConfidence } from './gemini';

describe('extractConfidence — Japanese variants', () => {
  it('parses [確信度: 高]', () => {
    const { confidence, cleaned } = extractConfidence('決定: 採用\n[確信度: 高]');
    expect(confidence).toBe('high');
    expect(cleaned).toBe('決定: 採用');
  });
  it('parses [確信度: 中]', () => {
    expect(extractConfidence('foo\n[確信度: 中]').confidence).toBe('medium');
  });
  it('parses [確信度: 低]', () => {
    expect(extractConfidence('foo\n[確信度: 低]').confidence).toBe('low');
  });
  it('parses without brackets', () => {
    expect(extractConfidence('foo\n確信度: 高').confidence).toBe('high');
  });
  it('parses full-width colon', () => {
    expect(extractConfidence('foo\n確信度：低').confidence).toBe('low');
  });
});

describe('extractConfidence — English variants', () => {
  it('parses [confidence: high]', () => {
    expect(extractConfidence('foo\n[confidence: high]').confidence).toBe('high');
  });
  it('case-insensitive', () => {
    expect(extractConfidence('foo\n[Confidence: HIGH]').confidence).toBe('high');
  });
});

describe('extractConfidence — falsy / no match', () => {
  it('returns null + original on no tag', () => {
    const { confidence, cleaned } = extractConfidence('plain text only');
    expect(confidence).toBe(null);
    expect(cleaned).toBe('plain text only');
  });
  it('handles empty input', () => {
    expect(extractConfidence('').confidence).toBe(null);
    expect(extractConfidence(null).confidence).toBe(null);
    expect(extractConfidence(undefined).confidence).toBe(null);
  });
  it('only matches at end of content', () => {
    // a confidence tag in the middle is intentionally NOT cleaned out
    const result = extractConfidence('[確信度: 高]\n中段に書かれている場合は無視');
    expect(result.confidence).toBe(null);
  });
});
