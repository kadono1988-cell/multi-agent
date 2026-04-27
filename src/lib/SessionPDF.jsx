import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "NotoSansJP",
  src: "/fonts/NotoSansJP-Regular.ttf",
});

const COLORS = {
  text: "#1f2937",
  muted: "#6b7280",
  accent: "#1e40af",
  accentSoft: "#dbeafe",
  border: "#d1d5db",
  bgSoft: "#f3f4f6",
  tableRowAlt: "#f9fafb",
  agentBar: "#1e40af",
  positive: "#047857",
  positiveSoft: "#d1fae5",
  warn: "#b45309",
  warnSoft: "#fef3c7",
  decision: "#7c2d12",
  decisionSoft: "#fed7aa",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingLeft: 48,
    paddingRight: 48,
    fontFamily: "NotoSansJP",
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.6,
  },

  coverTitle: {
    fontSize: 20,
    marginBottom: 6,
    color: COLORS.text,
  },
  coverSubtitle: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 20,
  },

  metaBlock: {
    marginBottom: 18,
    padding: 12,
    backgroundColor: COLORS.bgSoft,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: COLORS.accent,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  metaLabel: {
    width: 80,
    fontSize: 9,
    color: COLORS.muted,
  },
  metaValue: {
    flex: 1,
    fontSize: 10,
  },

  sectionTitle: {
    fontSize: 13,
    marginTop: 14,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: COLORS.border,
    color: COLORS.accent,
  },
  subsectionTitle: {
    fontSize: 10,
    marginTop: 8,
    marginBottom: 4,
    color: COLORS.muted,
  },

  paragraph: {
    fontSize: 10,
    lineHeight: 1.65,
    marginBottom: 6,
  },

  bulletRow: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 10,
    fontSize: 10,
    color: COLORS.accent,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.55,
  },

  calloutBox: {
    padding: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  calloutSummary: {
    backgroundColor: COLORS.accentSoft,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: COLORS.accent,
  },
  calloutDecision: {
    backgroundColor: COLORS.decisionSoft,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: COLORS.decision,
  },
  calloutAgree: {
    backgroundColor: COLORS.positiveSoft,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: COLORS.positive,
  },
  calloutWarn: {
    backgroundColor: COLORS.warnSoft,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: COLORS.warn,
  },
  calloutLabel: {
    fontSize: 9,
    color: COLORS.muted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  calloutHeadline: {
    fontSize: 11,
    marginBottom: 4,
    color: COLORS.text,
  },

  actionTable: {
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopStyle: "solid",
    borderTopColor: COLORS.border,
    borderBottomWidth: 0.5,
    borderBottomStyle: "solid",
    borderBottomColor: COLORS.border,
  },
  actionHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.accent,
    color: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 9,
  },
  actionRow: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopStyle: "solid",
    borderTopColor: COLORS.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionRowAlt: {
    backgroundColor: COLORS.tableRowAlt,
  },
  cellOwner: { width: 70, fontSize: 9 },
  cellTask: { flex: 1, fontSize: 9, paddingRight: 4 },
  cellDue: { width: 70, fontSize: 9, color: COLORS.muted },

  appendixBanner: {
    marginTop: 28,
    marginBottom: 12,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: COLORS.text,
    color: "#ffffff",
    fontSize: 12,
    textAlign: "center",
  },

  setupField: {
    marginBottom: 10,
  },
  setupLabel: {
    fontSize: 9,
    color: COLORS.muted,
    marginBottom: 3,
  },
  setupValue: {
    fontSize: 10,
    lineHeight: 1.6,
  },
  prfaqValue: {
    fontSize: 9,
    lineHeight: 1.5,
    padding: 8,
    backgroundColor: COLORS.tableRowAlt,
  },

  roundBlock: {
    marginTop: 14,
    marginBottom: 4,
  },
  roundHeading: {
    fontSize: 13,
    marginBottom: 8,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 10,
    paddingRight: 10,
    backgroundColor: COLORS.accent,
    color: "#ffffff",
  },

  messageBlock: {
    marginBottom: 10,
  },
  agentLabel: {
    fontSize: 11,
    color: COLORS.agentBar,
    marginBottom: 4,
    paddingLeft: 6,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: COLORS.agentBar,
  },
  messageBody: {
    fontSize: 10,
    lineHeight: 1.65,
    paddingLeft: 10,
    color: COLORS.text,
  },

  footerContainer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopStyle: "solid",
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  footer: {
    flex: 1,
    fontSize: 8,
    color: COLORS.muted,
    textAlign: "center",
  },
  pageNumber: {
    fontSize: 8,
    color: COLORS.muted,
  },

  emptyHint: {
    fontSize: 9,
    color: COLORS.muted,
    marginBottom: 6,
  },
});

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function BulletList({ items, emptyHint }) {
  const valid = (items || []).filter(x => typeof x === 'string' && x.trim());
  if (valid.length === 0) {
    return emptyHint ? <Text style={styles.emptyHint}>{emptyHint}</Text> : null;
  }
  return (
    <View>
      {valid.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function SetupField({ label, value, monospace = false }) {
  if (!value || !value.trim()) return null;
  return (
    <View style={styles.setupField}>
      <Text style={styles.setupLabel}>{label}</Text>
      <Text style={monospace ? styles.prfaqValue : styles.setupValue}>{value}</Text>
    </View>
  );
}

export function SessionPDF({ project, session, messages, setupContext, labels, report }) {
  const createdAt = session?.created_at
    ? new Date(session.created_at).toLocaleString(labels.locale || "ja-JP")
    : "";

  const rounds = [1, 2, 3, 4, 5]
    .map((r) => ({ r, msgs: messages.filter((m) => m.round_number === r) }))
    .filter((x) => x.msgs.length > 0);

  const hasSetup = setupContext && (
    setupContext.user_context || setupContext.constraints || setupContext.goal
    || setupContext.focus_points || setupContext.prfaq
  );

  const r = report || null;
  const reportLabels = labels.report || {};
  const sectionLabels = labels.sections || {};

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.coverTitle}>{labels.title}</Text>
          <Text style={styles.coverSubtitle}>{labels.subtitle}</Text>
        </View>

        <View style={styles.metaBlock}>
          <MetaRow label={labels.meta.project} value={project?.name} />
          <MetaRow label={labels.meta.client} value={project?.client} />
          <MetaRow label={labels.meta.budget} value={project?.budget} />
          <MetaRow label={labels.meta.theme} value={session?.theme_type} />
          <MetaRow label={labels.meta.date} value={createdAt} />
        </View>

        {/* ── Cover Summary ─────────────────────────────────────── */}
        {r ? (
          <View>
            <Text style={styles.sectionTitle}>{sectionLabels.cover_summary}</Text>

            {r.executive_summary ? (
              <View style={[styles.calloutBox, styles.calloutSummary]}>
                <Text style={styles.calloutLabel}>{reportLabels.executive_summary}</Text>
                <Text style={styles.paragraph}>{r.executive_summary}</Text>
              </View>
            ) : null}

            {r.conclusion ? (
              <View style={[styles.calloutBox, styles.calloutDecision]}>
                <Text style={styles.calloutLabel}>{reportLabels.conclusion}</Text>
                <Text style={styles.paragraph}>{r.conclusion}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>{sectionLabels.cover_summary}</Text>
            <Text style={styles.emptyHint}>{reportLabels.unavailable}</Text>
          </View>
        )}

        {/* ── Structured Body ───────────────────────────────────── */}
        {r ? (
          <View>
            <Text style={styles.sectionTitle}>{sectionLabels.structured_body}</Text>

            <Text style={styles.subsectionTitle}>{reportLabels.discussion_points}</Text>
            <BulletList items={r.discussion_points} emptyHint={reportLabels.empty_points} />

            <Text style={styles.subsectionTitle}>{reportLabels.agreements}</Text>
            <View style={[styles.calloutBox, styles.calloutAgree]}>
              <BulletList items={r.agreements} emptyHint={reportLabels.empty_agreements} />
            </View>

            <Text style={styles.subsectionTitle}>{reportLabels.disagreements}</Text>
            <View style={[styles.calloutBox, styles.calloutWarn]}>
              <BulletList items={r.disagreements} emptyHint={reportLabels.empty_disagreements} />
            </View>

            <Text style={styles.subsectionTitle}>{reportLabels.final_decision}</Text>
            <View style={[styles.calloutBox, styles.calloutDecision]}>
              {r.final_decision?.headline ? (
                <Text style={styles.calloutHeadline}>{r.final_decision.headline}</Text>
              ) : null}
              <BulletList items={r.final_decision?.rationale} emptyHint={reportLabels.empty_rationale} />
            </View>

            <Text style={styles.subsectionTitle}>{reportLabels.action_items}</Text>
            {(r.action_items && r.action_items.length > 0) ? (
              <View style={styles.actionTable}>
                <View style={styles.actionHeader}>
                  <Text style={styles.cellOwner}>{reportLabels.col_owner}</Text>
                  <Text style={styles.cellTask}>{reportLabels.col_task}</Text>
                  <Text style={styles.cellDue}>{reportLabels.col_due}</Text>
                </View>
                {r.action_items.map((a, i) => (
                  <View
                    key={i}
                    style={[styles.actionRow, i % 2 === 1 ? styles.actionRowAlt : null]}
                  >
                    <Text style={styles.cellOwner}>{a.owner || '—'}</Text>
                    <Text style={styles.cellTask}>{a.task || '—'}</Text>
                    <Text style={styles.cellDue}>{a.due || '—'}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyHint}>{reportLabels.empty_actions}</Text>
            )}
          </View>
        ) : null}

        {/* ── Appendix ─────────────────────────────────────────── */}
        {/* Avoid `break` here: combined with the <View fixed> footer it triggers
            a known react-pdf/PDFKit overflow ("unsupported number: -9.44e+21").
            Use a strong visual banner with top spacing instead. */}
        <View>
          <Text style={styles.appendixBanner}>{sectionLabels.appendix}</Text>
        </View>

        {hasSetup ? (
          <View>
            <Text style={styles.sectionTitle}>{labels.sections.setup}</Text>
            <SetupField label={labels.setup.user_context} value={setupContext.user_context} />
            <SetupField label={labels.setup.constraints} value={setupContext.constraints} />
            <SetupField label={labels.setup.goal} value={setupContext.goal} />
            <SetupField label={labels.setup.focus_points} value={setupContext.focus_points} />
            <SetupField label={labels.setup.prfaq} value={setupContext.prfaq} monospace />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{sectionLabels.transcript}</Text>
        {rounds.map(({ r: rn, msgs }) => (
          <View key={rn} style={styles.roundBlock} minPresenceAhead={40}>
            <Text style={styles.roundHeading}>{labels.round_prefix} {rn}</Text>
            {msgs.map((m, i) => (
              <View key={i} style={styles.messageBlock} minPresenceAhead={30}>
                <Text style={styles.agentLabel}>{m.agent_role}</Text>
                <Text style={styles.messageBody}>{m.content}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footerContainer} fixed>
          <Text style={styles.footer}>{labels.footer}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
