import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

// The model every AI feature uses unless it has a reason not to.
export const AI_MODEL = "claude-opus-5-5";

// One client for every AI feature, or null without a key. AI features are
// extras, so the site runs without them; each one checks for null and skips.
export const anthropic = config.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  : null;
