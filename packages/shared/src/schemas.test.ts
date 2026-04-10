import { describe, expect, it } from "vitest";

import { DEFAULT_BLOCKED_TARGETS } from "./constants";
import { matchesBlockedApp, matchesBlockedDomain } from "./utils";

describe("shared schemas", () => {
  it("ships the default website blockers", () => {
    expect(DEFAULT_BLOCKED_TARGETS.map((target) => target.id)).toEqual([
      "website-twitter",
      "website-youtube",
      "website-linkedin",
      "website-hacker-news",
      "website-reddit"
    ]);
  });

  it("matches blocked domains by subdomain", () => {
    const youtube = DEFAULT_BLOCKED_TARGETS.find((target) => target.id === "website-youtube");

    expect(youtube).toBeDefined();
    expect(matchesBlockedDomain("https://studio.youtube.com/channel/abc", youtube!)).toBe(true);
    expect(matchesBlockedDomain("https://example.com", youtube!)).toBe(false);
  });

  it("matches hacker news by domain", () => {
    const hackerNews = DEFAULT_BLOCKED_TARGETS.find((target) => target.id === "website-hacker-news");

    expect(hackerNews).toBeDefined();
    expect(matchesBlockedDomain("https://news.ycombinator.com/item?id=1", hackerNews!)).toBe(true);
    expect(matchesBlockedDomain("https://ycombinator.com", hackerNews!)).toBe(false);
  });

  it("matches reddit by subdomain", () => {
    const reddit = DEFAULT_BLOCKED_TARGETS.find((target) => target.id === "website-reddit");

    expect(reddit).toBeDefined();
    expect(matchesBlockedDomain("https://old.reddit.com/r/typescript", reddit!)).toBe(true);
    expect(matchesBlockedDomain("https://example.com", reddit!)).toBe(false);
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
