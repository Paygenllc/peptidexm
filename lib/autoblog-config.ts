/**
 * Shared configuration for the Autoblog drafter.
 *
 * Lives in /lib (not in a "use server" file) so both the server action and
 * the client panel can import the same tone/length tables. Adding a new
 * voice or length bucket is a one-file change.
 */

/**
 * Editorial voices. The `directive` is injected verbatim into the system
 * prompt — that is what actually moves the model's register. The `label`
 * is only for the UI dropdown.
 */
export const AUTOBLOG_TONES = {
  research: {
    label: "Research (measured, evidence-led)",
    directive:
      "Measured, evidence-led research-blog voice. Avoid marketing fluff and " +
      "hedging filler. Lead with mechanism and data. No dosing advice, no " +
      "therapeutic claims — research-use framing throughout.",
  },
  educational: {
    label: "Educational (plain-English explainer)",
    directive:
      "Teach a motivated beginner. Define every technical term the first time " +
      "it appears. Short sentences, concrete analogies, numbered steps where " +
      "appropriate. Never assume prior biochemistry knowledge. Research-use " +
      "framing throughout.",
  },
  news: {
    label: "Research news brief",
    directive:
      "Write a timely research-news brief. Summarize what's new, why it " +
      "matters for researchers, and point to next directions. Attribute " +
      "every factual claim (\"a 2023 preprint reported…\", \"the group at " +
      "Stanford showed…\"). Tight, news-desk cadence.",
  },
  scientific: {
    label: "Scientific (peer-reviewed register)",
    directive:
      "Match the register of a peer-reviewed review article. Use precise " +
      "terminology (GPCR, nanomolar, AUC, half-life), cite pathways by " +
      "receptor, and frame claims as \"studies suggest\" / \"data indicate\". " +
      "No first person. No promotional language.",
  },
  conversational: {
    label: "Conversational (friendly expert)",
    directive:
      "Write like a friend who happens to be an expert: warm, direct, " +
      "second-person (\"you\"). Use contractions. Occasional dry humor is " +
      "welcome. Still factual and specific — never vague. Research-use " +
      "framing throughout.",
  },
  story: {
    label: "Storytelling (narrative lead)",
    directive:
      "Open with a brief narrative hook — a specific protocol, researcher, " +
      "or real-world scenario — then zoom out into the science. Keep the " +
      "reader anchored to the story throughout. Close by returning to the " +
      "opening thread so the piece ends on a scene.",
  },
  practical: {
    label: "Practical (how-to guide)",
    directive:
      "Focus on actionable protocols, stacking logic, and common mistakes — " +
      "for research models, not humans. Use headers like 'When to use it', " +
      "'How a study might design this', 'What to avoid'. Every section " +
      "should leave the reader with a concrete takeaway.",
  },
  concise: {
    label: "Concise (executive brief)",
    directive:
      "Dense, high-signal prose for a time-pressed reader. No filler, no " +
      "\"in this article we'll explore\". Front-load the conclusion. Short " +
      "paragraphs (2–3 sentences max). Heavy use of bulleted lists for " +
      "supporting detail.",
  },
  persuasive: {
    label: "Persuasive (thought leadership)",
    directive:
      "Argue a clear editorial thesis. Name the thesis in the first " +
      "paragraph, support it with evidence and counter-arguments, and close " +
      "by reaffirming the argument. Confident but never aggressive. Never " +
      "make therapeutic promises.",
  },
} as const

export type AutoblogTone = keyof typeof AUTOBLOG_TONES

/**
 * Target content length. The model scales section count and depth off this,
 * not raw token count (which drifts with prompt size).
 */
export const AUTOBLOG_LENGTHS = {
  short: {
    label: "Short (~500–700 words, 3 sections)",
    directive: "Target ~500–700 words across 3 H2 sections.",
  },
  medium: {
    label: "Medium (~900–1,200 words, 4–5 sections)",
    directive: "Target ~900–1,200 words across 4–5 H2 sections.",
  },
  long: {
    label: "Long (~1,500–2,000 words, 5–6 sections)",
    directive: "Target ~1,500–2,000 words across 5–6 H2 sections.",
  },
  deep: {
    label: "Deep dive (~2,200–3,000 words, 7–9 sections)",
    directive:
      "Target ~2,200–3,000 words across 7–9 H2 sections with at least one H3-level subsection.",
  },
} as const

export type AutoblogLength = keyof typeof AUTOBLOG_LENGTHS

export const TONE_KEYS = Object.keys(AUTOBLOG_TONES) as AutoblogTone[]
export const LENGTH_KEYS = Object.keys(AUTOBLOG_LENGTHS) as AutoblogLength[]

/**
 * House rules for natural-sounding prose. Injected into every drafter
 * prompt (topic + remix) AFTER the per-tone directive — so tone still
 * sets the register, but these guardrails kill the tell-tale "AI drone"
 * patterns regardless of which voice is picked.
 *
 * Tuned against the common public-domain list of LLM tells: filler
 * transitions, buzzword nouns, rule-of-three pile-ons, symmetric
 * "it's not X, it's Y" framings, and uniform sentence rhythm.
 */
export const NATURAL_VOICE_GUARDRAIL = [
  "## Natural-prose guardrails (always apply, regardless of tone)",
  "Write like a thoughtful human editor, not like an AI. Concretely:",
  "",
  "- Vary sentence length aggressively. Mix short (5–8 word) punchy sentences with longer, more textured ones. Uniform rhythm is the #1 tell of machine prose.",
  "- Prefer concrete nouns and specific numbers over abstract hand-waving. \"A 2022 cell-culture study saw a 38% drop in fibrosis markers\" beats \"studies have shown beneficial effects\".",
  "- Contractions are fine when the tone allows. \"It's\", \"doesn't\", \"we'll\".",
  "- It is acceptable — even encouraged — to use the occasional sentence fragment for emphasis. One or two per piece.",
  "- Start sentences with varied openings. Don't begin three sentences in a row with \"The\", \"This\", or \"It\".",
  "- Avoid the following buzzwords entirely: delve, navigate, leverage, robust, crucial, pivotal, landscape, realm, tapestry, testament, vibrant, bustling, journey, unlock, unleash, harness, embark, foster, cultivate, paramount, multifaceted, holistic, intricate.",
  "- Avoid these transition phrases: \"In conclusion\", \"It's important to note\", \"In today's world\", \"In the ever-evolving\", \"Dive into\", \"Let's explore\", \"At its core\".",
  "- Avoid the \"It's not just X — it's Y\" and \"not only X but also Y\" constructions. They read as mechanical.",
  "- Avoid rule-of-three list pile-ups in prose (\"fast, efficient, and reliable\"). One adjective usually does the job; if you need more, put them in a real bulleted list.",
  "- Avoid em-dash overuse. Max one or two em-dashes per ~500 words. A comma, period, or parenthetical usually reads more human.",
  "- No rhetorical questions as section openers (\"But what does this actually mean?\").",
  "- Don't signal structure in prose (\"First, we'll look at X. Next, we'll cover Y. Finally…\"). Let headings and the writing itself do that work.",
  "- Opinions are welcome where the tone permits. A measured editorial judgment (\"this dataset is thin\", \"the mechanism is well-characterised, the clinical relevance isn't\") reads human. Blandly neutral reads AI.",
  "- When comparing or contrasting, show the trade-off honestly instead of landing on tidy symmetries.",
  "- End when you're done. No \"In summary, we've seen…\" recap unless the content genuinely warrants one.",
].join("\n")
