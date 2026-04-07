import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { matchesBlockedDomain, type BlockedTarget } from "@clockedin/shared";

import type { DesktopController } from "./controller";

const execFileAsync = promisify(execFile);

const POLL_INTERVAL_MS = 1500;
const DEDUPE_INTERVAL_MS = 5000;

type BrowserName = "Brave Browser" | "Google Chrome";

type BrowserTab = {
  browser: BrowserName;
  windowIndex: number;
  tabIndex: number;
  url: string;
};

const BROWSERS: BrowserName[] = ["Brave Browser", "Google Chrome"];

const toAppleScriptLiteral = (value: string) => JSON.stringify(value);

const buildListTabsScript = (browser: BrowserName) => `
set output to ""
tell application ${toAppleScriptLiteral(browser)}
  repeat with windowIndex from 1 to count of windows
    set currentWindow to window windowIndex
    repeat with tabIndex from 1 to count of tabs of currentWindow
      set currentTab to tab tabIndex of currentWindow
      set currentUrl to URL of currentTab
      if currentUrl is not missing value and currentUrl is not "" then
        set output to output & (windowIndex as text) & "||" & (tabIndex as text) & "||" & currentUrl & linefeed
      end if
    end repeat
  end repeat
end tell
return output
`;

const buildCloseTabScript = (browser: BrowserName, windowIndex: number, tabIndex: number) => `
tell application ${toAppleScriptLiteral(browser)}
  if (count of windows) >= ${windowIndex} then
    set targetWindow to window ${windowIndex}
    if (count of tabs of targetWindow) >= ${tabIndex} then
      close tab ${tabIndex} of targetWindow
    end if
  end if
end tell
`;

const isScriptFailure = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes("Application isn’t running") ||
    error.message.includes("Application isn't running") ||
    error.message.includes("(-600)") ||
    error.message.includes("Not authorized to send Apple events"));

export class BrowserWatcher {
  private interval: NodeJS.Timeout | null = null;
  private readonly recentDetections = new Map<string, number>();
  private pollInFlight = false;

  constructor(private readonly controller: DesktopController) {}

  start() {
    if (process.platform !== "darwin" || this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.recentDetections.clear();
  }

  private async poll() {
    if (this.pollInFlight || !this.controller.hasActiveSession()) {
      return;
    }

    this.pollInFlight = true;

    try {
      const websiteTargets = this.controller.getBlockedWebsiteTargets();
      if (websiteTargets.length === 0) {
        return;
      }

      for (const browser of BROWSERS) {
        const tabs = await this.listTabs(browser);
        for (const tab of tabs) {
          const target = websiteTargets.find((candidate) => matchesBlockedDomain(tab.url, candidate));
          if (!target) {
            continue;
          }

          const detectionKey = `${browser}:${tab.windowIndex}:${tab.tabIndex}:${tab.url}`;
          const lastDetectedAt = this.recentDetections.get(detectionKey) ?? 0;
          if (Date.now() - lastDetectedAt < DEDUPE_INTERVAL_MS) {
            continue;
          }

          this.recentDetections.set(detectionKey, Date.now());
          await this.closeTab(tab);
          this.controller.recordDetectedAttempt({
            source: "extension",
            targetId: target.id,
            targetLabel: target.label,
            platform: "macos",
            context: {
              url: tab.url,
              appName: browser
            }
          });
        }
      }
    } finally {
      this.evictOldDetections();
      this.pollInFlight = false;
    }
  }

  private async listTabs(browser: BrowserName): Promise<BrowserTab[]> {
    try {
      const { stdout } = await execFileAsync("osascript", ["-e", buildListTabsScript(browser)]);
      return stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [windowIndex, tabIndex, ...urlParts] = line.split("||");
          return {
            browser,
            windowIndex: Number(windowIndex),
            tabIndex: Number(tabIndex),
            url: urlParts.join("||")
          };
        })
        .filter((tab) => Number.isFinite(tab.windowIndex) && Number.isFinite(tab.tabIndex) && tab.url.length > 0);
    } catch (error) {
      if (isScriptFailure(error)) {
        return [];
      }
      return [];
    }
  }

  private async closeTab(tab: BrowserTab) {
    try {
      await execFileAsync("osascript", ["-e", buildCloseTabScript(tab.browser, tab.windowIndex, tab.tabIndex)]);
    } catch {
      // If tab close fails, the recorded attempt still triggers the popup.
    }
  }

  private evictOldDetections() {
    const cutoff = Date.now() - DEDUPE_INTERVAL_MS;
    for (const [key, timestamp] of this.recentDetections.entries()) {
      if (timestamp < cutoff) {
        this.recentDetections.delete(key);
      }
    }
  }
}
