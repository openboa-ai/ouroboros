export const OPERATOR_DESIGN_TOKENS = {
  radius: {
    control: "var(--radius-md)",
    field: "var(--radius-md)",
    panel: "var(--radius-lg)"
  },
  surface: {
    panel: "min-w-0 max-w-full overflow-visible rounded-lg bg-card text-card-foreground ring-1 ring-border/80 shadow-sm",
    panelMuted: "min-w-0 max-w-full overflow-visible rounded-lg bg-card/80 text-card-foreground ring-1 ring-border/70",
    callout: "min-w-0 max-w-full overflow-visible rounded-lg border-border/70 bg-muted/55 py-2",
    dataTable: "min-w-0 max-w-full overflow-hidden rounded-lg bg-card text-card-foreground ring-1 ring-border/70",
    dataTableHeaderRow: "bg-muted/45 hover:bg-muted/45",
    dataTableInteractiveRow: "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    dataTableRow: "align-top data-[state=selected]:bg-muted/70",
    evidenceBlock: "min-w-0 max-w-full overflow-visible rounded-lg bg-card text-card-foreground ring-1 ring-border/70",
    evidenceStatus: "min-w-0 max-w-full overflow-visible rounded-md bg-muted/55 py-2 ring-1 ring-border/60",
    emptyState: "min-w-0 max-w-full overflow-visible rounded-lg border-border/70 bg-muted/40 px-0 py-2",
    field: "grid min-w-0 max-w-full gap-1 overflow-visible border-t border-border/70 bg-transparent px-0 py-3 first:border-t-0",
    selectionItem: "grid h-auto min-w-0 max-w-full justify-start gap-1 rounded-lg px-3 py-3 text-left text-sm ring-1 transition",
    selectionItemActive: "bg-accent text-accent-foreground ring-primary/25",
    selectionItemIdle: "bg-card ring-border/70 hover:bg-muted/70",
    stat: "min-w-0 max-w-full",
    tabBadge: "rounded-sm bg-muted/70 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground"
  },
  typography: {
    label: "max-w-full break-words text-[11px] font-medium uppercase leading-none tracking-normal text-muted-foreground [overflow-wrap:anywhere]",
    value: "min-w-0 max-w-full break-words text-sm font-medium leading-snug [overflow-wrap:anywhere]",
    calloutValue: "min-w-0 max-w-full break-words text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere] sm:text-base",
    detail: "min-w-0 max-w-full break-words text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]",
    statValue: "min-w-0 max-w-full break-words text-lg font-semibold leading-tight tracking-normal [overflow-wrap:anywhere] sm:text-xl",
    tableCell: "min-w-0 max-w-full whitespace-normal break-words align-top text-sm leading-snug [overflow-wrap:anywhere]",
    tableHead: "min-w-0 max-w-full whitespace-normal break-words align-top text-[11px] font-medium uppercase tracking-normal text-muted-foreground [overflow-wrap:anywhere]"
  },
  layout: {
    actionRow: "flex min-w-0 max-w-full flex-wrap items-center gap-2",
    appHeader: "flex h-12 min-w-0 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:gap-3 sm:px-4",
    appHeaderSeparator: "h-5 bg-border",
    appMain: "min-h-[calc(100svh-3rem)] min-w-0 overflow-x-hidden bg-background p-3 sm:p-4 lg:p-5",
    page: "mx-auto flex w-full min-w-0 max-w-[1500px] flex-col gap-4",
    pageHeader: "flex min-w-0 max-w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
    pageHeaderCopy: "grid min-w-0 max-w-full gap-1",
    pageHeaderTitle: "max-w-full break-words font-heading text-2xl font-semibold leading-tight tracking-normal text-foreground [overflow-wrap:anywhere] sm:text-3xl",
    sectionHeader: "grid min-w-0 max-w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start",
    sectionHeaderCopy: "grid min-w-0 max-w-full gap-1",
    sectionTitle: "max-w-full break-words text-base font-semibold leading-snug tracking-normal text-foreground [overflow-wrap:anywhere]",
    section: "grid min-w-0 max-w-full gap-3",
    calloutContent: "grid min-w-0 max-w-full gap-1.5 px-3",
    emptyStateContent: "grid min-w-0 max-w-full gap-1 px-0",
    evidenceBlockContent: "grid min-w-0 max-w-full gap-3",
    evidenceStatusContent: "grid min-w-0 max-w-full gap-1 px-3",
    statContent: "grid min-w-0 max-w-full gap-1",
    fieldGrid: "grid min-w-0 max-w-full gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
    denseFieldGrid: "grid min-w-0 max-w-full gap-2 sm:grid-cols-2 xl:grid-cols-4",
    dataTable: "table-fixed",
    evidenceRow: "grid min-w-0 max-w-full grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2 [overflow-wrap:anywhere] [&>*]:min-w-0 [&>*]:max-w-full [&>*]:break-words",
    evidenceStack: "grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-2",
    statGrid: "grid min-w-0 max-w-full grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2"
  }
} as const;
