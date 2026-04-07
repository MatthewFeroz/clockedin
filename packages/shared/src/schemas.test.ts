import { describe, expect, it } from "vitest";

import { DEFAULT_BLOCKED_TARGETS } from "./constants";
import { runtimeIncomingMessageSchema } from "./schemas";
import { matchesBlockedApp, matchesBlockedDomain } from "./utils";

describe("shared schemas", () => {
  it("accepts attempt payloads from the extension host", () => {
    const parsed = runtimeIncomingMessageSchema.parse({
      type: "ATTEMPT_DETECTED",
      source: "extension-host",
      payload: {
        targetId: "website-youtube",
        targetLabel: "YouTube",
        platform: "macos",
        context: {
          url: "https://www.youtube.com/watch?v=123"
        }
      }
    });

    expect(parsed.type).toBe("ATTEMPT_DETECTED");
    if (parsed.type !== "ATTEMPT_DETECTED") {
      throw new Error("Expected an ATTEMPT_DETECTED payload.");
    }
    expect(parsed.payload.targetId).toBe("website-youtube");
  });

  it("ships the default website blockers", () => {
    expect(DEFAULT_BLOCKED_TARGETS.map((target) => target.id)).toEqual([
      "website-twitter",
      "website-youtube",
      "website-linkedin"
    ]);
  });

  it("matches blocked domains by subdomain", () => {
    const youtube = DEFAULT_BLOCKED_TARGETS.find((target) => target.id === "website-youtube");

    expect(youtube).toBeDefined();
    expect(matchesBlockedDomain("https://studio.youtube.com/channel/abc", youtube!)).toBe(true);
    expect(matchesBlockedDomain("https://example.com", youtube!)).toBe(false);
  });

  it("matches blocked apps by bundle identifier", () => {
    expect(
      matchesBlockedApp(
        {
          bundleId: "com.tinyspeck.slackmacgap"
        },
        {
          id: "app-slack",
          kind: "app",
          label: "Slack",
          enabled: true,
          match: {
            bundleIds: ["com.tinyspeck.slackmacgap"]
          }
        }
      )
    ).toBe(true);
  });
});
