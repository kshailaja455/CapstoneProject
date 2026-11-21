import assert from "node:assert/strict";
import test from "node:test";

import { narrativeConfig } from "./narrativeService";

test("narrative analysis can be disabled independently of RSS configuration", () => {
  const previous = process.env.NARRATIVE_ANALYSIS_ENABLED;
  process.env.NARRATIVE_ANALYSIS_ENABLED = "false";
  try {
    assert.equal(narrativeConfig().enabled, false);
  } finally {
    if (previous === undefined) delete process.env.NARRATIVE_ANALYSIS_ENABLED;
    else process.env.NARRATIVE_ANALYSIS_ENABLED = previous;
  }
});

test("shadow mode defaults on with a 15-minute scheduled interval", () => {
  const previousEnabled = process.env.NARRATIVE_ANALYSIS_ENABLED;
  const previousShadow = process.env.NARRATIVE_SHADOW_MODE;
  const previousInterval = process.env.NARRATIVE_POLL_INTERVAL_MINUTES;
  delete process.env.NARRATIVE_ANALYSIS_ENABLED;
  delete process.env.NARRATIVE_SHADOW_MODE;
  delete process.env.NARRATIVE_POLL_INTERVAL_MINUTES;
  try {
    const config = narrativeConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.shadowMode, true);
    assert.equal(config.intervalMinutes, 15);
  } finally {
    if (previousEnabled === undefined) delete process.env.NARRATIVE_ANALYSIS_ENABLED;
    else process.env.NARRATIVE_ANALYSIS_ENABLED = previousEnabled;
    if (previousShadow === undefined) delete process.env.NARRATIVE_SHADOW_MODE;
    else process.env.NARRATIVE_SHADOW_MODE = previousShadow;
    if (previousInterval === undefined) delete process.env.NARRATIVE_POLL_INTERVAL_MINUTES;
    else process.env.NARRATIVE_POLL_INTERVAL_MINUTES = previousInterval;
  }
});
