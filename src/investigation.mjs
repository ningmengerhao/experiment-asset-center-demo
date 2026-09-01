export const INVESTIGATION_STORAGE_KEY = "experiment-asset-investigation-v1";

export const allowedTransitions = Object.freeze({
  idle: Object.freeze(["investigating"]),
  investigating: Object.freeze(["collaborating", "resolved"]),
  collaborating: Object.freeze(["investigating", "resolved"]),
  resolved: Object.freeze(["investigating", "closed"]),
  closed: Object.freeze([]),
});

const tabs = new Set([
  "create",
  "list",
  "investigate",
  "lineage",
  "rollout",
  "seedHistory",
  "myImports",
  "importReview",
  "governance",
  "permission",
]);
const timeRanges = new Set(["7d", "14d", "30d"]);
const evidenceFocuses = new Set(["overview", "relationship", "rollout", "seed", "validation", "metric"]);
const entrySources = new Set(["monitor", "list", "relationship", "rollout", "validation", "detail"]);
const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isSafeIdentifier(value) {
  return typeof value === "string" && safeIdentifier.test(value);
}

function fallbackLocation() {
  return { tab: "list", context: null };
}

function decodeQuery(query) {
  const params = new Map();

  if (!query) return params;

  try {
    for (const part of query.split("&")) {
      if (!part) continue;
      const separator = part.indexOf("=");
      const rawKey = separator === -1 ? part : part.slice(0, separator);
      const rawValue = separator === -1 ? "" : part.slice(separator + 1);
      const key = decodeURIComponent(rawKey.replace(/\+/g, " "));
      const value = decodeURIComponent(rawValue.replace(/\+/g, " "));
      if (["experiment", "alert", "range", "focus"].includes(key)) params.set(key, value);
    }
  } catch {
    return null;
  }

  return params;
}

function isValidContext(value) {
  return Boolean(
    value
      && typeof value === "object"
      && typeof value.caseId === "string"
      && isSafeIdentifier(value.experimentId)
      && (value.alertId === undefined || value.alertId === "" || isSafeIdentifier(value.alertId))
      && timeRanges.has(value.timeRange)
      && entrySources.has(value.entrySource)
      && evidenceFocuses.has(value.evidenceFocus)
      && Object.hasOwn(allowedTransitions, value.status)
      && typeof value.owner === "string"
      && Array.isArray(value.collaborators)
      && value.collaborators.every((item) => typeof item === "string")
      && typeof value.resolution === "string"
      && typeof value.updatedAt === "string"
      && Array.isArray(value.actions)
      && value.actions.every(isValidAction),
  );
}

function isValidAction(action) {
  return Boolean(
    action
      && typeof action === "object"
      && typeof action.id === "string"
      && action.id.length > 0
      && Object.hasOwn(allowedTransitions, action.from)
      && Object.hasOwn(allowedTransitions, action.to)
      && allowedTransitions[action.from].includes(action.to)
      && typeof action.operator === "string"
      && typeof action.note === "string"
      && typeof action.occurredAt === "string",
  );
}

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  return typeof sessionStorage === "undefined" ? null : sessionStorage;
}

export function parseInvestigationLocation(hash) {
  if (typeof hash !== "string") return fallbackLocation();

  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const separator = fragment.indexOf("?");
  const tab = separator === -1 ? fragment : fragment.slice(0, separator);
  const query = separator === -1 ? "" : fragment.slice(separator + 1);

  if (!tabs.has(tab)) return fallbackLocation();

  const params = decodeQuery(query);
  if (!params) return fallbackLocation();

  const experimentId = params.get("experiment");
  if (!experimentId) return { tab, context: null };
  if (!isSafeIdentifier(experimentId)) return fallbackLocation();

  const alertId = params.get("alert");
  if (alertId !== undefined && alertId !== "" && !isSafeIdentifier(alertId)) return fallbackLocation();

  const range = params.get("range") ?? "14d";
  const focus = params.get("focus") ?? "overview";
  if (!timeRanges.has(range) || !evidenceFocuses.has(focus)) return fallbackLocation();

  return {
    tab,
    context: {
      caseId: "",
      experimentId,
      ...(alertId ? { alertId } : {}),
      timeRange: range,
      entrySource: "monitor",
      evidenceFocus: focus,
      status: "idle",
      owner: "",
      collaborators: [],
      resolution: "",
      updatedAt: "",
      actions: [],
    },
  };
}

function isInvalidInvestigationHash(hash, parsed) {
  if (typeof hash !== "string") return false;

  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!fragment) return false;

  const separator = fragment.indexOf("?");
  const tab = separator === -1 ? fragment : fragment.slice(0, separator);
  const query = separator === -1 ? "" : fragment.slice(separator + 1);
  if (!tab || !tabs.has(tab)) return true;

  const params = decodeQuery(query);
  if (!params) return true;

  // A valid contextual URL always produces a context. Unknown non-contextual
  // parameters remain a normal tab location instead of becoming a hard error.
  return params.has("experiment") && parsed.context === null;
}

function contextsAreEquivalent(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeStoredContextWithUrl(stored, urlContext, params) {
  const context = { ...stored };

  if (params.has("alert")) {
    if (urlContext.alertId) context.alertId = urlContext.alertId;
    else delete context.alertId;
  }
  if (params.has("range")) context.timeRange = urlContext.timeRange;
  if (params.has("focus")) context.evidenceFocus = urlContext.evidenceFocus;

  return context;
}

export function recoverInvestigationLocation(hash, storage) {
  const parsed = parseInvestigationLocation(hash);
  const stored = loadInvestigationContext(storage);
  const invalidHash = isInvalidInvestigationHash(hash, parsed);

  if (invalidHash) {
    return { tab: "list", context: stored, invalidHash: true, shouldPersist: false };
  }

  if (!parsed.context) {
    return { tab: parsed.tab, context: stored, invalidHash: false, shouldPersist: false };
  }

  if (!stored || stored.experimentId !== parsed.context.experimentId) {
    return { tab: parsed.tab, context: parsed.context, invalidHash: false, shouldPersist: true };
  }

  const fragment = typeof hash === "string" ? hash.replace(/^#/, "") : "";
  const query = fragment.includes("?") ? fragment.slice(fragment.indexOf("?") + 1) : "";
  const params = decodeQuery(query) ?? new Map();
  const context = mergeStoredContextWithUrl(stored, parsed.context, params);
  return {
    tab: parsed.tab,
    context,
    invalidHash: false,
    shouldPersist: !contextsAreEquivalent(stored, context),
  };
}

export function buildInvestigationHash(tab, context = null) {
  const safeTab = tabs.has(tab) ? tab : "list";
  if (!context || !isSafeIdentifier(context.experimentId)) return `#${safeTab}`;

  const params = new URLSearchParams({ experiment: context.experimentId });
  if (isSafeIdentifier(context.alertId)) params.set("alert", context.alertId);
  if (timeRanges.has(context.timeRange)) params.set("range", context.timeRange);
  if (evidenceFocuses.has(context.evidenceFocus)) params.set("focus", context.evidenceFocus);
  return `#${safeTab}?${params.toString()}`;
}

export function mergeEvidenceEvents(events) {
  const seen = new Set();
  return events
    .filter((event) => event && typeof event.id === "string" && !seen.has(event.id) && seen.add(event.id))
    .map((event, index) => ({ event, index }))
    .sort((left, right) => right.event.occurredAt.localeCompare(left.event.occurredAt) || left.index - right.index)
    .map(({ event }) => event);
}

export function transitionInvestigation(context, next, note) {
  if (!isValidContext(context) || !allowedTransitions[context.status]?.includes(next)) {
    throw new Error(`invalid transition: ${context?.status ?? "unknown"} -> ${next}`);
  }

  const occurredAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  const action = {
    id: `action-${context.actions.length + 1}`,
    from: context.status,
    to: next,
    operator: context.owner,
    note: typeof note === "string" ? note : "",
    occurredAt,
  };

  return {
    ...context,
    status: next,
    resolution: next === "resolved" || next === "closed" ? action.note : context.resolution,
    updatedAt: occurredAt,
    actions: [...context.actions, action],
  };
}

export function loadInvestigationContext(storage) {
  try {
    const value = resolveStorage(storage)?.getItem(INVESTIGATION_STORAGE_KEY);
    if (!value) return null;
    const context = JSON.parse(value);
    return isValidContext(context) ? context : null;
  } catch {
    return null;
  }
}

export function saveInvestigationContext(context, storage) {
  try {
    const target = resolveStorage(storage);
    if (!target) return;
    if (context === null) {
      target.removeItem(INVESTIGATION_STORAGE_KEY);
      return;
    }
    if (isValidContext(context)) target.setItem(INVESTIGATION_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Storage can be disabled by the browser's privacy settings.
  }
}
