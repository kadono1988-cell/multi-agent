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
  border: "#d1d5db",
  bgSoft: "#f3f4f6",
  tableRowAlt: "#f9fafb",
  agentBar: "#1e40af",
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
    marginBottom: 20,
    padding: 12,
    backgroundColor: COLORS.bgSoft,
    borderRadius: 4,
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
    marginTop: 10,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: COLORS.border,
    color: COLORS.accent,
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
    borderRadius: 3,
  },

  roundBlock: {
    marginTop: 14,
    marginBottom: 8,
  },
  roundHeading: {
    fontSize: 14,
    marginBottom: 10,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 10,
    paddingRight: 10,
    backgroundColor: COLORS.accent,
    color: "#ffffff",
    borderRadius: 3,
  },

  messageBlock: {
    marginBottom: 12,
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

  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: COLORS.muted,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopStyle: "solid",
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 48,
    fontSize: 8,
    color: COLORS.muted,
  },
});

function SetupField({ label, value, monospace = false }) {
  if (!value || !value.trim()) return null;
  return (
    <View style={styles.setupField}>
      <Text style={styles.setupLabel}>{label}</Text>
      <Text style={monospace ? styles.prfaqValue : styles.setupValue}>{value}</Text>
    </View>
  );
}

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export function SessionPDF({ project, session, messages, setupContext, labels }) {
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

        {rounds.map(({ r, msgs }, idx) => (
          <View key={r} style={styles.roundBlock} {...(idx > 0 ? { break: true } : {})}>
            <Text style={styles.roundHeading}>Round {r}</Text>
            {msgs.map((m, i) => (
              <View key={i} style={styles.messageBlock}>
                <Text style={styles.agentLabel}>{m.agent_role}</Text>
                <Text style={styles.messageBody}>{m.content}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          {labels.footer}
        </Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
