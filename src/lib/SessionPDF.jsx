import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "NotoSansJP",
  src: "/fonts/NotoSansJP-Regular.ttf",
});

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "NotoSansJP",
    fontSize: 10,
    color: "#111",
    lineHeight: 1.5,
  },
  title: {
    fontSize: 18,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#555",
    marginBottom: 6,
  },
  metaBlock: {
    marginTop: 8,
    marginBottom: 16,
    padding: 10,
    backgroundColor: "#f6f8fa",
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    width: 70,
    fontSize: 9,
    color: "#666",
  },
  metaValue: {
    flex: 1,
    fontSize: 9,
  },
  sectionTitle: {
    fontSize: 11,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: "1pt solid #ccc",
  },
  setupField: {
    marginBottom: 6,
  },
  setupLabel: {
    fontSize: 8,
    color: "#777",
    marginBottom: 2,
  },
  setupValue: {
    fontSize: 9,
    lineHeight: 1.4,
  },
  roundHeading: {
    fontSize: 13,
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: "2pt solid #4a90e2",
    color: "#1a4d8f",
  },
  messageBlock: {
    marginBottom: 10,
    paddingLeft: 8,
    borderLeft: "2pt solid #e0e0e0",
  },
  agentHeader: {
    fontSize: 10,
    marginBottom: 3,
    color: "#2c3e50",
  },
  agentContent: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#222",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 48,
    fontSize: 8,
    color: "#999",
  },
});

function SetupField({ label, value }) {
  if (!value || !value.trim()) return null;
  return (
    <View style={styles.setupField}>
      <Text style={styles.setupLabel}>{label}</Text>
      <Text style={styles.setupValue}>{value}</Text>
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
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.subtitle}>{labels.subtitle}</Text>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{labels.meta.project}</Text>
            <Text style={styles.metaValue}>{project?.name || ""}</Text>
          </View>
          {project?.client ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{labels.meta.client}</Text>
              <Text style={styles.metaValue}>{project.client}</Text>
            </View>
          ) : null}
          {project?.budget ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{labels.meta.budget}</Text>
              <Text style={styles.metaValue}>{project.budget}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{labels.meta.theme}</Text>
            <Text style={styles.metaValue}>{session?.theme_type || ""}</Text>
          </View>
          {createdAt ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{labels.meta.date}</Text>
              <Text style={styles.metaValue}>{createdAt}</Text>
            </View>
          ) : null}
        </View>

        {hasSetup ? (
          <View>
            <Text style={styles.sectionTitle}>{labels.sections.setup}</Text>
            <SetupField label={labels.setup.user_context} value={setupContext.user_context} />
            <SetupField label={labels.setup.constraints} value={setupContext.constraints} />
            <SetupField label={labels.setup.goal} value={setupContext.goal} />
            <SetupField label={labels.setup.focus_points} value={setupContext.focus_points} />
            <SetupField label={labels.setup.prfaq} value={setupContext.prfaq} />
          </View>
        ) : null}

        {rounds.map(({ r, msgs }) => (
          <View key={r} wrap={false}>
            <Text style={styles.roundHeading}>
              {labels.round_prefix} {r}
            </Text>
            {msgs.map((m, i) => (
              <View key={i} style={styles.messageBlock} wrap={false}>
                <Text style={styles.agentHeader}>
                  [{m.agent_role}]
                </Text>
                <Text style={styles.agentContent}>{m.content}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
        <Text style={styles.footer} fixed>
          {labels.footer}
        </Text>
      </Page>
    </Document>
  );
}
