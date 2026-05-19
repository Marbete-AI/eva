/**
 * @eva/prompts
 *
 * Versioned prompt templates for EVA.
 * The actual prompt content lives in packages/prompts/versions/*.md
 * and is the canonical reference for each version.
 *
 * The live prompt is built at runtime in apps/server/src/personas/base.ts
 * using the constants defined there. This package is the review and iteration
 * surface — edit here, copy to base.ts, test, merge.
 *
 * Prompt engineering workflow:
 *   1. Edit versions/v1.x.md
 *   2. Copy changed sections into apps/server/src/personas/base.ts
 *   3. Build + test on a branch
 *   4. Merge to main when satisfied
 *   5. Update the change log in the version file
 */

export const PROMPT_VERSION = "1.0";
