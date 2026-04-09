import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { matchesBlockedApp, type BlockedTarget } from "@clockedin/shared";

import type { DesktopController } from "./controller";

const execFileAsync = promisify(execFile);

const POLL_INTERVAL_MS = 2_000;
const DEDUPE_INTERVAL_MS = 8_000;
const WINDOWS_BROWSER_PROCESSES = new Set(["brave", "chrome", "msedge", "firefox", "opera"]);

const WINDOWS_ACTIVE_WINDOW_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class ClockedinWindowProbe {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$windowHandle = [ClockedinWindowProbe]::GetForegroundWindow()
if ($windowHandle -eq [IntPtr]::Zero) {
  return
}

$titleBuilder = New-Object System.Text.StringBuilder 1024
[void][ClockedinWindowProbe]::GetWindowText($windowHandle, $titleBuilder, $titleBuilder.Capacity)
$processId = 0
[void][ClockedinWindowProbe]::GetWindowThreadProcessId($windowHandle, [ref]$processId)
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue

if ($null -eq $process) {
  return
}

[pscustomobject]@{
  title = $titleBuilder.ToString()
  processName = $process.ProcessName
  processId = $process.Id
} | ConvertTo-Json -Compress
`;

const WINDOWS_ACTIVE_WINDOW_COMMAND = Buffer.from(WINDOWS_ACTIVE_WINDOW_SCRIPT, "utf16le").toString("base64");

const WINDOWS_BROWSER_WINDOWS_SCRIPT = `
$browserNames = @('brave', 'chrome', 'msedge', 'firefox', 'opera')

Get-Process |
  Where-Object { $browserNames -contains $_.ProcessName.ToLower() -and -not [string]::IsNullOrWhiteSpace($_.MainWindowTitle) } |
  Select-Object @{
      Name = 'title'
      Expression = { $_.MainWindowTitle }
    }, @{
      Name = 'processName'
      Expression = { $_.ProcessName }
    }, @{
      Name = 'processId'
      Expression = { $_.Id }
    } |
  ConvertTo-Json -Compress
`;

const WINDOWS_BROWSER_WINDOWS_COMMAND = Buffer.from(WINDOWS_BROWSER_WINDOWS_SCRIPT, "utf16le").toString("base64");

const buildWindowsCloseTabCommand = (processId: number) =>
  Buffer.from(
    `
try {
  Add-Type -AssemblyName System.Windows.Forms
  $shell = New-Object -ComObject WScript.Shell
  if (-not $shell.AppActivate(${processId})) {
    return
  }

  Start-Sleep -Milliseconds 80
  $shell.SendKeys('^w')
  Start-Sleep -Milliseconds 80
} catch {
}
`,
    "utf16le"
  ).toString("base64");

type BrowserName = "Brave Browser" | "Google Chrome";

type BrowserTab = {
  browser: BrowserName;
  windowIndex: number;
  tabIndex: number;
  url: string;
};

type ActiveWindow = {
  title: string;
  processName: string;
  processId: number;
};

type BrowserWindowInfo = {
  title: string;
  processName: string;
  processId: number;
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
  (error.message.includes("Application isnâ€™t running") ||
    error.message.includes("Application isn't running") ||
    error.message.includes("(-600)") ||
    error.message.includes("Not authorized to send Apple events"));

const normalizeDomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");

const toKeywordTokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const getWebsiteKeywords = (target: BlockedTarget) => {
  const fromLabel = toKeywordTokens(target.label);
  const fromDomains = (target.match.domains ?? [])
    .flatMap((domain) => normalizeDomain(domain).split("."))
    .filter((token) => !["www", "com", "net", "org", "app", "m"].includes(token))
    .filter((token) => token.length >= 3);

  return [...new Set([...fromLabel, ...fromDomains])];
};

const getDetectionKey = (parts: string[]) => parts.join(":");

export class BrowserWatcher {
  private interval: NodeJS.Timeout | null = null;
  private readonly recentDetections = new Map<string, number>();
  private pollInFlight = false;

  constructor(private readonly controller: DesktopController) {}

  start() {
    if (this.interval) {
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

  triggerCheck() {
    void this.poll();
  }

  private async poll() {
    if (this.pollInFlight || !this.controller.hasActiveSession()) {
      return;
    }

    this.pollInFlight = true;

    try {
      if (process.platform === "darwin") {
        await this.pollMacBrowserTabs();
        return;
      }

      if (process.platform === "win32") {
        await this.pollWindowsActivity();
      }
    } finally {
      this.evictOldDetections();
      this.pollInFlight = false;
    }
  }

  private async pollMacBrowserTabs() {
    const websiteTargets = this.controller.getBlockedWebsiteTargets();
    if (websiteTargets.length === 0) {
      return;
    }

    for (const browser of BROWSERS) {
      const tabs = await this.listTabs(browser);
      for (const tab of tabs) {
        const target = websiteTargets.find((candidate) => this.matchesWebsiteTarget(tab.url, candidate));
        if (!target) {
          continue;
        }

        const detectionKey = getDetectionKey([browser, String(tab.windowIndex), String(tab.tabIndex), tab.url]);
        if (this.shouldSkipDetection(detectionKey)) {
          continue;
        }

        this.markDetection(detectionKey);
        await this.closeMacTab(tab);
        this.controller.recordDetectedAttempt({
          source: "native-helper",
          targetId: target.id,
          targetLabel: target.label,
          platform: "macos",
          context: {
            url: tab.url,
            appName: browser,
            processName: browser
          }
        });
      }
    }
  }

  private async pollWindowsActivity() {
    const activeWindow = await this.getWindowsActiveWindow();
    if (activeWindow) {
      const appTarget = this.controller
        .getBlockedAppTargets()
        .find((candidate) => matchesBlockedApp({ processName: activeWindow.processName }, candidate));

      if (appTarget) {
        const detectionKey = getDetectionKey([appTarget.id, activeWindow.processName, String(activeWindow.processId)]);
        if (this.shouldSkipDetection(detectionKey)) {
          return;
        }

        this.markDetection(detectionKey);
        this.controller.recordDetectedAttempt({
          source: "native-helper",
          targetId: appTarget.id,
          targetLabel: appTarget.label,
          platform: "windows",
          context: {
            appName: activeWindow.processName,
            processName: activeWindow.processName,
            windowTitle: activeWindow.title
          }
        });
        return;
      }
    }

    const browserWindows = await this.listWindowsBrowserWindows();
    for (const browserWindow of browserWindows) {
      const websiteTarget = this.controller
        .getBlockedWebsiteTargets()
        .find((candidate) => this.matchesWindowTitle(browserWindow.title, candidate));

      if (!websiteTarget) {
        continue;
      }

      const detectionKey = getDetectionKey([websiteTarget.id, browserWindow.processName, browserWindow.title]);
      if (this.shouldSkipDetection(detectionKey)) {
        continue;
      }

      this.markDetection(detectionKey);
      await this.closeWindowsBrowserTab(browserWindow.processId);
      this.controller.recordDetectedAttempt({
        source: "native-helper",
        targetId: websiteTarget.id,
        targetLabel: websiteTarget.label,
        platform: "windows",
        context: {
          appName: browserWindow.processName,
          processName: browserWindow.processName,
          windowTitle: browserWindow.title
        }
      });
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

  private async getWindowsActiveWindow(): Promise<ActiveWindow | null> {
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-EncodedCommand", WINDOWS_ACTIVE_WINDOW_COMMAND],
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024
        }
      );

      const trimmed = stdout.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = JSON.parse(trimmed) as Partial<ActiveWindow>;
      if (
        typeof parsed.title !== "string" ||
        typeof parsed.processName !== "string" ||
        typeof parsed.processId !== "number"
      ) {
        return null;
      }

      return {
        title: parsed.title,
        processName: parsed.processName,
        processId: parsed.processId
      };
    } catch {
      return null;
    }
  }

  private async listWindowsBrowserWindows(): Promise<BrowserWindowInfo[]> {
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-EncodedCommand", WINDOWS_BROWSER_WINDOWS_COMMAND],
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024
        }
      );

      const trimmed = stdout.trim();
      if (!trimmed) {
        return [];
      }

      const parsed = JSON.parse(trimmed) as Partial<BrowserWindowInfo> | Array<Partial<BrowserWindowInfo>>;
      const list = Array.isArray(parsed) ? parsed : [parsed];

      return list.filter(
        (item): item is BrowserWindowInfo =>
          typeof item.title === "string" &&
          typeof item.processName === "string" &&
          typeof item.processId === "number" &&
          WINDOWS_BROWSER_PROCESSES.has(item.processName.toLowerCase())
      );
    } catch {
      return [];
    }
  }

  private async closeMacTab(tab: BrowserTab) {
    try {
      await execFileAsync("osascript", ["-e", buildCloseTabScript(tab.browser, tab.windowIndex, tab.tabIndex)]);
    } catch {
      // Best effort. The distraction should still be recorded if the close fails.
    }
  }

  private async closeWindowsBrowserTab(processId: number) {
    try {
      await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-Sta", "-EncodedCommand", buildWindowsCloseTabCommand(processId)],
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024
        }
      );
    } catch {
      // Best effort. The distraction should still be recorded if the close fails.
    }
  }

  private matchesWebsiteTarget(candidateUrl: string, target: BlockedTarget) {
    const normalizedCandidate = normalizeDomain(candidateUrl);
    return (target.match.domains ?? []).some((domain) => {
      const normalizedDomain = normalizeDomain(domain);
      return normalizedCandidate === normalizedDomain || normalizedCandidate.endsWith(`.${normalizedDomain}`);
    });
  }

  private matchesWindowTitle(title: string, target: BlockedTarget) {
    const normalizedTitle = title.toLowerCase();
    return getWebsiteKeywords(target).some((keyword) => normalizedTitle.includes(keyword));
  }

  private shouldSkipDetection(detectionKey: string) {
    const lastDetectedAt = this.recentDetections.get(detectionKey) ?? 0;
    return Date.now() - lastDetectedAt < DEDUPE_INTERVAL_MS;
  }

  private markDetection(detectionKey: string) {
    this.recentDetections.set(detectionKey, Date.now());
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
