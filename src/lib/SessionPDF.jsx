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

  // Minimal textual variants — boxed/coloured callouts caused PDFKit
  // overflow on real 5-round content. Restore decoration incrementally
  // once we have a clean baseline.
  calloutBox: {
    marginTop: 2,
    marginBottom: 8,
    paddingLeft: 6,
  },
  calloutSummary: { color: COLORS.accent },
  calloutDecision: { color: COLORS.decision },
  calloutAgree: { color: COLORS.positive },
  calloutWarn: { color: COLORS.warn },
  calloutLabel: {
    fontSize: 9,
    color: COLORS.muted,
    marginBottom: 4,
  },
  calloutHeadline: {
    fontSize: 11,
    marginBottom: 4,
    color: COLORS.text,
  },

  // Action item list — flex/bordered table caused layout overflow on
  // real data, so render as plain bullets with role label inline.
  actionItemRow: {
    marginBottom: 4,
    paddingLeft: 4,
    fontSize: 10,
    lineHeight: 1.55,
  },
  actionOwner: {
    color: COLORS.accent,
  },
  actionDue: {
    color: COLORS.muted,
    fontSize: 9,
  },

  appendixBanner: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 13,
    color: COLORS.muted,
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
              <View style={styles.calloutBox}>
                <Text style={[styles.calloutLabel, styles.calloutSummary]}>{reportLabels.executive_summary}</Text>
                <Text style={styles.paragraph}>{r.executive_summary}</Text>
              </View>
            ) : null}

            {r.conclusion ? (
              <View style={styles.calloutBox}>
                <Text style={[styles.calloutLabel, styles.calloutDecision]}>{reportLabels.conclusion}</Text>
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

            <Text style={[styles.subsectionTitle, styles.calloutAgree]}>{reportLabels.agreements}</Text>
            <BulletList items={r.agreements} emptyHint={reportLabels.empty_agreements} />

            <Text style={[styles.subsectionTitle, styles.calloutWarn]}>{reportLabels.disagreements}</Text>
            <BulletList items={r.disagreements} emptyHint={reportLabels.empty_disagreements} />

            <Text style={[styles.subsectionTitle, styles.calloutDecision]}>{reportLabels.final_decision}</Text>
            {r.final_decision?.headline ? (
              <Text style={styles.calloutHeadline}>{r.final_decision.headline}</Text>
            ) : null}
            <BulletList items={r.final_decision?.rationale} emptyHint={reportLabels.empty_rationale} />

            <Text style={styles.subsectionTitle}>{reportLabels.action_items}</Text>
            {(r.action_items && r.action_items.length > 0) ? (
              <View>
                {r.action_items.map((a, i) => (
                  <Text key={i} style={styles.actionItemRow}>
                    <Text style={styles.actionOwner}>[{a.owner || '—'}] </Text>
                    {a.task || '—'}
                    {a.due ? ` ` : ''}
                    {a.due ? <Text style={styles.actionDue}>({a.due})</Text> : null}
                  </Text>
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
