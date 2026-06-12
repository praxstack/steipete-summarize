import { describe, expect, it } from "vitest";
import { buildBrowserJsWrapper } from "../apps/chrome-extension/src/automation/repl-browser-script";
import { validateReplCode } from "../apps/chrome-extension/src/automation/repl-policy";

describe("automation REPL policy", () => {
  it("requires navigation through the navigate helper", () => {
    for (const code of [
      'window.location = "https://example.com"',
      'location.href = "https://example.com"',
      'window.location.replace("https://example.com")',
      "history.back()",
    ]) {
      expect(() => validateReplCode(code)).toThrow(/Use navigate\(\)/);
    }
    expect(() => validateReplCode('await navigate({ url: "https://example.com" })')).not.toThrow();
  });

  it("builds a browser wrapper with libraries, arguments, and capability state", () => {
    const wrapper = buildBrowserJsWrapper({
      fnSource: "async (value) => value",
      args: ["hello"],
      libraries: ["window.helper = true"],
      nativeInputEnabled: true,
      nativeInputCapability: "capability",
    });

    expect(wrapper).toContain("window.helper = true");
    expect(wrapper).toContain('const args = ["hello"]');
    expect(wrapper).toContain('capability: "capability"');
    expect(wrapper).toContain("if (!true)");
  });

  it("falls back to empty arguments when serialization fails", () => {
    const circular: unknown[] = [];
    circular.push(circular);

    const wrapper = buildBrowserJsWrapper({
      fnSource: "() => null",
      args: circular,
      libraries: ["", "window.helper = false"],
      nativeInputEnabled: false,
      nativeInputCapability: "",
    });

    expect(wrapper).toContain("window.helper = false");
    expect(wrapper).toContain("const args = []");
    expect(wrapper).toContain("if (!false)");
  });
});
