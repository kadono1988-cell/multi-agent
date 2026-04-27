import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import './index.css'
import { supabase } from './lib/supabase'
import { generateAgentResponseStream, generateAgentResponse, synthesizeDecisionMemo, suggestMeetingDesign, summarizeProgress, embedText, fetchSimilarDecisions, suggestTopicFromNews, generateBriefing, extractConfidence, AGENT_ROLES } from './lib/gemini'
import { getRoundConfig } from './lib/roundConfig'
import { loadAgents, saveAgentToStorage, deleteAgentFromStorage } from './lib/agents_manager'
import { MOCK_PROJECTS, MOCK_MESSAGES } from './lib/mockData'
import {
  Layout, MessageSquare, PlusCircle, BookOpen,
  Users, Save, Trash2, Download, History, Sun, Moon, Upload, BarChart3
} from 'lucide-react'
import { LanguageToggle } from './components/LanguageToggle'
import { AuthBar } from './components/AuthBar'

const CUSTOM_THEMES_KEY = 'mads_custom_themes';

const EMPTY_PROJECT_FORM = {
  name: '', summary: '', strategic_importance: 'medium',
  client: '', duration: '', size: '', budget: '', building_usage: '', location: '', remarks: ''
};

const SESSION_STORAGE_KEY = 'mads_session_v2';

const CONFIDENCE_COLORS = {
  high:   { bg: '#d1fae5', fg: '#047857' },
  medium: { bg: '#fef3c7', fg: '#b45309' },
  low:    { bg: '#fee2e2', fg: '#b91c1c' },
};

function ConfidenceBadge({ level, t }) {
  const palette = CONFIDENCE_COLORS[level];
  if (!palette) return null;
  return (
    <span style={{
      fontSize: '0.7rem',
      padding: '2px 6px',
      borderRadius: 3,
      backgroundColor: palette.bg,
      color: palette.fg,
      fontWeight: 600,
    }}>
      {t(`confidence.${level}`)}
    </span>
  );
}

function App() {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'ja-JP'

  const DEFAULT_THEMES = [
    { id: 'delay',         label: t('themes.delay_label'),         desc: t('themes.delay_desc') },
    { id: 'go_no_go',      label: t('themes.go_no_go_label'),      desc: t('themes.go_no_go_desc') },
    { id: 'design_change', label: t('themes.design_change_label'), desc: t('themes.design_change_desc') },
    { id: 'custom',        label: t('themes.custom_label'),        desc: t('themes.custom_desc') },
  ]

  // ── Core state ──────────────────────────────────────────────────────────────
  const [projects, setProjects]             = useState([])
  const [activeProject, setActiveProject]   = useState(null)
  const [session, setSession]               = useState(null)
  const [messages, setMessages]             = useState([])
  const [loading, setLoading]               = useState(false)
  const [currentRound, setCurrentRound]     = useState(0)
  const [userInput, setUserInput]           = useState('')

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState('dashboard')
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [projectForm, setProjectForm]       = useState(EMPTY_PROJECT_FORM)
  const [setupTheme, setSetupTheme]         = useState(null)
  const [setupContext, setSetupContext]     = useState('')
  const [setupConstraints, setSetupConstraints] = useState('')
  const [setupGoal, setSetupGoal]           = useState('')
  const [setupFocusPoints, setSetupFocusPoints] = useState('')
  const [setupPrfaq, setSetupPrfaq]         = useState('')
  const [isThinking, setIsThinking]         = useState(false)
  const [thinkingAgent, setThinkingAgent]   = useState(null)

  // ── Streaming state ─────────────────────────────────────────────────────────
  const [streamingContent, setStreamingContent] = useState(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [maxRounds, setMaxRounds] = useState(5)
  const [groundingEnabled, setGroundingEnabled] = useState(false)
  const [followUpInput, setFollowUpInput] = useState('')
  const [gateOpen, setGateOpen] = useState(null) // 'r1' | 'final' | null
  const [meetingDesign, setMeetingDesign] = useState(null)
  const [isDesigning, setIsDesigning] = useState(false)
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('mads_theme') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  })
  const [participants, setParticipants] = useState([]) // agent_ids for this session
  const [personaFiles, setPersonaFiles] = useState({}) // { [agentId]: extractedText }
  const [similarDecisions, setSimilarDecisions] = useState([])
  const [newsModalOpen, setNewsModalOpen] = useState(false)
  const [newsText, setNewsText] = useState('')
  const [newsSuggestion, setNewsSuggestion] = useState(null)
  const [isAnalyzingNews, setIsAnalyzingNews] = useState(false)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [briefingMode, setBriefingMode] = useState(false)
  const [briefingDoc, setBriefingDoc] = useState(null)
  const [isBriefingLoading, setIsBriefingLoading] = useState(false)
  const [liveSummary, setLiveSummary] = useState(null)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [projectStatusMap, setProjectStatusMap] = useState({})
  const timelineEndRef = useRef(null)

  // ── Agents & Knowledge ──────────────────────────────────────────────────────
  const [customAgents, setCustomAgents]     = useState({})
  const [referenceCases, setReferenceCases] = useState([])
  const [editingAgent, setEditingAgent]     = useState(null)
  const [editingCase, setEditingCase]       = useState(null)
  const [caseForm, setCaseForm]             = useState({ title: '', summary: '', outcome: '', project_type: '' })

  // ── Session history ─────────────────────────────────────────────────────────
  const [sessionHistory, setSessionHistory] = useState([])

  // ── Custom themes ────────────────────────────────────────────────────────────
  const [customThemes, setCustomThemes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY) || '[]'); } catch { return []; }
  })
  const [showThemeEditor, setShowThemeEditor] = useState(false)
  const [themeForm, setThemeForm] = useState({ label: '', desc: '' })

  const THEMES = [...DEFAULT_THEMES, ...customThemes]

  const saveCustomTheme = () => {
    if (!themeForm.label.trim()) return;
    const newTheme = { id: 'custom_' + Date.now(), label: themeForm.label.trim(), desc: themeForm.desc.trim() };
    const updated = [...customThemes, newTheme];
    setCustomThemes(updated);
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(updated));
    setThemeForm({ label: '', desc: '' });
    setShowThemeEditor(false);
  };

  const deleteCustomTheme = (id) => {
    const updated = customThemes.filter(th => th.id !== id);
    setCustomThemes(updated);
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(updated));
  };

  // ── Project search / filter ──────────────────────────────────────────────────
  const [projectSearch, setProjectSearch]     = useState('')
  const [projectFilter, setProjectFilter]     = useState('all')

  const filteredProjects = projects.filter(p => {
    const matchSearch = !projectSearch ||
      p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
      (p.client || '').toLowerCase().includes(projectSearch.toLowerCase());
    const matchFilter = projectFilter === 'all' || p.strategic_importance === projectFilter;
    return matchSearch && matchFilter;
  });

  const isDemo = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_GEMINI_API_KEY;

  // ── Theme ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mads_theme', theme);
  }, [theme]);

  // ── Auth: track current user so writes can stamp owner_id ────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setCurrentUser(session?.user || null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // ── Initialization ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isDemo) {
      setProjects(MOCK_PROJECTS);
    } else {
      fetchProjects();
      fetchReferenceCases();
    }
    loadExpertAgents();
  }, [isDemo]);

  useEffect(() => {
    if (projects.length === 0 || session || isDemo) return;
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!saved) return;
      const state = JSON.parse(saved);
      const project = projects.find(p => p.id === state.activeProjectId);
      if (project && state.session && state.messages?.length > 0) {
        setActiveProject(project);
        setSession(state.session);
        setMessages(state.messages);
        setCurrentRound(state.currentRound || 1);
        if (state.maxRounds) setMaxRounds(state.maxRounds);
        if (typeof state.groundingEnabled === 'boolean') setGroundingEnabled(state.groundingEnabled);
        if (state.setupContext) setSetupContext(state.setupContext);
        if (state.setupConstraints) setSetupConstraints(state.setupConstraints);
        if (state.setupGoal) setSetupGoal(state.setupGoal);
        if (state.setupFocusPoints) setSetupFocusPoints(state.setupFocusPoints);
        if (state.setupPrfaq) setSetupPrfaq(state.setupPrfaq);
      }
    } catch { /* ignore corrupt storage */ }
  }, [projects]);

  useEffect(() => {
    if (!isDemo && session && messages.length > 0 && activeProject && !session.readonly) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
          session, messages, currentRound, activeProjectId: activeProject.id,
          maxRounds, groundingEnabled,
          setupContext, setupConstraints, setupGoal, setupFocusPoints, setupPrfaq,
        }));
      } catch { /* storage quota exceeded */ }
    }
  }, [session, messages.length, currentRound]);

  useEffect(() => {
    if (activeProject && !isDemo) {
      loadSessionHistory(activeProject.id);
      fetchSimilarDecisions({ project: activeProject, k: 3 }).then(setSimilarDecisions);
    } else {
      setSessionHistory([]);
      setSimilarDecisions([]);
    }
  }, [activeProject?.id, isDemo]);

  // Auto-scroll the page as new messages stream in so the latest reply is always visible.
  useEffect(() => {
    if (!session || !timelineEndRef.current) return;
    timelineEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streamingContent?.content?.length, isThinking, session?.id]);

  // ── Data fetchers ────────────────────────────────────────────────────────────
  const loadExpertAgents = async () => {
    const agents = await loadAgents();
    setCustomAgents(agents);
    // Default participants: every agent flagged is_active and not external
    setParticipants(prev => prev.length > 0 ? prev :
      Object.keys(agents).filter(k => agents[k]?.is_active && agents[k]?.agent_type !== 'external')
    );
  };

  const fetchReferenceCases = async () => {
    const { data } = await supabase.from('reference_cases').select('*').order('created_at', { ascending: false });
    if (data) setReferenceCases(data);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (data) {
      setProjects(data);
      // Fetch latest session status per project for the sidebar progress badge
      const { data: sessions } = await supabase
        .from('decision_sessions')
        .select('project_id, status, current_round, max_rounds, created_at')
        .order('created_at', { ascending: false });
      if (sessions) {
        const map = {};
        for (const s of sessions) {
          if (!map[s.project_id]) {
            map[s.project_id] = {
              status: s.status,
              current_round: s.current_round || 0,
              max_rounds: s.max_rounds || 5,
            };
          }
        }
        setProjectStatusMap(map);
      }
    }
  };

  const loadSessionHistory = async (projectId) => {
    const { data } = await supabase
      .from('decision_sessions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(8);
    setSessionHistory(data || []);
  };

  // ── Session management ────────────────────────────────────────────────────────
  const resetSession = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setMessages([]);
    setCurrentRound(0);
    setSetupTheme(null);
    setSetupContext('');
    setSetupConstraints('');
    setSetupGoal('');
    setSetupFocusPoints('');
    setSetupPrfaq('');
    setStreamingContent(null);
    setMaxRounds(5);
    setGroundingEnabled(false);
    setFollowUpInput('');
    setGateOpen(null);
    setMeetingDesign(null);
    setLiveSummary(null);
    setBriefingDoc(null);
  };

  const requestMeetingDesign = async () => {
    if (!activeProject || isDesigning) return;
    setIsDesigning(true);
    try {
      const design = await suggestMeetingDesign({
        project: activeProject,
        agents: customAgents,
        locale: i18n.resolvedLanguage === 'en' ? 'en' : 'ja',
      });
      if (design) {
        setMeetingDesign(design);
      } else {
        alert(t('design.failed'));
      }
    } finally {
      setIsDesigning(false);
    }
  };

  const applyMeetingDesign = () => {
    if (!meetingDesign) return;
    if ([3, 5, 7].includes(meetingDesign.recommended_rounds)) {
      setMaxRounds(meetingDesign.recommended_rounds);
    }
    if (meetingDesign.focus_points) {
      setSetupFocusPoints(meetingDesign.focus_points);
    }
    if (meetingDesign.recommended_theme) {
      const matchedTheme = THEMES.find(th =>
        th.id === meetingDesign.recommended_theme || th.label === meetingDesign.recommended_theme
      );
      if (matchedTheme) setSetupTheme(matchedTheme.id);
    }
    setMeetingDesign(null);
  };

  const viewHistorySession = async (histSession) => {
    setLoading(true);
    const { data: msgs } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('session_id', histSession.id)
      .order('created_at');

    if (msgs && msgs.length > 0) {
      const maxRound = msgs.reduce((mx, m) => Math.max(mx, m.round_number || 0), 0);
      setSession({ ...histSession, readonly: true });
      setMessages(msgs);
      setCurrentRound(maxRound || 5);
      restoreSetupContext(histSession.setup_context);
    }
    setLoading(false);
  };

  const resumeSession = async (histSession) => {
    setLoading(true);
    const { data: msgs } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('session_id', histSession.id)
      .order('created_at');

    setSession({ ...histSession, readonly: false });
    setMessages(msgs || []);
    setCurrentRound(histSession.current_round || 1);
    setMaxRounds(histSession.max_rounds || 5);
    setGroundingEnabled(histSession.grounding_enabled || false);
    if (Array.isArray(histSession.participants)) setParticipants(histSession.participants);
    restoreSetupContext(histSession.setup_context);
    setLoading(false);
  };

  // Build the agents map filtered to the current session's participants.
  const effectiveAgents = () => {
    const out = {};
    for (const id of participants) {
      if (customAgents[id]) out[id] = { ...customAgents[id], is_active: true };
    }
    // Always keep CEO if it exists, even if not explicitly selected, since the
    // round flow needs at least one CEO for ceo_check / ceo_final.
    if (customAgents.CEO && !out.CEO) out.CEO = { ...customAgents.CEO, is_active: true };
    return out;
  };

  const analyzeNews = async () => {
    if (!newsText.trim() || isAnalyzingNews) return;
    setIsAnalyzingNews(true);
    try {
      const sug = await suggestTopicFromNews({
        newsText,
        locale: i18n.resolvedLanguage === 'en' ? 'en' : 'ja',
      });
      if (sug) setNewsSuggestion(sug);
      else alert(t('news.failed'));
    } finally {
      setIsAnalyzingNews(false);
    }
  };

  const applyNewsSuggestion = async () => {
    if (!newsSuggestion) return;
    // Create the project, switch to it, prefill setup, open theme modal
    const newProject = {
      name: newsSuggestion.project_name,
      summary: newsSuggestion.project_summary,
      type: newsSuggestion.project_type,
      strategic_importance: newsSuggestion.strategic_importance,
    };
    const { data, error } = await supabase.from('projects')
      .insert({ ...newProject, owner_id: currentUser?.id || null })
      .select().single();
    if (error) {
      alert(`Failed: ${error.message}`);
      return;
    }
    await fetchProjects();
    setActiveProject(data);
    setSetupContext(newsSuggestion.user_context);
    setSetupConstraints(newsSuggestion.constraints);
    setSetupGoal(newsSuggestion.goal);
    setSetupFocusPoints(newsSuggestion.focus_points);
    const matched = THEMES.find(th => th.id === newsSuggestion.recommended_theme || th.label === newsSuggestion.recommended_theme);
    if (matched) setSetupTheme(matched.id);
    setNewsModalOpen(false);
    setNewsText('');
    setNewsSuggestion(null);
  };

  const loadAnalytics = async () => {
    if (isDemo) {
      setAnalyticsData({ totalSessions: 0, completed: 0, byTheme: {}, confidenceMix: {}, gateAdoption: {} });
      return;
    }
    const { data: sessions } = await supabase.from('decision_sessions').select('status, theme_type, gate_responses, created_at, max_rounds');
    const { data: msgs }     = await supabase.from('agent_messages').select('agent_role, confidence, round_number');

    const totalSessions = sessions?.length || 0;
    const completed = sessions?.filter(s => s.status === 'completed').length || 0;
    const byTheme = {};
    for (const s of sessions || []) {
      byTheme[s.theme_type] = (byTheme[s.theme_type] || 0) + 1;
    }
    const confidenceMix = { high: 0, medium: 0, low: 0, untagged: 0 };
    const confidenceByAgent = {};
    for (const m of msgs || []) {
      const c = m.confidence || 'untagged';
      confidenceMix[c] = (confidenceMix[c] || 0) + 1;
      if (!confidenceByAgent[m.agent_role]) confidenceByAgent[m.agent_role] = { high: 0, medium: 0, low: 0, untagged: 0 };
      confidenceByAgent[m.agent_role][c] = (confidenceByAgent[m.agent_role][c] || 0) + 1;
    }
    const gateAdoption = { adopt: 0, reject: 0, pending: 0 };
    for (const s of sessions || []) {
      const final = s.gate_responses?.final?.decision;
      if (final && gateAdoption[final] !== undefined) gateAdoption[final]++;
    }
    setAnalyticsData({ totalSessions, completed, byTheme, confidenceMix, confidenceByAgent, gateAdoption });
  };

  // Minimal CSV parser: handles double-quoted fields with commas inside.
  // First row is the header. Recognised columns map to projects schema.
  const parseCsv = (text) => {
    const rows = [];
    let cur = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cell += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { cur.push(cell); cell = ''; }
        else if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = ''; }
        else if (ch === '\r') { /* skip */ }
        else cell += ch;
      }
    }
    if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur); }
    return rows.filter(r => r.some(c => c.trim().length > 0));
  };

  const importProjectsCsv = async (text) => {
    const rows = parseCsv(text);
    if (rows.length < 2) { alert(t('projects.csv_empty')); return; }
    const header = rows[0].map(c => c.trim().toLowerCase());
    const allowed = ['name', 'summary', 'type', 'client_type', 'contract_type', 'strategic_importance',
                     'client', 'duration', 'size', 'budget', 'building_usage', 'location', 'remarks'];
    const records = rows.slice(1).map(r => {
      const obj = { owner_id: currentUser?.id || null };
      header.forEach((h, idx) => {
        if (allowed.includes(h) && r[idx] !== undefined) obj[h] = r[idx].trim();
      });
      if (!obj.strategic_importance) obj.strategic_importance = 'medium';
      return obj;
    }).filter(r => r.name);

    if (records.length === 0) { alert(t('projects.csv_no_name')); return; }
    const { error } = await supabase.from('projects').insert(records);
    if (error) {
      alert(`Import failed: ${error.message}`);
      return;
    }
    await fetchProjects();
    alert(t('projects.csv_imported', { n: records.length }));
  };

  const requestBriefing = async () => {
    if (!activeProject || isBriefingLoading) return;
    setIsBriefingLoading(true);
    try {
      const brief = await generateBriefing({
        project: activeProject,
        setupContext: {
          user_context: setupContext,
          constraints: setupConstraints,
          goal: setupGoal,
        },
        locale: i18n.resolvedLanguage === 'en' ? 'en' : 'ja',
      });
      if (brief) setBriefingDoc(brief);
      else alert(t('briefing.failed'));
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const refreshLiveSummary = async () => {
    if (!session || messages.length === 0 || isSummarizing) return;
    setIsSummarizing(true);
    try {
      const sum = await summarizeProgress({
        messages,
        locale: i18n.resolvedLanguage === 'en' ? 'en' : 'ja',
      });
      if (sum) setLiveSummary(sum);
    } finally {
      setIsSummarizing(false);
    }
  };

  const restoreSetupContext = (ctx) => {
    if (!ctx) return;
    setSetupContext(ctx.user_context || '');
    setSetupConstraints(ctx.constraints || '');
    setSetupGoal(ctx.goal || '');
    setSetupFocusPoints(ctx.focus_points || '');
    setSetupPrfaq(ctx.prfaq || '');
  };

  const exitHistoryView = () => {
    setSession(null);
    setMessages([]);
    setCurrentRound(0);
  };

  // ── Discussion flow ──────────────────────────────────────────────────────────
  const startNewSession = async () => {
    if (!activeProject || !setupTheme) return;
    const themeLabel = THEMES.find(th => th.id === setupTheme)?.label || setupTheme;
    let finalTheme = themeLabel;
    if (setupContext) finalTheme += ` | ${setupContext.substring(0, 20)}…`;

    const extendedContext = {
      user_context: setupContext,
      constraints: setupConstraints,
      goal: setupGoal,
      focus_points: setupFocusPoints,
      prfaq: setupPrfaq,
      persona_files: personaFiles,
      briefing: briefingDoc?.approved ? briefingDoc : null,
    };
    setLoading(true);

    try {
      let sessionData;

      if (isDemo) {
        sessionData = { id: 'demo-' + Date.now(), project_id: activeProject.id, theme_type: setupTheme, created_at: new Date().toISOString() };
      } else {
        const validThemeId = THEMES.find(th => th.id === setupTheme) ? setupTheme : 'custom';
        const { data, error } = await supabase
          .from('decision_sessions')
          .insert({
            project_id: activeProject.id,
            theme_type: validThemeId,
            setup_context: extendedContext,
            current_round: 1,
            max_rounds: maxRounds,
            grounding_enabled: groundingEnabled,
            participants: participants,
            owner_id: currentUser?.id || null,
          })
          .select().single();
        if (error) throw new Error(error.message);
        sessionData = data;
      }

      const sessionObj = { ...sessionData, theme_type: finalTheme };
      setSession(sessionObj);
      setMessages([]);
      setCurrentRound(1);
      setSetupTheme(null);
      setLoading(false);
      setIsThinking(true);

      if (isDemo) {
        for (const msg of MOCK_MESSAGES[1] || []) {
          setThinkingAgent(msg.role);
          await new Promise(r => setTimeout(r, 1200));
          setMessages(prev => [...prev, { agent_role: msg.role, content: msg.content, round_number: 1 }]);
        }
      } else {
        const sessionAgents = effectiveAgents();
        const cfg = getRoundConfig(1, maxRounds, sessionAgents);
        let currentMessages = [];

        for (const agentKey of cfg.agents) {
          setThinkingAgent(agentKey);
          setStreamingContent({ agent_role: agentKey, content: '', round_number: 1 });

          const response = await generateAgentResponseStream(
            agentKey, sessionObj, activeProject, 1, currentMessages, extendedContext, sessionAgents,
            (partial) => setStreamingContent({ agent_role: agentKey, content: partial, round_number: 1 }),
            cfg.type,
            groundingEnabled
          );

          setStreamingContent(null);
          setThinkingAgent(null);

          if (response) {
            const { confidence, cleaned } = extractConfidence(response.content);
            const newMsg = { agent_role: response.role, content: cleaned, confidence, round_number: 1 };
            currentMessages = [...currentMessages, newMsg];
            setMessages(prev => [...prev, newMsg]);
            await saveMessages(sessionData.id, 1, [newMsg]);
          }
          await new Promise(r => setTimeout(r, 600));
        }
        // Open the post-Round-1 HITL gate
        setGateOpen('r1');
      }
    } catch (err) {
      console.error(err);
      alert(t('setup.start_failed', { error: err.message }));
      setLoading(false);
    } finally {
      setIsThinking(false);
      setThinkingAgent(null);
      setStreamingContent(null);
    }
  };

  const saveMessages = async (sessionId, round, newMsgs) => {
    if (isDemo) return;
    const records = newMsgs.map(m => ({
      session_id: sessionId,
      round_number: round,
      agent_role: m.agent_role || m.role,
      content: m.content,
      confidence: m.confidence || null,
    }));
    await supabase.from('agent_messages').insert(records);
  };

  const handleNextRound = async () => {
    if (!session || isThinking || session.readonly) return;
    setLoading(true);
    setIsThinking(true);
    const nextR = currentRound + 1;
    setCurrentRound(nextR);

    if (!isDemo && session.id) {
      const sessionPatch = { current_round: nextR };
      if (nextR >= maxRounds) sessionPatch.status = 'completed';
      await supabase.from('decision_sessions').update(sessionPatch).eq('id', session.id);
    }

    try {
      if (isDemo) {
        for (const msg of MOCK_MESSAGES[nextR] || []) {
          setThinkingAgent(msg.role);
          await new Promise(r => setTimeout(r, 1000));
          setMessages(prev => [...prev, { agent_role: msg.role, content: msg.content, round_number: nextR }]);
        }
      } else {
        const sessionAgents = effectiveAgents();
        const cfg = getRoundConfig(nextR, maxRounds, sessionAgents);
        let currentMessages = [...messages];

        for (const agentKey of cfg.agents) {
          setThinkingAgent(agentKey);
          setStreamingContent({ agent_role: agentKey, content: '', round_number: nextR });

          const roundContext = {
            user_context: setupContext,
            constraints: setupConstraints,
            goal: setupGoal,
            focus_points: setupFocusPoints,
            prfaq: setupPrfaq,
            persona_files: personaFiles,
            briefing: briefingDoc?.approved ? briefingDoc : null,
          };
          const response = await generateAgentResponseStream(
            agentKey, session, activeProject, nextR, currentMessages, roundContext, sessionAgents,
            (partial) => setStreamingContent({ agent_role: agentKey, content: partial, round_number: nextR }),
            cfg.type,
            groundingEnabled
          );

          setStreamingContent(null);
          setThinkingAgent(null);

          if (response) {
            const { confidence, cleaned } = extractConfidence(response.content);
            const newMsg = { agent_role: response.role, content: cleaned, confidence, round_number: nextR };
            currentMessages = [...currentMessages, newMsg];
            setMessages(prev => [...prev, newMsg]);
            await saveMessages(session.id, nextR, [newMsg]);
          }
          await new Promise(r => setTimeout(r, 600));
        }

        // Open the final-round HITL gate when CEO has just spoken
        if (nextR === maxRounds) setGateOpen('final');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsThinking(false);
      setThinkingAgent(null);
      setStreamingContent(null);
      // Refresh the right-panel live summary now that a round completed
      if (!isDemo && session?.id) refreshLiveSummary();
    }
  };

  // Submit a follow-up "what if X?" question after the final round, then run
  // a follow_up round automatically (one extra exchange with all agents).
  const submitFollowUp = async () => {
    if (!followUpInput.trim() || !session || isThinking) return;
    const userMsg = { agent_role: 'USER', content: followUpInput, round_number: currentRound };
    setMessages(prev => [...prev, userMsg]);
    await saveMessages(session.id, currentRound, [userMsg]);
    setFollowUpInput('');
    await handleNextRound();
  };

  // Record HITL gate decision (採用/却下/保留) to the session JSONB.
  const recordGateDecision = async (gate, decision) => {
    setGateOpen(null);
    if (isDemo || !session?.id) return;
    const existing = session.gate_responses || {};
    const next = { ...existing, [gate]: { decision, at: new Date().toISOString() } };
    await supabase.from('decision_sessions').update({ gate_responses: next }).eq('id', session.id);
    setSession(prev => prev ? { ...prev, gate_responses: next } : prev);
  };

  const submitUserInput = async () => {
    if (!userInput.trim() || !session) return;
    const userMsg = { agent_role: 'USER', content: userInput, round_number: currentRound };
    setMessages(prev => [...prev, userMsg]);
    await saveMessages(session.id, currentRound, [userMsg]);
    setUserInput('');
  };

  // ── Download ─────────────────────────────────────────────────────────────────
  const downloadSessionSummary = async () => {
    if (!activeProject || !session || messages.length === 0) return;
    if (isGeneratingPdf) return;

    setIsGeneratingPdf(true);
    try {
      const setupBundle = {
        user_context: setupContext,
        constraints: setupConstraints,
        goal: setupGoal,
        focus_points: setupFocusPoints,
        prfaq: setupPrfaq,
      };

      // 1. Synthesize structured report (parallel with dynamic imports)
      const [{ pdf }, { SessionPDF }, report] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./lib/SessionPDF.jsx'),
        synthesizeDecisionMemo({
          project: activeProject,
          session,
          messages,
          setupContext: setupBundle,
          locale: i18n.resolvedLanguage === 'en' ? 'en' : 'ja',
        }),
      ]);

      // 1.5 Persist the decision summary + embedding so future projects can
      // surface this as a "similar past decision" via pgvector.
      if (!isDemo && report && session?.id) {
        const summaryText = [
          activeProject?.name,
          report.executive_summary,
          report.conclusion,
          (report.discussion_points || []).join(' / '),
          report.final_decision?.headline,
        ].filter(Boolean).join('\n');
        const summaryVec = await embedText(summaryText);
        if (summaryVec) {
          await supabase.from('decision_sessions')
            .update({ decision_summary: summaryText, summary_embedding: summaryVec })
            .eq('id', session.id);
        }
      }

      const labels = {
        title: t('summary_export.title'),
        subtitle: t('summary_export.subtitle'),
        locale: dateLocale,
        meta: {
          project: t('summary_export.label_project'),
          client: t('summary_export.label_client'),
          budget: t('summary_export.label_budget'),
          theme: t('summary_export.label_theme'),
          date: t('summary_export.label_date'),
        },
        sections: {
          setup: t('summary_export.section_setup'),
          cover_summary: t('summary_export.section_cover_summary'),
          structured_body: t('summary_export.section_structured_body'),
          appendix: t('summary_export.section_appendix'),
          transcript: t('summary_export.section_transcript'),
        },
        setup: {
          user_context: t('setup.context_label'),
          constraints: t('setup.constraints_label'),
          goal: t('setup.goal_label'),
          focus_points: t('setup.focus_points_label'),
          prfaq: t('setup.prfaq_label'),
        },
        report: {
          executive_summary: t('summary_export.report_executive_summary'),
          conclusion: t('summary_export.report_conclusion'),
          discussion_points: t('summary_export.report_discussion_points'),
          agreements: t('summary_export.report_agreements'),
          disagreements: t('summary_export.report_disagreements'),
          final_decision: t('summary_export.report_final_decision'),
          action_items: t('summary_export.report_action_items'),
          col_owner: t('summary_export.report_col_owner'),
          col_task: t('summary_export.report_col_task'),
          col_due: t('summary_export.report_col_due'),
          empty_points: t('summary_export.report_empty_points'),
          empty_agreements: t('summary_export.report_empty_agreements'),
          empty_disagreements: t('summary_export.report_empty_disagreements'),
          empty_rationale: t('summary_export.report_empty_rationale'),
          empty_actions: t('summary_export.report_empty_actions'),
          unavailable: t('summary_export.report_unavailable'),
        },
        round_prefix: 'Round',
        footer: t('summary_export.footer', { date: new Date().toLocaleString(dateLocale) }),
      };

      const doc = (
        <SessionPDF
          project={activeProject}
          session={session}
          messages={messages}
          setupContext={setupBundle}
          labels={labels}
          report={report}
        />
      );

      const blob = await pdf(doc).toBlob();
      const safeName = activeProject.name.replace(/[<>:"/\\|?*]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decision_memo_${safeName}_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert(`PDF生成に失敗しました: ${err?.message || err}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ── Project CRUD ─────────────────────────────────────────────────────────────
  const createOrUpdateProject = async () => {
    if (!projectForm.name) return alert(t('projects.name_required'));
    setLoading(true);
    const formWithOwner = projectForm.id ? projectForm : { ...projectForm, owner_id: currentUser?.id || null };
    const { data } = await supabase.from('projects').upsert(formWithOwner).select().single();
    if (data) {
      await fetchProjects();
      setActiveProject(data);
      setIsEditingProject(false);
    }
    setLoading(false);
  };

  const deleteProject = async () => {
    if (!activeProject) return;
    if (!confirm(t('projects.delete_confirm', { name: activeProject.name }))) return;
    setLoading(true);
    await supabase.from('projects').delete().eq('id', activeProject.id);
    setActiveProject(null);
    setIsEditingProject(false);
    resetSession();
    await fetchProjects();
    setLoading(false);
  };

  // ── Knowledge base CRUD ──────────────────────────────────────────────────────
  const createOrUpdateCase = async () => {
    if (!caseForm.title) return alert(t('knowledge_page.title_required'));
    setLoading(true);
    if (editingCase.id) {
      await supabase.from('reference_cases').update(caseForm).eq('id', editingCase.id);
    } else {
      await supabase.from('reference_cases').insert(caseForm);
    }
    await fetchReferenceCases();
    setEditingCase(null);
    setLoading(false);
  };

  const deleteCase = async (id) => {
    if (!confirm(t('knowledge_page.delete_case_confirm'))) return;
    await supabase.from('reference_cases').delete().eq('id', id);
    await fetchReferenceCases();
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getAgentInitials = (role) => (role || 'AI').substring(0, 2);
  const getThemeLabel    = (id)   => THEMES.find(th => th.id === id)?.label || id;

  const FILTERS = [
    ['all', t('projects.filter_all')],
    ['high', t('projects.filter_high')],
    ['medium', t('projects.filter_medium')],
    ['low', t('projects.filter_low')],
  ]

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <header>
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layout /> {t('header.title')}
          <span className="demo-badge">{isDemo ? t('header.demo_badge') : 'v0.7'}</span>
          <LanguageToggle />
          <button
            className="btn-icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={t('header.toggle_theme')}
            style={{ marginLeft: 4 }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <AuthBar t={t} />
        </div>
      </header>

      <div className="sidebar">
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <Layout size={20} /><span>{t('nav.dashboard')}</span>
          </button>
          <button className={`nav-item ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>
            <Users size={20} /><span>{t('nav.agents')}</span>
          </button>
          <button className={`nav-item ${activeTab === 'knowledge' ? 'active' : ''}`} onClick={() => setActiveTab('knowledge')}>
            <BookOpen size={20} /><span>{t('nav.knowledge')}</span>
          </button>
          <button className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => { setActiveTab('analytics'); loadAnalytics(); }}>
            <BarChart3 size={20} /><span>{t('nav.analytics')}</span>
          </button>
        </nav>

        <div className="sidebar-divider"></div>

        {activeTab === 'dashboard' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.78rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('projects.list_heading')}
              </h3>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn-icon" title={t('news.button')} onClick={() => setNewsModalOpen(true)}>
                  📰
                </button>
                <label className="btn-icon" title={t('projects.import_csv')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                  <Upload size={15} />
                  <input type="file" accept=".csv" style={{ display: 'none' }}
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const text = await f.text();
                      await importProjectsCsv(text);
                      e.target.value = '';
                    }} />
                </label>
                <button className="btn-icon" title={t('projects.new_title')} onClick={() => { setIsEditingProject(true); setProjectForm(EMPTY_PROJECT_FORM); }}>
                  <PlusCircle size={17} />
                </button>
              </div>
            </div>

            <input
              className="project-search"
              placeholder={t('projects.search_placeholder')}
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
            />

            <div className="filter-tabs">
              {FILTERS.map(([val, lbl]) => (
                <button
                  key={val}
                  className={`filter-tab ${projectFilter === val ? 'active' : ''}`}
                  onClick={() => setProjectFilter(val)}
                >{lbl}</button>
              ))}
            </div>

            <div className="project-list">
              {filteredProjects.map(p => {
                const st = projectStatusMap[p.id];
                let badge = null;
                if (st) {
                  if (st.status === 'completed') {
                    badge = { label: t('projects.status_completed'), color: '#10b981' };
                  } else if (st.current_round > 0 && st.current_round < st.max_rounds) {
                    badge = { label: t('projects.status_active', { n: st.current_round, max: st.max_rounds }), color: '#3b82f6' };
                  }
                } else {
                  badge = { label: t('projects.status_none'), color: '#94a3b8' };
                }
                return (
                  <div
                    key={p.id}
                    className={`project-item ${activeProject?.id === p.id ? 'active' : ''}`}
                    onClick={() => { setActiveProject(p); resetSession(); setIsEditingProject(false); }}
                  >
                    <div className="name">{p.name}</div>
                    <div className="meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span>{p.client || t('projects.client_default')} · {p.strategic_importance}</span>
                      {badge ? (
                        <span style={{ fontSize: '0.7rem', color: '#fff', background: badge.color, padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {filteredProjects.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--secondary)', textAlign: 'center', padding: '1rem 0' }}>
                  {projectSearch || projectFilter !== 'all' ? t('projects.no_results') : t('projects.empty')}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <main className="main-content">

        {activeTab === 'agents' ? (
          <div className="agents-config">
            <h2>{t('agents_page.heading')}</h2>
            <div className="card" style={{ marginBottom: '2rem' }}>
              <p>{t('agents_page.intro')}</p>
            </div>
            <div className="agent-editor-grid">
              {Object.values(customAgents).map(agent => (
                <div key={agent.id} className="card agent-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div className="agent-avatar" style={{ backgroundColor: `var(--color-${agent.id.toLowerCase()}, var(--secondary))` }}>
                      {agent.id.substring(0, 2)}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-icon" onClick={() => setEditingAgent({...agent})}>{t('common.edit')}</button>
                      <button className="btn-icon" style={{ color: 'red' }} onClick={() => { if(confirm(t('common.delete_confirm'))) deleteAgentFromStorage(agent.id).then(loadExpertAgents); }}>
                        <Trash2 size={15}/>
                      </button>
                    </div>
                  </div>
                  <h3>{agent.name}</h3>
                  <p style={{ fontSize: '0.83rem', color: 'var(--secondary)' }}>{agent.description}</p>
                  <label className="switch" style={{ marginTop: 'auto' }}>
                    <input type="checkbox" checked={agent.is_active} onChange={async (e) => {
                      await saveAgentToStorage({...agent, is_active: e.target.checked});
                      loadExpertAgents();
                    }} />
                    <span className="slider"></span> {t('agents_page.active_label')}
                  </label>
                </div>
              ))}
              <div className="card agent-card add-agent"
                onClick={() => setEditingAgent({ id: 'NEW_' + Date.now(), name: '', description: '', style: '', is_active: true })}>
                <PlusCircle size={44} /><span>{t('agents_page.add_new')}</span>
              </div>
            </div>

            {editingAgent && (
              <div className="modal-overlay">
                <div className="card modal-content">
                  <h3>{editingAgent.id?.startsWith('NEW_') ? t('agents_page.modal_new_title') : t('agents_page.modal_edit_title')}</h3>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>{t('agents_page.field_role_id')}</label>
                    <input value={editingAgent.id} onChange={e => setEditingAgent({...editingAgent, id: e.target.value})} placeholder={t('agents_page.role_id_placeholder')} />
                  </div>
                  <div className="form-group">
                    <label>{t('agents_page.field_full_name')}</label>
                    <input value={editingAgent.name} onChange={e => setEditingAgent({...editingAgent, name: e.target.value})} placeholder={t('agents_page.full_name_placeholder')} />
                  </div>
                  <div className="form-group">
                    <label>{t('agents_page.field_system_prompt')}</label>
                    <textarea value={editingAgent.description} onChange={e => setEditingAgent({...editingAgent, description: e.target.value})} style={{ height: '80px' }} placeholder={t('agents_page.system_prompt_placeholder')} />
                  </div>
                  <div className="form-group">
                    <label>{t('agents_page.field_style')}</label>
                    <input value={editingAgent.style} onChange={e => setEditingAgent({...editingAgent, style: e.target.value})} placeholder={t('agents_page.style_placeholder')} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-primary" onClick={async () => { await saveAgentToStorage(editingAgent); loadExpertAgents(); setEditingAgent(null); }}>{t('common.save')}</button>
                    <button className="btn" onClick={() => setEditingAgent(null)}>{t('common.cancel')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

        ) : activeTab === 'analytics' ? (
          <div className="analytics-page">
            <h2 style={{ marginBottom: '1rem' }}>📊 {t('analytics.heading')}</h2>
            <p style={{ color: 'var(--secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              {t('analytics.intro')}
            </p>
            {analyticsData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div className="card">
                  <h3 style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>{t('analytics.sessions_heading')}</h3>
                  <div style={{ fontSize: '2rem', fontWeight: 700 }}>{analyticsData.totalSessions}</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>
                    {t('analytics.completed_label')} {analyticsData.completed} / {analyticsData.totalSessions}
                  </p>
                </div>

                <div className="card">
                  <h3 style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>{t('analytics.by_theme_heading')}</h3>
                  {Object.entries(analyticsData.byTheme).length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>{t('analytics.no_data')}</p>
                  ) : Object.entries(analyticsData.byTheme).map(([k, v]) => {
                    const pct = (v / analyticsData.totalSessions) * 100;
                    return (
                      <div key={k} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 2 }}>
                          <span>{getThemeLabel(k)}</span><span>{v}</span>
                        </div>
                        <div style={{ background: 'var(--border)', height: 6 }}>
                          <div style={{ background: 'var(--accent)', height: 6, width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="card">
                  <h3 style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>{t('analytics.confidence_heading')}</h3>
                  {(() => {
                    const total = Object.values(analyticsData.confidenceMix).reduce((a, b) => a + b, 0) || 1;
                    const colors = { high: '#10b981', medium: '#f59e0b', low: '#ef4444', untagged: '#94a3b8' };
                    return Object.entries(analyticsData.confidenceMix).map(([k, v]) => {
                      const pct = (v / total) * 100;
                      return (
                        <div key={k} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 2 }}>
                            <span>{t(`analytics.conf_${k}`)}</span><span>{v} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div style={{ background: 'var(--border)', height: 6 }}>
                            <div style={{ background: colors[k] || 'var(--accent)', height: 6, width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="card">
                  <h3 style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>{t('analytics.gate_heading')}</h3>
                  {(() => {
                    const total = Object.values(analyticsData.gateAdoption).reduce((a, b) => a + b, 0) || 1;
                    const colors = { adopt: '#10b981', reject: '#ef4444', pending: '#f59e0b' };
                    return Object.entries(analyticsData.gateAdoption).map(([k, v]) => {
                      const pct = (v / total) * 100;
                      return (
                        <div key={k} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 2 }}>
                            <span>{t(`analytics.gate_${k}`)}</span><span>{v}</span>
                          </div>
                          <div style={{ background: 'var(--border)', height: 6 }}>
                            <div style={{ background: colors[k] || 'var(--accent)', height: 6, width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {analyticsData.confidenceByAgent && Object.keys(analyticsData.confidenceByAgent).length > 0 && (
                  <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>{t('analytics.conf_by_agent')}</h3>
                    <table style={{ width: '100%', fontSize: '0.83rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>{t('analytics.agent_col')}</th>
                          <th style={{ padding: '4px 8px' }}>{t('analytics.conf_high')}</th>
                          <th style={{ padding: '4px 8px' }}>{t('analytics.conf_medium')}</th>
                          <th style={{ padding: '4px 8px' }}>{t('analytics.conf_low')}</th>
                          <th style={{ padding: '4px 8px' }}>{t('analytics.conf_untagged')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(analyticsData.confidenceByAgent).map(([role, mix]) => (
                          <tr key={role} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '4px 8px' }}><strong>{role}</strong></td>
                            <td style={{ textAlign: 'center' }}>{mix.high || 0}</td>
                            <td style={{ textAlign: 'center' }}>{mix.medium || 0}</td>
                            <td style={{ textAlign: 'center' }}>{mix.low || 0}</td>
                            <td style={{ textAlign: 'center', color: 'var(--secondary)' }}>{mix.untagged || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--secondary)' }}>{t('analytics.loading')}</p>
            )}
          </div>
        ) : activeTab === 'knowledge' ? (
          <div className="knowledge-base">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>{t('knowledge_page.heading')}</h2>
              {!isDemo && (
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => { setEditingCase({}); setCaseForm({ title: '', summary: '', outcome: '', project_type: '' }); }}>
                  <PlusCircle size={15} /> {t('knowledge_page.add_case')}
                </button>
              )}
            </div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <p>{t('knowledge_page.intro')}</p>
              {isDemo && <p style={{ marginTop: '0.5rem', fontSize: '0.83rem', color: 'var(--secondary)' }}>{t('knowledge_page.demo_note')}</p>}
            </div>
            {referenceCases.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--secondary)' }}>
                <BookOpen size={40} style={{ marginBottom: '1rem', opacity: 0.35 }} />
                <p>{isDemo ? t('knowledge_page.demo_empty') : t('knowledge_page.empty')}</p>
              </div>
            )}
            <div className="knowledge-list">
              {referenceCases.map(c => (
                <div key={c.id} className="card knowledge-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ marginBottom: '0.3rem' }}>{c.title}</h3>
                      <span className="tag">{c.project_type}</span>
                    </div>
                    {!isDemo && (
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button className="btn-icon" onClick={() => { setEditingCase(c); setCaseForm({ title: c.title, summary: c.summary, outcome: c.outcome, project_type: c.project_type }); }}>{t('common.edit')}</button>
                        <button className="btn-icon" style={{ color: 'red' }} onClick={() => deleteCase(c.id)}><Trash2 size={14}/></button>
                      </div>
                    )}
                  </div>
                  <p style={{ marginTop: '0.75rem' }}><strong>{t('knowledge_page.case_summary_label')}</strong> {c.summary}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>{t('knowledge_page.case_outcome_label')}</strong> {c.outcome}</p>
                </div>
              ))}
            </div>

            {editingCase && (
              <div className="modal-overlay">
                <div className="card modal-content" style={{ maxWidth: '560px' }}>
                  <h3>{editingCase.id ? t('knowledge_page.modal_edit_title') : t('knowledge_page.modal_new_title')}</h3>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>{t('knowledge_page.field_title')} <span style={{color:'red'}}>*</span></label>
                    <input value={caseForm.title} onChange={e => setCaseForm({...caseForm, title: e.target.value})} placeholder={t('knowledge_page.title_placeholder')} />
                  </div>
                  <div className="form-group">
                    <label>{t('knowledge_page.field_project_type')}</label>
                    <input value={caseForm.project_type} onChange={e => setCaseForm({...caseForm, project_type: e.target.value})} placeholder={t('knowledge_page.project_type_placeholder')} />
                  </div>
                  <div className="form-group">
                    <label>{t('knowledge_page.field_summary')}</label>
                    <textarea value={caseForm.summary} onChange={e => setCaseForm({...caseForm, summary: e.target.value})} style={{ height: '80px' }} placeholder={t('knowledge_page.summary_placeholder')} />
                  </div>
                  <div className="form-group">
                    <label>{t('knowledge_page.field_outcome')}</label>
                    <textarea value={caseForm.outcome} onChange={e => setCaseForm({...caseForm, outcome: e.target.value})} style={{ height: '70px' }} placeholder={t('knowledge_page.outcome_placeholder')} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-primary" onClick={createOrUpdateCase} disabled={loading}>{t('common.save')}</button>
                    <button className="btn" onClick={() => setEditingCase(null)}>{t('common.cancel')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

        ) : isEditingProject ? (
          <div className="card form-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>{projectForm.id ? t('projects.edit_title') : t('projects.create_title')}</h2>
              <button className="btn" style={{ fontSize: '0.8rem' }} onClick={() => {
                const header = "name,summary,importance,client,duration,size,budget,building_usage,location,remarks\n";
                const row = "New project,Description here,medium,Client name,2024-2025,1000m2,5億円,Office,Tokyo,Notes";
                const blob = new Blob(["﻿" + header + row], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "project_template.csv";
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
              }}>{t('projects.template_csv')}</button>
            </div>
            <div className="form-grid">
              <div className="form-group full">
                <label>{t('projects.field_name')} <span style={{color:'red'}}>*</span></label>
                <input value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} placeholder={t('projects.name_placeholder')} />
              </div>
              <div className="form-group">
                <label>{t('projects.field_client')}</label>
                <input value={projectForm.client} onChange={e => setProjectForm({...projectForm, client: e.target.value})} placeholder={t('projects.client_placeholder')} />
              </div>
              <div className="form-group">
                <label>{t('projects.field_importance')}</label>
                <select value={projectForm.strategic_importance} onChange={e => setProjectForm({...projectForm, strategic_importance: e.target.value})}>
                  <option value="high">{t('projects.importance_high')}</option>
                  <option value="medium">{t('projects.importance_medium')}</option>
                  <option value="low">{t('projects.importance_low')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('projects.field_budget')}</label>
                <input value={projectForm.budget} onChange={e => setProjectForm({...projectForm, budget: e.target.value})} placeholder={t('projects.budget_placeholder')} />
              </div>
              <div className="form-group">
                <label>{t('projects.field_duration')}</label>
                <input value={projectForm.duration} onChange={e => setProjectForm({...projectForm, duration: e.target.value})} placeholder={t('projects.duration_placeholder')} />
              </div>
              <div className="form-group">
                <label>{t('projects.field_size')}</label>
                <input value={projectForm.size} onChange={e => setProjectForm({...projectForm, size: e.target.value})} placeholder={t('projects.size_placeholder')} />
              </div>
              <div className="form-group">
                <label>{t('projects.field_usage')}</label>
                <input value={projectForm.building_usage} onChange={e => setProjectForm({...projectForm, building_usage: e.target.value})} placeholder={t('projects.usage_placeholder')} />
              </div>
              <div className="form-group">
                <label>{t('projects.field_location')}</label>
                <input value={projectForm.location} onChange={e => setProjectForm({...projectForm, location: e.target.value})} placeholder={t('projects.location_placeholder')} />
              </div>
              <div className="form-group full">
                <label>{t('projects.field_summary')}</label>
                <textarea value={projectForm.summary} onChange={e => setProjectForm({...projectForm, summary: e.target.value})} style={{height: '100px'}} placeholder={t('projects.summary_placeholder')} />
              </div>
              <div className="form-group full">
                <label>{t('projects.field_remarks')}</label>
                <textarea value={projectForm.remarks} onChange={e => setProjectForm({...projectForm, remarks: e.target.value})} style={{height: '60px'}} placeholder={t('projects.remarks_placeholder')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={createOrUpdateProject} disabled={loading}>
                <Save size={15} style={{ display:'inline', marginRight:'5px' }}/>{t('common.save')}
              </button>
              <button className="btn" onClick={() => setIsEditingProject(false)}>{t('common.cancel')}</button>
              {projectForm.id && !isDemo && (
                <button className="btn" style={{ marginLeft: 'auto', color: '#ef4444', borderColor: '#fecaca' }}
                  onClick={deleteProject} disabled={loading}>
                  <Trash2 size={15} style={{ display:'inline', marginRight:'5px' }}/>{t('common.delete')}
                </button>
              )}
            </div>
          </div>

        ) : !session ? (
          activeProject ? (
            setupTheme ? (
              <div className="card form-card setup-panel-card">
                <div style={{ marginBottom: '1.5rem' }}>
                  <button className="btn-icon" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }} onClick={() => setSetupTheme(null)}>{t('setup.back')}</button>
                  <h2>{t('setup.title')}</h2>
                  <p style={{ color: 'var(--secondary)', fontSize: '0.88rem', marginTop: '0.3rem' }}>
                    {t('setup.current_theme')} <strong>{THEMES.find(th => th.id === setupTheme)?.label}</strong>
                  </p>
                </div>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>{t('setup.context_label')} <span style={{ fontWeight:400, color:'var(--secondary)' }}>{t('setup.optional_suffix')}</span></label>
                    <textarea value={setupContext} onChange={e => setSetupContext(e.target.value)} style={{ height: '100px' }}
                      placeholder={t('setup.context_placeholder')} />
                  </div>
                  <div className="form-group">
                    <label>{t('setup.constraints_label')} <span style={{ fontWeight:400, color:'var(--secondary)' }}>{t('setup.optional_suffix')}</span></label>
                    <textarea value={setupConstraints} onChange={e => setSetupConstraints(e.target.value)}
                      placeholder={t('setup.constraints_placeholder')} />
                  </div>
                  <div className="form-group">
                    <label>{t('setup.goal_label')} <span style={{ fontWeight:400, color:'var(--secondary)' }}>{t('setup.optional_suffix')}</span></label>
                    <textarea value={setupGoal} onChange={e => setSetupGoal(e.target.value)}
                      placeholder={t('setup.goal_placeholder')} />
                  </div>
                  <div className="form-group full">
                    <label>{t('setup.focus_points_label')} <span style={{ fontWeight:400, color:'var(--secondary)' }}>{t('setup.optional_suffix')}</span></label>
                    <textarea value={setupFocusPoints} onChange={e => setSetupFocusPoints(e.target.value)}
                      placeholder={t('setup.focus_points_placeholder')} style={{ height: '80px' }} />
                    <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginTop: '0.3rem' }}>
                      {t('setup.focus_points_hint')}
                    </p>
                  </div>
                  <div className="form-group full">
                    <label>{t('setup.prfaq_label')} <span style={{ fontWeight:400, color:'var(--secondary)' }}>{t('setup.optional_suffix')}</span></label>
                    <textarea value={setupPrfaq} onChange={e => setSetupPrfaq(e.target.value)}
                      placeholder={t('setup.prfaq_placeholder')} style={{ height: '140px', fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }} />
                    <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginTop: '0.3rem' }}>
                      {t('setup.prfaq_hint')}
                    </p>
                  </div>
                </div>
                <div className="form-grid" style={{ marginTop: '1rem' }}>
                  <div className="form-group full">
                    <label>{t('setup.participants_label')}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 4 }}>
                      {Object.values(customAgents)
                        .filter(a => a?.agent_type !== 'external')
                        .map(a => (
                          <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 400 }}>
                            <input type="checkbox" checked={participants.includes(a.id)}
                              onChange={e => setParticipants(prev =>
                                e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id)
                              )} />
                            <span>{a.name}</span>
                          </label>
                        ))}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginTop: '0.6rem', marginBottom: '0.3rem' }}>
                      {t('setup.external_hint')}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                      {Object.values(customAgents)
                        .filter(a => a?.agent_type === 'external')
                        .map(a => (
                          <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 400 }}>
                            <input type="checkbox" checked={participants.includes(a.id)}
                              onChange={e => setParticipants(prev =>
                                e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id)
                              )} />
                            <span style={{ color: 'var(--accent)' }}>+ {a.name}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>{t('setup.depth_label')}</label>
                    <input type="range" min={3} max={7} step={2} value={maxRounds}
                      onChange={e => setMaxRounds(parseInt(e.target.value, 10))}
                      style={{ width: '100%' }} />
                    <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginTop: '0.3rem' }}>
                      {t('setup.depth_value', { n: maxRounds })}
                    </p>
                  </div>
                  <div className="form-group full">
                    <label>{t('setup.persona_files_label')}</label>
                    <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginTop: '0.3rem', marginBottom: '0.5rem' }}>
                      {t('setup.persona_files_hint')}
                    </p>
                    {participants.map(id => (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '0.83rem' }}>
                        <span style={{ minWidth: 80, color: 'var(--secondary)' }}>{customAgents[id]?.name || id}</span>
                        <input type="file" accept=".txt,.md,.csv"
                          onChange={async e => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const text = await f.text();
                            setPersonaFiles(prev => ({ ...prev, [id]: text }));
                          }}
                          style={{ flex: 1, fontSize: '0.78rem' }} />
                        {personaFiles[id] ? (
                          <button type="button" className="btn-icon" style={{ fontSize: '0.75rem' }}
                            onClick={() => setPersonaFiles(prev => { const n = { ...prev }; delete n[id]; return n; })}>
                            ✕
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="form-group">
                    <label>{t('setup.grounding_label')}</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 400, paddingTop: '6px' }}>
                      <input type="checkbox" checked={groundingEnabled}
                        onChange={e => setGroundingEnabled(e.target.checked)} />
                      <span>{t('setup.grounding_value')}</span>
                    </label>
                    <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginTop: '0.3rem' }}>
                      {t('setup.grounding_hint')}
                    </p>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--soft-bg)', borderRadius: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.85rem' }}>📋 {t('briefing.section_title')}</strong>
                    {briefingDoc?.approved ? (
                      <span style={{ fontSize: '0.78rem', color: '#10b981' }}>✓ {t('briefing.approved')}</span>
                    ) : (
                      <button type="button" className="btn-icon" style={{ fontSize: '0.78rem' }}
                        onClick={requestBriefing} disabled={isBriefingLoading}>
                        {isBriefingLoading ? t('briefing.loading') : t('briefing.create')}
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginTop: '0.3rem' }}>
                    {t('briefing.section_hint')}
                  </p>
                </div>
                <button className="btn btn-primary" style={{ width:'100%', marginTop:'1.5rem', padding:'1rem' }}
                  onClick={startNewSession} disabled={loading}>
                  {loading ? t('common.preparing') : t('setup.start')}
                </button>
              </div>
            ) : (
              <div className="project-detail-view">
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>{activeProject.name}</h2>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="importance-tag">{activeProject.strategic_importance}</span>
                        {activeProject.building_usage && <span className="tag">{activeProject.building_usage}</span>}
                        {activeProject.location && <span className="tag">📍 {activeProject.location}</span>}
                      </div>
                    </div>
                    <button className="btn-icon" onClick={() => { setIsEditingProject(true); setProjectForm(activeProject); }}>{t('common.edit')}</button>
                  </div>
                  <div className="project-info-grid">
                    {activeProject.client   && <div><span className="info-label">{t('project_detail.info_client')}</span><span>{activeProject.client}</span></div>}
                    {activeProject.budget   && <div><span className="info-label">{t('project_detail.info_budget')}</span><span>{activeProject.budget}</span></div>}
                    {activeProject.duration && <div><span className="info-label">{t('project_detail.info_duration')}</span><span>{activeProject.duration}</span></div>}
                    {activeProject.size     && <div><span className="info-label">{t('project_detail.info_size')}</span><span>{activeProject.size}</span></div>}
                  </div>
                  {activeProject.summary && (
                    <p style={{ marginTop: '1rem', fontSize: '0.88rem', color: 'var(--secondary)', lineHeight: '1.65', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                      {activeProject.summary}
                    </p>
                  )}
                </div>

                {similarDecisions.length > 0 && (
                  <div className="card" style={{ marginBottom: '1.25rem', background: 'var(--soft-bg)' }}>
                    <h3 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>📚 {t('similar.heading')}</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginBottom: '0.6rem' }}>{t('similar.intro')}</p>
                    {similarDecisions.map(d => (
                      <div key={d.id} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginBottom: 2 }}>
                          {new Date(d.created_at).toLocaleDateString(dateLocale)} · {getThemeLabel(d.theme_type)} · 類似度 {(d.similarity * 100).toFixed(0)}%
                        </div>
                        <div style={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {(d.decision_summary || '').slice(0, 240)}{(d.decision_summary || '').length > 240 ? '…' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem' }}>{t('themes.select_heading')}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-icon" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={requestMeetingDesign} disabled={isDesigning}>
                      ✨ {isDesigning ? t('design.designing') : t('design.suggest_button')}
                    </button>
                    <button className="btn-icon" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => setShowThemeEditor(true)}>
                      <PlusCircle size={14} /> {t('themes.add_theme')}
                    </button>
                  </div>
                </div>
                <div className="theme-grid-main">
                  {THEMES.map(th => (
                    <div key={th.id} style={{ position: 'relative' }}>
                      <button className="theme-btn-main" onClick={() => setSetupTheme(th.id)}>
                        <span style={{ fontSize: '1rem', fontWeight: 700 }}>{th.label}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '0.3rem' }}>{th.desc}</span>
                      </button>
                      {customThemes.find(ct => ct.id === th.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCustomTheme(th.id); }}
                          style={{ position: 'absolute', top: '6px', right: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
                          title={t('common.delete')}
                        ><Trash2 size={12} /></button>
                      )}
                    </div>
                  ))}
                </div>

                {showThemeEditor && (
                  <div className="modal-overlay">
                    <div className="card modal-content" style={{ maxWidth: '440px' }}>
                      <h3>{t('themes.modal_title')}</h3>
                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label>{t('themes.field_label')} <span style={{ color: 'red' }}>*</span></label>
                        <input
                          value={themeForm.label}
                          onChange={e => setThemeForm({ ...themeForm, label: e.target.value })}
                          placeholder={t('themes.label_placeholder')}
                        />
                      </div>
                      <div className="form-group">
                        <label>{t('themes.field_desc')}</label>
                        <input
                          value={themeForm.desc}
                          onChange={e => setThemeForm({ ...themeForm, desc: e.target.value })}
                          placeholder={t('themes.desc_placeholder')}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn btn-primary" onClick={saveCustomTheme}>{t('common.save')}</button>
                        <button className="btn" onClick={() => setShowThemeEditor(false)}>{t('common.cancel')}</button>
                      </div>
                    </div>
                  </div>
                )}

                {!isDemo && sessionHistory.length > 0 && (
                  <div style={{ marginTop: '2rem' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display:'flex', alignItems:'center', gap:'6px' }}>
                      <History size={16} /> {t('session.history_heading')}
                    </h3>
                    <div className="history-list">
                      {sessionHistory.map(s => {
                        const maxR = s.max_rounds || 5;
                        const curR = s.current_round || 0;
                        const incomplete = s.status !== 'completed' && curR > 0 && curR < maxR;
                        return (
                          <div
                            key={s.id}
                            className="history-item"
                            onClick={() => incomplete ? resumeSession(s) : viewHistorySession(s)}
                          >
                            <div>
                              <span className="history-theme">{getThemeLabel(s.theme_type)}</span>
                              <span className="history-date">
                                {new Date(s.created_at).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
                                {incomplete ? ` · R${curR}/${maxR}` : ''}
                              </span>
                            </div>
                            <span style={{ color: incomplete ? 'var(--accent)' : 'var(--secondary)', fontSize: '0.8rem' }}>
                              {incomplete ? t('session.resume_session') : t('session.view_history')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="card initial-view">
              <MessageSquare size={60} style={{ color: 'var(--secondary)', marginBottom: '1rem', opacity: 0.45 }} />
              <h2>{t('welcome.title')}</h2>
              <p style={{ color: 'var(--secondary)', marginTop: '0.5rem', textAlign:'center' }}>
                {t('welcome.instruction')}
              </p>
              {projects.length === 0 && (
                <button className="btn btn-primary" style={{ marginTop: '1.5rem' }}
                  onClick={() => { setIsEditingProject(true); setProjectForm(EMPTY_PROJECT_FORM); }}>
                  <PlusCircle size={15} style={{ display:'inline', marginRight:'6px' }}/>{t('welcome.create_first')}
                </button>
              )}
            </div>
          )

        ) : (
          <div className="session-view">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <button className="btn-icon" style={{ fontSize: '0.83rem', marginBottom: '0.2rem' }}
                  onClick={session.readonly ? exitHistoryView : resetSession}>
                  {session.readonly ? t('session.back_history') : t('session.back_list')}
                </button>
                <h2 style={{ fontSize: '1.05rem' }}>
                  {session.readonly ? t('session.history_view_prefix') : (currentRound >= maxRounds ? t('session.round_finished') : t('session.round_n', { n: currentRound }))}
                  {session.theme_type}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {isThinking && !session.readonly && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>
                    {t('session.generating')}
                  </span>
                )}
              </div>
            </div>

            <div className="discussion-timeline">
              {messages.map((msg, idx) => (
                <div key={idx} className={`message message-${msg.agent_role?.toLowerCase()} ${msg.agent_role === 'USER' ? 'message-user' : ''}`}>
                  <div className="avatar" style={{ backgroundColor: `var(--color-${msg.agent_role?.toLowerCase()}, var(--secondary))` }}>
                    {getAgentInitials(msg.agent_role)}
                  </div>
                  <div className="bubble">
                    <div className="role-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{msg.agent_role} — Round {msg.round_number}</span>
                      {msg.confidence ? <ConfidenceBadge level={msg.confidence} t={t} /> : null}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                </div>
              ))}

              {streamingContent && streamingContent.content.length >= 3 && (
                <div className={`message message-${streamingContent.agent_role?.toLowerCase()} streaming-message`}>
                  <div className="avatar" style={{ backgroundColor: `var(--color-${streamingContent.agent_role?.toLowerCase()}, var(--secondary))` }}>
                    {getAgentInitials(streamingContent.agent_role)}
                  </div>
                  <div className="bubble">
                    <div className="role-name">{streamingContent.agent_role} — Round {streamingContent.round_number}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {streamingContent.content}<span className="streaming-cursor">|</span>
                    </div>
                  </div>
                </div>
              )}

              {isThinking && (!streamingContent || streamingContent.content.length < 3) && (
                <div className="message message-thinking">
                  <div className="avatar" style={{ background: 'var(--secondary)' }}>…</div>
                  <div className="bubble typing">
                    <strong>{thinkingAgent}</strong>{t('session.thinking_suffix')}
                    <div className="dot"></div><div className="dot"></div><div className="dot"></div>
                  </div>
                </div>
              )}
              <div ref={timelineEndRef} style={{ height: 1 }} />
            </div>

            {!session.readonly && currentRound < maxRounds && messages.length > 0 && !isThinking && (
              <button
                className="btn btn-primary floating-next-round"
                onClick={handleNextRound}
                disabled={loading}
                aria-label={t('session.next_round', { n: currentRound + 1 })}
              >
                {t('session.next_round', { n: currentRound + 1 })}
              </button>
            )}
            {(currentRound >= maxRounds || session.readonly) && messages.length > 0 && (
              <button
                className="btn floating-download-memo"
                onClick={downloadSessionSummary}
                disabled={isGeneratingPdf}
                aria-label={t('session.download_memo')}
              >
                <Download size={16} /> {isGeneratingPdf ? t('session.generating_memo') : t('session.download_memo')}
              </button>
            )}
          </div>
        )}
      </main>

      <div className="right-panel">
        <div className="card" style={{ background: '#f8fafc', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.78rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
            {t('right_panel.selected_heading')}
          </h3>
          {activeProject ? (
            <div style={{ fontSize: '0.84rem' }}>
              <p style={{ fontWeight: 700, marginBottom: '0.5rem', lineHeight: '1.4' }}>{activeProject.name}</p>
              {activeProject.client   && <p style={{ color:'var(--secondary)' }}><strong>{t('right_panel.client_label')}</strong> {activeProject.client}</p>}
              {activeProject.budget   && <p style={{ color:'var(--secondary)' }}><strong>{t('right_panel.budget_label')}</strong> {activeProject.budget}</p>}
              {activeProject.duration && <p style={{ color:'var(--secondary)' }}><strong>{t('right_panel.duration_label')}</strong> {activeProject.duration}</p>}
              {activeProject.summary  && (
                <p style={{ marginTop:'0.75rem', color:'var(--secondary)', lineHeight:'1.5', borderTop:'1px solid var(--border)', paddingTop:'0.75rem' }}>
                  {activeProject.summary}
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '0.83rem', color: 'var(--secondary)' }}>{t('right_panel.no_project')}</p>
          )}
        </div>

        {session && messages.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.82rem', margin: 0 }}>{t('right_panel.live_summary_heading')}</h3>
              <button className="btn-icon" style={{ fontSize: '0.78rem' }}
                onClick={refreshLiveSummary} disabled={isSummarizing || isThinking}>
                {isSummarizing ? t('right_panel.live_summary_refreshing') : t('right_panel.live_summary_refresh')}
              </button>
            </div>
            {liveSummary ? (
              <div style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
                <p style={{ marginBottom: 6 }}>
                  <strong style={{ color: 'var(--accent)' }}>{t('right_panel.live_summary_focus')}</strong> {liveSummary.current_focus}
                </p>
                <p style={{ marginBottom: 6 }}>
                  <strong style={{ color: '#047857' }}>{t('right_panel.live_summary_agreements')}</strong> {liveSummary.tentative_agreements}
                </p>
                <p>
                  <strong style={{ color: '#b45309' }}>{t('right_panel.live_summary_tensions')}</strong> {liveSummary.open_tensions}
                </p>
              </div>
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>{t('right_panel.live_summary_empty')}</p>
            )}
          </div>
        )}

        {session && !session.readonly && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.82rem', marginBottom: '0.6rem' }}>{t('right_panel.progress_heading')}</h3>
            <div style={{ display: 'flex', gap: '3px' }}>
              {Array.from({ length: maxRounds }, (_, i) => i + 1).map(r => (
                <div key={r} style={{
                  flex: 1, height: '5px',
                  background: r <= currentRound ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.3s'
                }} />
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '0.4rem' }}>
              {t('right_panel.round_n_of_max', { n: currentRound, max: maxRounds })}
              {currentRound >= maxRounds ? t('right_panel.completed_mark') : ''}
            </p>
          </div>
        )}

        {currentRound >= maxRounds && session && !session.readonly && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.6rem' }}>{t('right_panel.followup_heading')}</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginBottom: '0.75rem', lineHeight: '1.55' }}>
              {t('right_panel.followup_desc')}
            </p>
            <textarea value={followUpInput} onChange={e => setFollowUpInput(e.target.value)}
              placeholder={t('right_panel.followup_placeholder')}
              style={{ width: '100%', minHeight: '80px', marginBottom: '0.5rem' }} />
            <button className="btn btn-primary" style={{ width: '100%' }}
              onClick={submitFollowUp} disabled={isThinking || !followUpInput.trim()}>
              {t('right_panel.followup_submit')}
            </button>
          </div>
        )}

        {session && !session.readonly && currentRound > 1 && currentRound < maxRounds &&
         getRoundConfig(currentRound, maxRounds, customAgents).type === 'ceo_check' && (
          <div className="card">
            <h3 style={{ marginBottom: '0.6rem' }}>{t('right_panel.ceo_response_heading')}</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginBottom: '0.75rem', lineHeight: '1.55' }}>
              {t('right_panel.ceo_response_desc')}
            </p>
            <textarea value={userInput} onChange={e => setUserInput(e.target.value)}
              style={{ width: '100%', height: '120px', marginBottom: '0.75rem' }}
              placeholder={t('right_panel.ceo_response_placeholder')} />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={submitUserInput}>
              {t('right_panel.send_response')}
            </button>
          </div>
        )}
      </div>

      {briefingDoc && !briefingDoc.approved ? (
        <div onClick={() => setBriefingDoc(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card)', color: 'var(--card-foreground)', borderRadius: 6,
            padding: '1.5rem 1.75rem', maxWidth: 640, width: '94vw', maxHeight: '85vh',
            overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
          }}>
            <h3 style={{ marginTop: 0 }}>📋 {t('briefing.modal_title')}</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: '0.75rem' }}>
              {t('briefing.modal_intro')}
            </p>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>
              <h4 style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{t('briefing.field_summary')}</h4>
              <p>{briefingDoc.executive_brief}</p>
              {briefingDoc.factual_baseline?.length > 0 && (
                <>
                  <h4 style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{t('briefing.field_facts')}</h4>
                  <ul style={{ paddingLeft: '1.25rem' }}>{briefingDoc.factual_baseline.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </>
              )}
              {briefingDoc.open_questions?.length > 0 && (
                <>
                  <h4 style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{t('briefing.field_questions')}</h4>
                  <ul style={{ paddingLeft: '1.25rem' }}>{briefingDoc.open_questions.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </>
              )}
              {briefingDoc.evidence_from_cases?.length > 0 && (
                <>
                  <h4 style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{t('briefing.field_evidence')}</h4>
                  <ul style={{ paddingLeft: '1.25rem' }}>{briefingDoc.evidence_from_cases.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </>
              )}
              {briefingDoc.decision_criteria?.length > 0 && (
                <>
                  <h4 style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{t('briefing.field_criteria')}</h4>
                  <ul style={{ paddingLeft: '1.25rem' }}>{briefingDoc.decision_criteria.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setBriefingDoc({ ...briefingDoc, approved: true })}>
                ✓ {t('briefing.approve')}
              </button>
              <button className="btn" onClick={requestBriefing} disabled={isBriefingLoading}>
                🔄 {t('briefing.regenerate')}
              </button>
              <button className="btn" onClick={() => setBriefingDoc(null)}>
                {t('briefing.dismiss')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {newsModalOpen ? (
        <div onClick={() => setNewsModalOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card)', color: 'var(--card-foreground)', borderRadius: 6,
            padding: '1.5rem 1.75rem', maxWidth: 600, width: '94vw', maxHeight: '85vh',
            overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>📰 {t('news.modal_title')}</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: '0.75rem' }}>
              {t('news.modal_intro')}
            </p>
            <textarea value={newsText} onChange={e => setNewsText(e.target.value)}
              placeholder={t('news.placeholder')}
              style={{ width: '100%', minHeight: 140, marginBottom: '0.75rem' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={analyzeNews} disabled={isAnalyzingNews || !newsText.trim()}>
                {isAnalyzingNews ? t('news.analyzing') : t('news.analyze')}
              </button>
              <button className="btn" onClick={() => { setNewsModalOpen(false); setNewsText(''); setNewsSuggestion(null); }}>
                {t('news.cancel')}
              </button>
            </div>
            {newsSuggestion ? (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('news.preview_title')}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '4px 12px', fontSize: '0.85rem' }}>
                  <strong>{t('news.field_name')}</strong><span>{newsSuggestion.project_name}</span>
                  <strong>{t('news.field_summary')}</strong><span>{newsSuggestion.project_summary}</span>
                  <strong>{t('news.field_theme')}</strong><span>{newsSuggestion.recommended_theme}</span>
                  <strong>{t('news.field_focus')}</strong><span>{newsSuggestion.focus_points}</span>
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={applyNewsSuggestion}>{t('news.apply')}</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {meetingDesign ? (
        <div
          onClick={() => setMeetingDesign(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 6, padding: '1.5rem 1.75rem',
            maxWidth: 560, width: '94vw', maxHeight: '85vh', overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>✨ {t('design.modal_title')}</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: '1rem' }}>
              {t('design.modal_intro')}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px 12px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <strong>{t('design.field_theme')}</strong><span>{meetingDesign.recommended_theme || '—'}</span>
              <strong>{t('design.field_rounds')}</strong><span>{meetingDesign.recommended_rounds} {t('setup.depth_value', { n: meetingDesign.recommended_rounds }).split(' ')[1] || ''}</span>
              <strong>{t('design.field_minutes')}</strong><span>{meetingDesign.estimated_minutes != null ? `${meetingDesign.estimated_minutes} 分` : '—'}</span>
              <strong>{t('design.field_focus')}</strong><span>{meetingDesign.focus_points || '—'}</span>
            </div>

            {meetingDesign.key_risks?.length > 0 && (
              <>
                <strong style={{ fontSize: '0.85rem' }}>{t('design.field_risks')}</strong>
                <ul style={{ fontSize: '0.85rem', marginTop: '0.3rem', paddingLeft: '1.25rem' }}>
                  {meetingDesign.key_risks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </>
            )}
            {meetingDesign.missing_information?.length > 0 && (
              <>
                <strong style={{ fontSize: '0.85rem' }}>{t('design.field_missing')}</strong>
                <ul style={{ fontSize: '0.85rem', marginTop: '0.3rem', paddingLeft: '1.25rem' }}>
                  {meetingDesign.missing_information.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={applyMeetingDesign}>{t('design.apply_button')}</button>
              <button className="btn" onClick={() => setMeetingDesign(null)}>{t('design.dismiss_button')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {gateOpen ? (
        <div
          onClick={() => setGateOpen(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 6, padding: '1.5rem 1.75rem',
              maxWidth: 480, width: '92vw', boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>
              {gateOpen === 'r1' ? t('hitl.r1_title') : t('hitl.final_title')}
            </h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.88rem', lineHeight: 1.55, marginBottom: '1.25rem' }}>
              {gateOpen === 'r1' ? t('hitl.r1_desc') : t('hitl.final_desc')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {gateOpen === 'r1' ? (
                <>
                  <button className="btn btn-primary" onClick={() => recordGateDecision('r1', 'continue')}>
                    {t('hitl.r1_continue')}
                  </button>
                  <button className="btn" onClick={() => recordGateDecision('r1', 'edit_setup')}>
                    {t('hitl.r1_edit')}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => recordGateDecision('final', 'adopt')}>
                    {t('hitl.final_adopt')}
                  </button>
                  <button className="btn" onClick={() => recordGateDecision('final', 'reject')}>
                    {t('hitl.final_reject')}
                  </button>
                  <button className="btn" onClick={() => recordGateDecision('final', 'pending')}>
                    {t('hitl.final_pending')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App;
