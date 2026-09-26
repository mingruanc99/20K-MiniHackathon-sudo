# Evaluation & Benchmark

Every number the app shows comes from a **run log** written at the end of a real run. No score is hard-coded, and no score has a floor. If there is no log yet, the UI shows "—".

- Code: `src/pipeline/module4_guard/qualityGuard.ts`, which computes the scores, and `src/services/benchmark/benchmarkService.ts`, which assembles and stores the log.
- Admin page: `/admin/evaluation`

---

## 1. Run logs

A `BenchmarkRunLog` is written:
- once per **pipeline run**
- once per **document scan**, i.e. building the knowledge tree
- once per **golden regression case**

The log is stored in three places:
- Firestore at `projects/{projectId}/runs/{runId}`. This path is already allowed by `firestore.rules`.
- `localStorage` under `clsg_benchmark_runs`, keeping the last 100 runs.
- The browser console, as one `console.table` of calls and one of metrics.

It can be downloaded as JSON from the Project Studio, where the button is next to the execution log, or from `/admin/evaluation`.

What a log contains:

| Field | Meaning |
|---|---|
| `metrics` | Final-output metrics (section 2) |
| `timings[]` | Wall-clock time of every stage |
| `calls[]` | Every LLM call. Token counts come from the API usage payload: `usageMetadata.promptTokenCount / candidatesTokenCount / thoughtsTokenCount` for Gemini, `usage.*` for OpenAI, OpenRouter and Claude. Cache hits appear as `cache_hit` with 0 tokens. If an API returns no usage data, the call is flagged `tokensEstimated: true` (estimated at about 4 chars per token). |
| `tokens` | Sum over `calls`: prompt, completion, thinking tokens, cost, and how many calls were estimated |
| `discourse` | Connectives kept or removed, and heading repeats removed by the discourse policy |

**Cost** = prompt tokens × input price + (completion + thinking tokens) × output price. Prices are in `src/services/llm/modelCatalog.ts`. For a model whose price isn't listed, cost is `null` and `costComplete = false`; the app does not guess a price.

---

## 2. Metrics

All metrics are computed on the **final** lecture, after repairs. T_target is the requested duration and WPM is the configured speech rate.

| Metric | Formula | Pass threshold |
|---|---|---|
| **DAR-P** (Duration Adherence Rate with Prosody) | \|T_est − T_target\| / T_target × 100%, where T_est = Σ words / (WPM/60) × rate factor + Σ planned pauses | ≤ 15% pass, ≤ 25% warning |
| DAR-P pre-repair | Same formula, before the pause repair | reported only |
| **VTC** (Visual Taxonomy Conformance) | cues whose type is one of the 13 canonical types / all cues | 100% |
| **CNS** (Cue Necessity Score) | cues with `visual_need`, `visual_purpose` and a ≥ 15-char `learning_support` / all cues | ≥ 85% |
| **Grounding** | narration content tokens (> 4 chars) that also occur in the source document / narration content tokens | ≥ 60% |
| **Language** | sentences passing the terminology policy / sentences (Vietnamese narration only) | ≥ 85% |
| **Anti-repetition** | 1 − (sentence pairs with Jaccard > 0.7 remaining) / sentences | ≥ 95% |
| **Connective density** | sentences that start with a connective / sentences | ≤ 25% |
| **Heading repeats** | times a section or chapter heading is spoken again after its first mention | 0 |
| **Prosody validity** | pauses whose duration is inside the range for their type (syntactic 150–250 ms, emphasis 300–450, concept boundary 500–700, section transition 800–1200) / pauses | reported |
| **Keyword coverage** | top-3 active keywords per active page that are actually spoken / all such keywords | reported |
| **Visual coverage** | located regions whose OCR reading shows up in the narration (≥ 20% overlap of content tokens) / located regions | reported |
| **Formula integrity** | 1 − altered formula spans / formula spans in the narration. A span written with math symbols (operators, arrows, Greek letters, LaTeX) must appear verbatim in its section's source; spacing is the only difference allowed | 100% (any altered span fails) |
| **Style conformance** | 0.6 × (1 − styled scenes containing a banned phrase / styled scenes) + 0.4 × sentence-length fit to the style profile. Only scenes the LLM wrote in the chosen style count | ≥ 0.9 pass, else warning (never fails) |

Grounding is a lexical proxy. A high score does not prove the narration is factually correct.

Formula integrity and style conformance are checks only: they are not part of the dimension scores. A failed formula check still makes the decision **FAIL**, because a wrong formula is worse than a missing one.

### Dimension scores and the decision

The five dimension scores are built from the metrics above:

- content = Grounding
- pedagogy = (CNS + Language) / 2
- narrative = (Anti-repetition + Connective score + Heading score + Purification pass rate) / 4, where
  - Connective score = 1 − max(0, density − 0.25) / 0.25
  - Heading score = 1 − repeats / mentions
- visual = (VTC + CNS) / 2
- technical = (1 − DAR-P ratio + Prosody validity) / 2

**overall** = 0.25·content + 0.20·pedagogy + 0.20·narrative + 0.20·visual + 0.15·technical

The decision is:
- **FAIL** if any check fails, or overall < 0.60
- **NEEDS_REVIEW** if any check is only a warning, or overall < 0.85
- **AUTO_REPAIR** if everything passes after repairs
- **PASS** if everything passes with no repairs

### Repairs

The guard repairs the text without inventing content:
- It normalizes terminology.
- It strips metadata and labels.
- It removes duplicate sentences.
- It trims over-long intros.
- It restores formulas to their source spelling. A narration span that matches a source formula up to spacing, dash/multiplication variants or LaTeX-vs-Unicode spelling is rewritten to the source form (`θ ← θ − α∇J(θ)` → `$\theta \leftarrow \theta - \alpha \nabla J(\theta)$`). The scene's on-screen `formulas` are always the source formulas, verbatim.

After repairing the text, it **re-plans prosody** from the final words.

The only DAR-P repair allowed is rescaling pauses, and each pause stays clamped to its range. Speaking time is never scaled. So if the words are too long for the target, DAR-P honestly reports that.

---

## 3. Golden regression

To run it, click **"Chạy hồi quy"** ("Run regression") on `/admin/evaluation`, or call `goldenDatasetService.runRegressionEvaluation()`.

There are four cases: three short golden texts plus the built-in 5-slide CNN deck. Each one runs through the full pipeline:
- The **template engine** is the default. It is deterministic and uses 0 tokens.
- The **LLM engine** is optional and costs tokens.

A case passes when all three hold:
- concept recall ≥ 0.5, where concept recall = expected concepts that are spoken / expected concepts
- content ≥ 0.8 × the case's minimum
- DAR-P ≤ 25%

The regression report compares mean dimension scores with the previous run that used the same engine.

---

## 4. What is not measured

- **Audio duration.** T_est is an estimate from word count and WPM; no speech is synthesized.
- **Factual correctness.** Grounding is lexical only.
- **External baselines** such as GPT-4o direct prompting or EduCraft. The earlier table of baseline numbers had no reproducible source and has been removed. To compare against a baseline, run it through the same metric code and log it.
