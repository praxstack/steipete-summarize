import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { startSpinner } from "../src/tty/spinner.js";

const stream = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

describe("tty spinner", () => {
  it("returns no-op handlers when disabled", () => {
    const spinner = startSpinner({ text: "Loading", enabled: false, stream });
    spinner.stop();
    spinner.clear();
    spinner.stopAndClear();
    spinner.setText("Next");
  });

  it("pauses, resumes, and clears when enabled", () => {
    vi.useFakeTimers();

    let writes = "";
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        writes += chunk.toString();
        callback();
      },
    });

    const spinner = startSpinner({ text: "Loading", enabled: true, stream: writable });
    spinner.pause();
    spinner.setText("Paused");
    spinner.pause();
    spinner.resume();
    spinner.stopAndClear();
    spinner.clear();

    expect(writes).toContain("Loading");
    expect(writes).toContain("\u001b[2K");
    vi.useRealTimers();
  });

  it("ignores empty/ansi-only and duplicate text updates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let writes = "";
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        writes += chunk.toString();
        callback();
      },
    });
    const spinner = startSpinner({ text: "Loading", enabled: true, stream: writable });
    const initialWrites = writes;
    spinner.setText("   ");
    spinner.setText("\u001b[36m\u001b[0m");
    spinner.setText("Loading");
    spinner.setText("Next");
    vi.setSystemTime(1_050);
    spinner.setText("Later");
    vi.setSystemTime(1_100);
    spinner.setText("Latest");

    expect(writes).toContain("Next");
    expect(writes).toContain("Latest");
    expect(writes).not.toContain("Later");
    expect(writes.length).toBeGreaterThan(initialWrites.length);
    spinner.stop();
    vi.useRealTimers();
  });

  it("can refresh the current line after external terminal writes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let writes = 0;
    const writable = new Writable({
      write(_chunk, _encoding, callback) {
        writes += 1;
        callback();
      },
    });
    const spinner = startSpinner({ text: "Loading", enabled: true, stream: writable });
    spinner.refresh();
    vi.setSystemTime(1_050);
    spinner.refresh();
    vi.setSystemTime(1_100);
    spinner.refresh();

    expect(writes).toBe(3);
    spinner.stop();
    vi.useRealTimers();
  });
});
