import {
  RUNTIME_HOST,
  RUNTIME_PORT,
  blockedTargetSchema,
  matchesBlockedDomain,
  runtimeConfigSyncSchema,
  type BlockedTarget
} from "@clockedin/shared";

const NATIVE_HOST = "dev.clockedin.native";
const STORAGE_KEY = "clockedin.runtimeConfig";

type RuntimeConfig = {
  blockedTargets: BlockedTarget[];
  sessionActive: boolean;
  sessionId: string | null;
};

let runtimeConfig: RuntimeConfig = {
  blockedTargets: [],
  sessionActive: false,
  sessionId: null
};

const runtimeEndpoint = `http://${RUNTIME_HOST}:${RUNTIME_PORT}`;

const syncLocalState = async (config: RuntimeConfig) => {
  runtimeConfig = config;
  await chrome.storage.local.set({
    [STORAGE_KEY]: config
  });
};

const parseConfig = (payload: unknown) => runtimeConfigSyncSchema.parse(payload).payload;

const postToDesktop = async (message: unknown) => {
  const response = await fetch(`${runtimeEndpoint}/runtime/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    throw new Error(`Runtime server returned ${response.status}`);
  }

  return (await response.json()) as { config?: unknown };
};

const sendNativeMessage = (message: unknown) =>
  new Promise<unknown>((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, message as object, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });

const sendRuntimeMessage = async (message: unknown) => {
  try {
    return await sendNativeMessage(message);
  } catch {
    return postToDesktop(message);
  }
};

const syncConfig = async () => {
  try {
    const response = await fetch(`${runtimeEndpoint}/runtime/config`);
    const body = await response.json();
    await syncLocalState(parseConfig(body));
  } catch {
    try {
      const body = (await sendRuntimeMessage({
        type: "HELLO",
        source: "extension-host"
      })) as { config?: unknown };

      if (body?.config) {
        await syncLocalState(parseConfig(body.config));
      }
    } catch {
      await syncLocalState({
        blockedTargets: [],
        sessionActive: false,
        sessionId: null
      });
    }
  }
};

const getWebsiteTargets = () => runtimeConfig.blockedTargets.filter((target) => target.kind === "website");

const shouldBlock = (url: string) => runtimeConfig.sessionActive && getWebsiteTargets().some((target) => matchesBlockedDomain(url, target));

const findTarget = (url: string) => getWebsiteTargets().find((target) => matchesBlockedDomain(url, target));

const redirectTab = async (tabId: number, target: BlockedTarget, url: string) => {
  const blockPageUrl = new URL(chrome.runtime.getURL("block.html"));
  blockPageUrl.searchParams.set("target", target.label);
  blockPageUrl.searchParams.set("origin", url);
  await chrome.tabs.update(tabId, { url: blockPageUrl.toString() });
};

const interruptBrowserWindow = async (tabId: number) => {
  let windowId: number | undefined;

  try {
    const tab = await chrome.tabs.get(tabId);
    windowId = tab.windowId;
  } catch (error) {
    console.warn("Clockedin could not resolve the tab window before interrupting.", error);
  }

  if (typeof windowId === "number") {
    try {
      await chrome.windows.remove(windowId);
      return;
    } catch (error) {
      console.warn("Clockedin could not close the blocked Brave window, falling back to tab close.", error);
    }
  }

  try {
    await chrome.tabs.remove(tabId);
  } catch (error) {
    console.warn("Clockedin could not close the blocked tab, falling back to the block page.", error);
  }
};

const emitAttempt = async (target: BlockedTarget, url: string) => {
  try {
    const response = (await sendRuntimeMessage({
      type: "ATTEMPT_DETECTED",
      source: "extension-host",
      payload: {
        targetId: target.id,
        targetLabel: target.label,
        platform: "macos",
        context: {
          url
        }
      }
    })) as { config?: unknown };

    if (response?.config) {
      await syncLocalState(parseConfig(response.config));
    }
  } catch (error) {
    console.warn("Clockedin extension could not reach the desktop runtime.", error);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void syncConfig();
});

chrome.runtime.onStartup.addListener(() => {
  void syncConfig();
});

chrome.alarms.create("clockedin-sync", { periodInMinutes: 0.25 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "clockedin-sync") {
    void syncConfig();
  }
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || details.url.startsWith(chrome.runtime.getURL(""))) {
    return;
  }

  const target = findTarget(details.url);
  if (!target || !shouldBlock(details.url)) {
    return;
  }

  void emitAttempt(target, details.url);
  void interruptBrowserWindow(details.tabId).catch(() => {
    void redirectTab(details.tabId, target, details.url);
  });
});

chrome.storage.local.get(STORAGE_KEY).then((stored) => {
  const existing = stored[STORAGE_KEY] as RuntimeConfig | undefined;
  if (existing) {
    runtimeConfig = {
      blockedTargets: existing.blockedTargets.map((target) => blockedTargetSchema.parse(target)),
      sessionActive: existing.sessionActive,
      sessionId: existing.sessionId
    };
  }
});
