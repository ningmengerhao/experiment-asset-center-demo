import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distUrl = pathToFileURL(path.join(projectRoot, "dist", "index.html")).href;
const screenshotMode = process.argv.includes("--screenshots");
const screenshotTargets = {
  monitor: path.join(projectRoot, "dist", "ui-check-investigation-monitor.png"),
  lineage: path.join(projectRoot, "dist", "ui-check-investigation-lineage.png"),
  rollout: path.join(projectRoot, "dist", "ui-check-investigation-rollout.png"),
  detail: path.join(projectRoot, "dist", "ui-check-investigation-detail.png"),
  mobile: path.join(projectRoot, "dist", "ui-check-investigation-mobile.png"),
};
const userTabs = [
  ["evaluate", "实验评估", "sample-planning"],
  ["seed", "分流方案", "traffic-split-evaluation"],
  ["seedHistory", "随机数放量历史", "seed-rollout-history"],
  ["check", "上线前检查", "validation-checklist"],
  ["investigate", "监控排查", "alert-queue"],
  ["list", "实验清单", "experiment-ledger"],
  ["lineage", "父子实验", "relationship-map"],
  ["rollout", "放量历史", "rollout-timeline"],
  ["myImports", "批量导入记录", "import-history"],
];
const viewports = [
  { width: 1366, height: 768 },
  { width: 585, height: 1024 },
  { width: 390, height: 844 },
];
const tableRequiredTabs = new Set(["evaluate", "seed", "seedHistory", "list", "lineage", "rollout", "myImports"]);
const expectedStageTargets = [
  ["evaluate", "实验评估"],
  ["seed", "分流方案"],
  ["check", "上线前检查"],
  ["investigate", "监控排查"],
  ["list", "实验清单"],
];
const investigationStorageKey = "experiment-asset-investigation-v1";
const defaultTimeout = 10_000;

function findEdge() {
  const candidates = [
    process.env.EDGE_PATH,
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  const edge = candidates.find((candidate) => fs.existsSync(candidate));
  if (!edge) throw new Error(`Microsoft Edge was not found. Checked: ${candidates.join(", ")}`);
  return edge;
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object", "Could not reserve a CDP port.");
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForJson(url, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : lastError}`);
}

class CdpClient {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        this.socket.close();
        reject(new Error(`Edge CDP WebSocket open timed out after ${defaultTimeout}ms.`));
      }, defaultTimeout);
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Could not connect to the Edge CDP WebSocket."));
      };
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.removeEventListener("open", onOpen);
        this.socket.removeEventListener("error", onError);
      };
      this.socket.addEventListener("open", onOpen);
      this.socket.addEventListener("error", onError);
    });
    this.socket.addEventListener("message", (event) => this.onMessage(event.data));
    this.socket.addEventListener("close", () => {
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error("Edge CDP connection closed."));
      }
      this.pending.clear();
    });
  }

  onMessage(data) {
    const message = JSON.parse(String(data));
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result ?? {});
      return;
    }
    const listeners = this.listeners.get(message.method) ?? [];
    for (const listener of listeners) listener(message.params ?? {});
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}, timeout = defaultTimeout) {
    assert.equal(this.socket.readyState, WebSocket.OPEN, `CDP socket is not open for ${method}.`);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeout}ms.`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
  }
}

function formatException(details) {
  return details?.exception?.description ?? details?.text ?? "Unknown browser exception";
}

function formatErrorTree(error, indent = "") {
  const own = error instanceof Error ? error.stack ?? error.message : String(error);
  if (!(error instanceof AggregateError)) return `${indent}${own}`;
  const children = error.errors.map((child, index) => `${indent}[${index + 1}] ${formatErrorTree(child, `${indent}  `).trimStart()}`);
  return [`${indent}${own}`, ...children].join("\n");
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

async function run() {
  assert.equal(typeof WebSocket, "function", "Node 24+ global WebSocket is required.");
  assert(fs.existsSync(path.join(projectRoot, "dist", "index.html")), "dist/index.html is missing. Run npm run build first.");

  const edgePath = findEdge();
  const port = await reservePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "experiment-asset-edge-"));
  const screenshotStagingDir = screenshotMode
    ? fs.mkdtempSync(path.join(projectRoot, "dist", ".ui-check-investigation-"))
    : null;
  let edgeProcess;
  let cdp;
  let edgeStderr = "";
  let primaryFailure = null;
  const consoleErrors = [];
  const passed = [];
  const cleanupFailures = [];

  const pass = (message) => {
    passed.push(message);
    console.log(`PASS ${message}`);
  };

  try {
    edgeProcess = spawn(edgePath, [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--allow-file-access-from-files",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-features=Translate,MediaRouter",
      "--disable-gpu",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-default-browser-check",
      "--no-first-run",
      "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    edgeProcess.stderr.setEncoding("utf8");
    edgeProcess.stderr.on("data", (chunk) => {
      edgeStderr = `${edgeStderr}${chunk}`.slice(-8_000);
    });
    edgeProcess.once("error", (error) => {
      edgeStderr = `${edgeStderr}\n${error.message}`;
    });

    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    assert(pageTarget, "Edge did not expose a page target.");
    cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.open();
    await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable"), cdp.send("Log.enable")]);

    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      consoleErrors.push(`uncaught: ${formatException(exceptionDetails)}`);
    });
    cdp.on("Runtime.consoleAPICalled", ({ type, args = [] }) => {
      if (type === "error") consoleErrors.push(`console.error: ${args.map((arg) => arg.value ?? arg.description ?? arg.type).join(" ")}`);
    });
    cdp.on("Log.entryAdded", ({ entry }) => {
      if (entry?.level === "error") consoleErrors.push(`log.error: ${entry.text}`);
    });

    const evaluate = async (expression) => {
      const response = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (response.exceptionDetails) throw new Error(formatException(response.exceptionDetails));
      return response.result?.value;
    };

    const waitFor = async (description, predicate, timeout = defaultTimeout) => {
      const deadline = Date.now() + timeout;
      let lastValue;
      while (Date.now() < deadline) {
        lastValue = await predicate();
        if (lastValue) return lastValue;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`Timed out waiting for ${description}. Last value: ${JSON.stringify(lastValue)}`);
    };

    const openUrl = async (url) => {
      const response = await cdp.send("Page.navigate", { url });
      if (response.errorText) throw new Error(`Navigation failed: ${response.errorText}`);
      await waitFor("React application root", () => evaluate(`document.readyState === "complete" && Boolean(document.querySelector("#root > *"))`));
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    const physicalClick = async (selector) => {
      const target = await evaluate(`(async () => {
        const matches = [...document.querySelectorAll(${JSON.stringify(selector)})];
        if (matches.length !== 1) return { error: "expected exactly one match, found " + matches.length };
        const element = matches[0];
        if (!(element instanceof HTMLElement)) return { error: "target is not an HTMLElement" };
        const interactive = /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(element.tagName)
          || element.getAttribute("role") === "button"
          || element.isContentEditable;
        if (!interactive) return { error: "target is not an interactive element" };
        if (("disabled" in element && element.disabled) || element.getAttribute("aria-disabled") === "true") {
          return { error: "target is disabled" };
        }
        element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || rect.width <= 0 || rect.height <= 0) {
          return { error: "target is not visible" };
        }
        const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
        const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
        const hit = document.elementFromPoint(x, y);
        if (!hit || !(hit === element || element.contains(hit))) {
          return { error: "target is covered by " + (hit?.tagName ?? "nothing") };
        }
        return { x, y };
      })()`);
      assert(!target?.error, `Cannot click ${selector}: ${target?.error ?? "unknown target error"}`);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y });
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", buttons: 1, clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y, button: "left", buttons: 0, clickCount: 1 });
    };

    const typeText = async (selector, text) => {
      await physicalClick(selector);
      await cdp.send("Input.insertText", { text });
    };

    const setViewport = async ({ width, height }) => {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    };

    const captureScreenshot = async (name) => {
      const finalOutputPath = screenshotTargets[name];
      assert(finalOutputPath, `Unknown screenshot target: ${name}`);
      const outputPath = screenshotStagingDir
        ? path.join(screenshotStagingDir, path.basename(finalOutputPath))
        : finalOutputPath;
      await evaluate("window.scrollTo({ top: 0, left: 0, behavior: 'instant' })");
      const neutralPoint = await evaluate(`(() => {
        const main = document.querySelector(".main");
        if (!(main instanceof HTMLElement)) return { error: "main content is missing" };
        const rect = main.getBoundingClientRect();
        const candidates = [
          [rect.right - 24, rect.top + 24],
          [rect.right - 24, rect.top + 80],
          [rect.left + 24, rect.top + 24],
          [rect.left + rect.width / 2, rect.top + 24],
        ];
        for (const [rawX, rawY] of candidates) {
          const x = Math.max(1, Math.min(innerWidth - 2, rawX));
          const y = Math.max(1, Math.min(innerHeight - 2, rawY));
          const hit = document.elementFromPoint(x, y);
          const interactive = hit?.closest("button, a, input, select, textarea, [role=button], [contenteditable=true]");
          const hoverSensitive = hit?.closest(".nav-item, .monitor-alert-row, .relationship-node, .rollout-timeline-event, .data-table tr");
          if (hit && !interactive && !hoverSensitive) return { x, y };
        }
        return { error: "no neutral pointer target in main content" };
      })()`);
      assert(!neutralPoint?.error, `Cannot clear hover state before ${name}: ${neutralPoint?.error ?? "unknown target error"}`);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: neutralPoint.x, y: neutralPoint.y });
      await evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
      await new Promise((resolve) => setTimeout(resolve, 50));
      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const png = Buffer.from(data, "base64");
      assert(png.length > 10_000, `${path.basename(outputPath)} is unexpectedly small (${png.length} bytes).`);
      assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path.basename(outputPath)} is not a PNG file.`);
      fs.writeFileSync(outputPath, png);
      assert(fs.statSync(outputPath).size === png.length, `${path.basename(outputPath)} was not written completely.`);
      console.log(`SCREENSHOT ${path.relative(projectRoot, finalOutputPath)} (${png.length} bytes)`);
    };

    const seedInvestigationContext = async () => evaluate(`sessionStorage.setItem(${JSON.stringify(investigationStorageKey)}, JSON.stringify({
      caseId: "CASE-260820-004",
      experimentId: "EXP-240611-017",
      alertId: "ALT-001",
      timeRange: "30d",
      entrySource: "monitor",
      evidenceFocus: "overview",
      status: "investigating",
      owner: "陈露",
      collaborators: ["赵晨"],
      resolution: "",
      updatedAt: "2026-08-20 10:30",
      actions: []
    }))`);

    const expectPageContract = async (tab, breadcrumb, core) => {
      const pageSelector = `[data-page-id="${tab}"]`;
      const coreSelector = `[data-page-core="${core}"]`;
      const navSelector = `[data-nav-id="${tab}"]`;
      await waitFor(`${tab} page contract`, () => evaluate(`document.querySelector("[data-active-page]")?.dataset.activePage === ${JSON.stringify(tab)}
        && document.querySelectorAll(${JSON.stringify(pageSelector)}).length === 1
        && document.querySelector(${JSON.stringify(pageSelector)})?.querySelector(${JSON.stringify(coreSelector)})
        && document.querySelector(${JSON.stringify(navSelector)})?.getAttribute("aria-current") === "page"
        && document.querySelector("[data-breadcrumb-page]")?.dataset.breadcrumbPage === ${JSON.stringify(tab)}`));
      const contract = await evaluate(`(() => {
        const page = document.querySelector(${JSON.stringify(pageSelector)});
        const core = page?.querySelector(${JSON.stringify(coreSelector)});
        return {
          activePage: document.querySelector("[data-active-page]")?.dataset.activePage,
          pageId: page?.dataset.pageId,
          coreId: core?.dataset.pageCore,
          navId: document.querySelector("[data-nav-id][aria-current=page]")?.dataset.navId,
          breadcrumbPage: document.querySelector("[data-breadcrumb-page]")?.dataset.breadcrumbPage,
          breadcrumb: document.querySelector("[data-breadcrumb-page] strong")?.textContent.trim(),
          pageVisible: Boolean(page && page.getClientRects().length && getComputedStyle(page).display !== "none"),
          coreVisible: Boolean(core && core.getClientRects().length && getComputedStyle(core).display !== "none"),
        };
      })()`);
      assert.deepEqual(contract, {
        activePage: tab,
        pageId: tab,
        coreId: core,
        navId: tab,
        breadcrumbPage: tab,
        breadcrumb,
        pageVisible: true,
        coreVisible: true,
      }, `${tab}: stable page contract mismatch`);
    };

    const expectTableContainment = async (tab) => {
      const tableSelector = `[data-page-id="${tab}"] table.data-table`;
      const tableResults = await evaluate(`(() => [...document.querySelectorAll(${JSON.stringify(tableSelector)})].map((table) => {
        const wrap = table.closest(".table-wrap");
        const minWidth = Number.parseFloat(getComputedStyle(table).minWidth) || 0;
        const wrapStyle = wrap ? getComputedStyle(wrap) : null;
        const wrapRect = wrap?.getBoundingClientRect();
        return {
          hasWrap: Boolean(wrap),
          localOverflow: Boolean(wrapStyle && ["auto", "scroll"].includes(wrapStyle.overflowX)),
          wrapContainsTable: Boolean(wrap && wrap.contains(table)),
          wrapInsideViewport: Boolean(wrapRect && wrapRect.left >= -1 && wrapRect.right <= innerWidth + 1),
          scrollGeometryValid: Boolean(wrap && wrap.scrollWidth >= wrap.clientWidth && wrap.clientWidth > 0),
          minWidth,
          renderedWidth: table.getBoundingClientRect().width,
        };
      }))()`);
      if (tableRequiredTabs.has(tab)) {
        assert(tableResults.length > 0, `${tab}: expected at least one data table inside the active page`);
      }
      for (const result of tableResults) {
        assert(result.hasWrap && result.localOverflow && result.wrapContainsTable, `${tab}: table overflow is not owned by .table-wrap`);
        assert(result.wrapInsideViewport && result.scrollGeometryValid, `${tab}: table wrapper escapes the viewport or has invalid scroll geometry`);
        assert(result.minWidth >= 800 && result.renderedWidth >= result.minWidth - 1, `${tab}: table is abnormally compressed (${result.renderedWidth}px / min ${result.minWidth}px)`);
      }
    };

    await setViewport(viewports[0]);
    await openUrl(distUrl);
    await expectPageContract("list", "实验清单", "experiment-ledger");
    assert.equal(await evaluate(`document.querySelector('[data-nav-id="list"]')?.textContent.trim()`), "首页", "List route must render as the home navigation item.");
    pass("empty URL opens the experiment ledger home");

    await openUrl(`${distUrl}#evaluate`);
    await seedInvestigationContext();
    await openUrl(`${distUrl}#investigate?experiment=EXP-240611-017&alert=ALT-003&range=14d`);
    await expectPageContract("investigate", "监控排查", "alert-queue");
    assert.deepEqual(await evaluate(`(() => {
      const context = document.querySelector("[data-investigation-experiment]");
      return context ? {
        experiment: context.dataset.investigationExperiment,
        alert: context.dataset.investigationAlert,
        range: context.dataset.investigationRange,
        focus: context.dataset.investigationFocus,
        status: context.querySelector("[data-investigation-status]")?.dataset.investigationStatus,
      } : null;
    })()`), {
      experiment: "EXP-240611-017",
      alert: "ALT-003",
      range: "14d",
      focus: "overview",
      status: "investigating",
    }, "Deep-link investigation context mismatch.");
    pass("deep link restores the current investigation and URL overrides");

    await physicalClick(`.current-investigation-actions [data-evidence-focus="relationship"]`);
    await waitFor("relationship hash", () => evaluate(`location.hash.startsWith("#lineage?experiment=EXP-240611-017")`));
    await expectPageContract("lineage", "父子实验", "relationship-map");
    assert.equal(await evaluate(`document.querySelector("[data-investigation-experiment]")?.dataset.investigationFocus`), "relationship");
    pass("investigation navigates to relationship evidence");

    await evaluate("history.back()");
    await waitFor("browser back to investigation", () => evaluate(`location.hash.startsWith("#investigate?experiment=EXP-240611-017")`));
    await expectPageContract("investigate", "监控排查", "alert-queue");
    assert.deepEqual(await evaluate(`(() => {
      const context = document.querySelector("[data-investigation-experiment]");
      return context ? {
        experiment: context.dataset.investigationExperiment,
        alert: context.dataset.investigationAlert,
        range: context.dataset.investigationRange,
        focus: context.dataset.investigationFocus,
      } : null;
    })()`), { experiment: "EXP-240611-017", alert: "ALT-003", range: "14d", focus: "relationship" }, "Browser back lost investigation evidence context.");
    pass("browser back restores alert and time-range context while retaining evidence focus");

    await physicalClick("#headerHelpButton");
    await waitFor("help dialog", () => evaluate(`Boolean(document.querySelector("#helpDrawer [role=dialog]"))`));
    await waitFor("help drawer close control focus", () => evaluate(`document.activeElement?.getAttribute("aria-label") === "关闭浮层"`));
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await waitFor("help dialog to close", () => evaluate(`!document.querySelector("#helpDrawer [role=dialog]")`));
    await waitFor("help trigger focus restoration", () => evaluate(`document.activeElement?.id === "headerHelpButton"`));
    pass("help drawer closes with Escape and restores focus");

    await evaluate("sessionStorage.clear(); localStorage.clear()");
    await openUrl(`${distUrl}#invalid-route`);
    await waitFor("invalid route normalization", () => evaluate(`location.hash === "#list"`));
    await expectPageContract("list", "实验清单", "experiment-ledger");
    pass("invalid route normalizes to #list");

    await physicalClick("[data-open-create-experiment]");
    await waitFor("new experiment method dialog", () => evaluate(`document.querySelector("[data-create-experiment-dialog]")?.getAttribute("aria-modal") === "true"`));
    await physicalClick('[data-create-method="direct"]');
    await waitFor("direct new experiment opens the wizard", () => evaluate(`location.hash === "#create?step=basic" && Boolean(document.querySelector("[data-page-id=\"create\"]"))`));
    assert.equal(await evaluate(`document.querySelectorAll('[data-nav-id="create"]').length`), 0, "The new experiment wizard must not appear in the sidebar.");
    await typeText('[data-create-basic="name"]', "新增首购引导");
    await typeText('[data-create-basic="owner"]', "赵晨");
    await typeText('[data-create-basic="coreMetric"]', "首购转化率");
    await typeText('[data-create-basic="guardrailMetric"]', "投诉率");
    await typeText('[data-create-basic="hypothesis"]', "新版引导可以提升首次购买转化。");
    await physicalClick("[data-create-next]");
    await waitFor("basic step saves and advances", () => evaluate(`location.hash === "#create?step=sample" && JSON.parse(localStorage.getItem("experiment-asset-create-draft-v1"))?.savedStep === "sample"`));
    await openUrl(`${distUrl}#list`);
    await physicalClick("[data-open-create-experiment]");
    await waitFor("saved new experiment draft restores", () => evaluate(`location.hash === "#create?step=sample"`));
    pass("new experiment uses a hidden, saved four-step wizard");

    await openUrl(`${distUrl}#list`);
    assert.equal(await evaluate(`document.querySelectorAll("[data-ledger-default-filters] .field").length`), 4, "Ledger must show exactly four default filters.");
    assert.equal(await evaluate(`document.querySelectorAll("[data-ledger-default-filters] [data-filter-draft]").length`), 0, "Source filtering must not appear in the default filter row.");
    assert.equal(await evaluate(`document.querySelector('[data-ledger-filter="keyword"]')?.getAttribute("placeholder")`), "实验 ID / 名称", "Ledger keyword input must display its filter name.");
    assert.equal(await evaluate(`document.querySelector('[data-ledger-filter="owner"]')?.getAttribute("list")`), "owner-options", "Ledger owner filter must offer known-owner suggestions.");
    assert.equal(await evaluate(`document.querySelectorAll("[data-ledger-filter] input, [data-ledger-default-filters] select").length`), 4, "Ledger toolbar must keep four inline filter controls.");
    assert.equal(await evaluate(`new Set([...document.querySelectorAll("[data-ledger-default-filters] input, [data-ledger-default-filters] select")].map((control) => Math.round(control.getBoundingClientRect().top))).size`), 1, "Ledger filter controls must remain on one horizontal row.");
    assert.equal(await evaluate(`getComputedStyle(document.querySelector(".ledger-filter-bar")).backgroundColor`), "rgb(255, 255, 255)", "Ledger toolbar must use a white surface distinct from the table header.");
    await typeText('[data-ledger-filter="owner"]', "陈");
    await waitFor("owner fuzzy filter", () => evaluate(`document.querySelectorAll("[data-page-id=\"list\"] .ledger-table tbody tr").length === 1`));
    await physicalClick("[data-reset-ledger]");
    await waitFor("owner filter reset", () => evaluate(`document.querySelectorAll("[data-page-id=\"list\"] .ledger-table tbody tr").length === 5`));
    await physicalClick("[data-open-filter-dialog]");
    await waitFor("filter dialog", () => evaluate(`document.querySelector("[data-filter-dialog]")?.getAttribute("aria-modal") === "true"`));
    await typeText('[data-filter-draft="sourcePlatformKeyword"]', "手动补录");
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await waitFor("filter dialog cancels with Escape", () => evaluate(`!document.querySelector("[data-filter-dialog]")`));
    assert.equal(await evaluate(`document.querySelectorAll("[data-page-id=\"list\"] .ledger-table tbody tr").length`), 5, "Cancelling filter draft must preserve the unfiltered ledger.");
    await physicalClick("[data-open-filter-dialog]");
    await typeText('[data-filter-draft="sourcePlatformKeyword"]', "手动补录");
    await physicalClick("[data-filter-dialog] .primary-button");
    await waitFor("filter dialog applies", () => evaluate(`!document.querySelector("[data-filter-dialog]")`));
    assert.equal(await evaluate(`document.querySelectorAll("[data-page-id=\"list\"] .ledger-table tbody tr").length`), 1, "Applied source filter must narrow the ledger.");
    pass("more filters supports discard and explicit apply");

    await physicalClick("[data-open-create-experiment]");
    await waitFor("new experiment import option", () => evaluate(`Boolean(document.querySelector("[data-create-experiment-dialog]"))`));
    await physicalClick('[data-create-method="import"]');
    await waitFor("upload import reuses import drawer", () => evaluate(`document.querySelector(".import-drawer")?.getAttribute("aria-modal") === "true"`));
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await waitFor("import drawer closes", () => evaluate(`!document.querySelector(".import-drawer")`));
    pass("new experiment can route to the existing upload import flow");

    for (const [targetTab, targetBreadcrumb] of expectedStageTargets) {
      await openUrl(`${distUrl}#evaluate`);
      await expectPageContract("evaluate", "实验评估", "sample-planning");
      await physicalClick(`[data-stage-target="${targetTab}"]`);
      const targetCore = userTabs.find(([tab]) => tab === targetTab)?.[2];
      assert(targetCore, `Missing core-region contract for stage target ${targetTab}`);
      await waitFor(`stage ${targetTab} hash`, () => evaluate(`location.hash === ${JSON.stringify(`#${targetTab}`)}`));
      await expectPageContract(targetTab, targetBreadcrumb, targetCore);
    }
    pass("all stage navigation controls are interactive");

    for (const viewport of viewports) {
      await setViewport(viewport);
      for (const [tab, label, core] of userTabs) {
        await openUrl(`${distUrl}#${tab}`);
        await expectPageContract(tab, label, core);
        const overflow = await evaluate(`Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth`);
        assert(overflow <= 1, `${tab}: page-level horizontal overflow is ${overflow}px at ${viewport.width}x${viewport.height}.`);
        await expectTableContainment(tab);
        if (viewport.width === 390) {
          await waitFor(`${tab} active navigation item to be at least 80% visible in the mobile rail`, () => evaluate(`(() => {
              const active = document.querySelector(".nav-item.active");
              const nav = document.querySelector(".sidebar-nav");
              if (!active || !nav) return false;
              const activeRect = active.getBoundingClientRect();
              const navRect = nav.getBoundingClientRect();
              const overlapWidth = Math.max(0, Math.min(activeRect.right, navRect.right) - Math.max(activeRect.left, navRect.left));
              const overlapHeight = Math.max(0, Math.min(activeRect.bottom, navRect.bottom) - Math.max(activeRect.top, navRect.top));
              const visibleRatio = activeRect.width * activeRect.height > 0
                ? (overlapWidth * overlapHeight) / (activeRect.width * activeRect.height)
                : 0;
              return visibleRatio >= 0.8;
            })()`), 2_000);
        }
      }
      pass(`${viewport.width}x${viewport.height}: all ordinary-user pages fit the viewport`);
    }

    await setViewport(viewports[0]);
    await openUrl(`${distUrl}#evaluate`);
    for (const [tab, label, core] of userTabs) {
      await physicalClick(`[data-nav-id="${tab}"]`);
      await waitFor(`${label} navigation click`, () => evaluate(`location.hash === ${JSON.stringify(`#${tab}`)}`));
      await expectPageContract(tab, label, core);
    }
    pass("all ordinary-user left navigation entries are clickable and hash-synchronized");

    if (screenshotMode) {
      await setViewport({ width: 1366, height: 768 });
      await openUrl(`${distUrl}#evaluate`);
      await seedInvestigationContext();

      await openUrl(`${distUrl}#investigate?experiment=EXP-240611-017&alert=ALT-003&range=14d&focus=overview`);
      await expectPageContract("investigate", "监控排查", "alert-queue");
      await waitFor("monitor screenshot investigation context", () => evaluate(`document.querySelector("[data-investigation-experiment]")?.dataset.investigationExperiment === "EXP-240611-017"`));
      await captureScreenshot("monitor");

      await physicalClick(`.current-investigation-actions [data-evidence-focus="relationship"]`);
      await waitFor("lineage screenshot state", () => evaluate(`location.hash.startsWith("#lineage?experiment=EXP-240611-017")`));
      await expectPageContract("lineage", "父子实验", "relationship-map");
      await captureScreenshot("lineage");

      await physicalClick(`[data-nav-id="investigate"]`);
      await waitFor("investigation page before rollout screenshot", () => evaluate(`location.hash.startsWith("#investigate?experiment=EXP-240611-017")`));
      await physicalClick(`.current-investigation-actions [data-evidence-focus="rollout"]`);
      await waitFor("rollout screenshot state", () => evaluate(`location.hash.startsWith("#rollout?experiment=EXP-240611-017")`));
      await expectPageContract("rollout", "放量历史", "rollout-timeline");
      await captureScreenshot("rollout");

      await openUrl(`${distUrl}#list`);
      await expectPageContract("list", "实验清单", "experiment-ledger");
      await physicalClick(`[data-page-id="list"] .ledger-table tbody tr:first-child .row-actions button:first-child`);
      await waitFor("experiment detail dialog", () => evaluate(`document.querySelector(".detail-drawer[role=dialog]")?.getAttribute("aria-modal") === "true"`));
      assert.equal(await evaluate(`document.querySelector("#detail-drawer-title")?.textContent.trim()`), "新版首购引导流程", "Detail screenshot opened the wrong experiment.");
      await captureScreenshot("detail");

      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
      await waitFor("detail dialog to close before mobile screenshot", () => evaluate(`!document.querySelector(".detail-drawer[role=dialog]")`));

      await setViewport({ width: 390, height: 844 });
      await openUrl(`${distUrl}#investigate?experiment=EXP-240611-017&alert=ALT-003&range=14d&focus=overview`);
      await expectPageContract("investigate", "监控排查", "alert-queue");
      await waitFor("mobile active navigation visibility", () => evaluate(`(() => {
        const active = document.querySelector(".nav-item.active");
        const nav = document.querySelector(".sidebar-nav");
        if (!active || !nav) return false;
        const activeRect = active.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        const overlapWidth = Math.max(0, Math.min(activeRect.right, navRect.right) - Math.max(activeRect.left, navRect.left));
        const overlapHeight = Math.max(0, Math.min(activeRect.bottom, navRect.bottom) - Math.max(activeRect.top, navRect.top));
        return activeRect.width * activeRect.height > 0 && (overlapWidth * overlapHeight) / (activeRect.width * activeRect.height) >= 0.8;
      })()`), 2_000);
      await captureScreenshot("mobile");

      assert(screenshotStagingDir, "Screenshot staging directory is missing.");
      for (const outputPath of Object.values(screenshotTargets)) {
        const stagedPath = path.join(screenshotStagingDir, path.basename(outputPath));
        assert(fs.existsSync(stagedPath) && fs.statSync(stagedPath).size > 10_000, `${path.basename(outputPath)} is missing or empty.`);
      }
      for (const outputPath of Object.values(screenshotTargets)) {
        const stagedPath = path.join(screenshotStagingDir, path.basename(outputPath));
        fs.renameSync(stagedPath, outputPath);
      }
      pass("five investigation workflow screenshots are current and non-empty");
    }

    assert.deepEqual(consoleErrors, [], `Browser console errors:\n${consoleErrors.join("\n")}`);
    pass("browser console error count is zero");
    console.log(`Browser verification passed (${passed.length}/${passed.length}).`);
  } catch (error) {
    if (edgeStderr.trim()) console.error(`Edge stderr (tail):\n${edgeStderr.trim()}`);
    primaryFailure = error;
  } finally {
    if (cdp) {
      try {
        await cdp.send("Browser.close", {}, 2_000);
      } catch {
        // The browser can close the socket before acknowledging Browser.close.
      }
      cdp.close();
    }
    if (edgeProcess?.pid && edgeProcess.exitCode === null) {
      await Promise.race([
        new Promise((resolve) => edgeProcess.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 1_500)),
      ]);
    }
    if (edgeProcess?.pid && edgeProcess.exitCode === null) {
      const taskkill = spawnSync("taskkill", ["/PID", String(edgeProcess.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, timeout: 5_000 });
      if (taskkill.status !== 0 && isProcessAlive(edgeProcess.pid)) {
        cleanupFailures.push(`taskkill failed for Edge PID ${edgeProcess.pid} with status ${taskkill.status}`);
      }
    }
    edgeProcess?.stderr?.destroy();
    edgeProcess?.unref();
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
    } catch (error) {
      cleanupFailures.push(`Could not remove temporary Edge profile ${userDataDir}: ${error instanceof Error ? error.message : error}`);
    }
    if (fs.existsSync(userDataDir)) cleanupFailures.push(`Temporary Edge profile still exists: ${userDataDir}`);
    if (screenshotStagingDir) {
      try {
        fs.rmSync(screenshotStagingDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      } catch (error) {
        cleanupFailures.push(`Could not remove screenshot staging directory ${screenshotStagingDir}: ${error instanceof Error ? error.message : error}`);
      }
      if (fs.existsSync(screenshotStagingDir)) cleanupFailures.push(`Screenshot staging directory still exists: ${screenshotStagingDir}`);
    }
  }

  if (primaryFailure && cleanupFailures.length) {
    throw new AggregateError([primaryFailure, ...cleanupFailures.map((message) => new Error(message))], "Browser verification and Edge cleanup failed");
  }
  if (primaryFailure) throw primaryFailure;
  if (cleanupFailures.length) throw new AggregateError(cleanupFailures.map((message) => new Error(message)), "Edge cleanup failed");
}

run().then(
  () => process.exit(0),
  (error) => {
    console.error(formatErrorTree(error));
    process.exit(1);
  },
);
