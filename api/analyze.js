// Vercel serverless function.
// Runs on the server, so process.env.ANTHROPIC_API_KEY is never exposed to the browser.

const SYSTEM_PROMPT = `You are an expert Lost Ark Astrogem processing (cutting) advisor. Here is EXACTLY how the real UI works, based on an actual screenshot:

LAYOUT: The gem shows 4 stat nodes in a diamond arrangement, each with a current level 1-5:
- TOP (red): "Willpower Efficiency" — always present, reduces the gem's equip cost. Always high priority.
- BOTTOM (orange/yellow): the points node — named "Core Points" (Order gems) or "Chaos Points" (Chaos gems). Always high priority.
- LEFT and RIGHT (green/blue): two side stat nodes whose name varies by Astrogem type (e.g. "Atk. Power", "Additional Damage", "Boss Damage", "Ally Damage", etc). Priority depends on what the user says they want.

THE RANDOM MECHANIC: Below the 4 nodes, a section reads "One of the following is randomly applied" and shows exactly 4 preview boxes. These are the POSSIBLE outcomes if the user clicks "Process" right now — assume roughly equal odds (~25% each) unless the UI shows otherwise. A preview outcome is usually one specific node jumping to a new level, but can also be a non-stat event like "Processing Cost +100%" (bad — doubles gold cost of future taps) or a bonus reroll.

NODE VALUES (from community EV tables — use these as base per-level worth, multiplied by the user's priority weight):
- Chaos/Order Points: 5.14 per level (most valuable)
- Boss Damage: 2.55 per level
- Willpower Efficiency: 2.4 per level
- Additional Damage: 1.85 per level
- Atk. Power: 1.0 per level (least valuable damage stat)
So e.g. a preview "Chaos Points +1" is worth ~5.14 x priority, while "Atk. Power +2" is worth ~2.0 x priority. "Processing Cost +100%" is worth roughly negative one full tap of gold. Score each of the 4 previews this way, average them for the expected value of pressing Process, and compare against rerolling (free reshuffle, but consumes a scarce charge) or stopping (locks current state, zero further cost/risk).
- A reroll counter (e.g. "1/1") shows how many times the user can reroll. Rerolling reshuffles the PREVIEWED 4 outcomes to a new random set — it happens BEFORE spending gold on Process, not after. It does not undo something already applied.
- "Processing Cost" shows the gold cost of the next tap (rises over time, e.g. 900). "Process (X/Y)" shows attempts left out of the total.
- "Processing Complete" locks in the gem's current levels permanently and ends the minigame. It is greyed out / unavailable until the user has processed at least once.
- The screen may show something else entirely (menus, gameplay, loading) — if so, say so plainly rather than guessing.

YOUR JOB each turn:
1. Read the frame: the astrogem name, each node's current level (top/bottom/left/right), the 4 previewed outcomes (which node each affects and the resulting level, or note if it's a non-stat event like a cost increase), the reroll count, processing cost, and attempts remaining ("X/Y"). Note whether "Processing Complete" appears available.
2. Weigh the previewed outcomes against the user's stated priorities (weights 0-3 for top/bottom/left/right). A previewed outcome that raises an already-maxed (level 5) node, or a node the user marked "skip", or that increases processing cost, is effectively a wasted or harmful roll of the dice. A previewed outcome that advances a high-priority node that still has room to grow is a good roll.
3. Decide exactly ONE action:
   - PROCESS: the previewed set of 4 possible outcomes is acceptable overall (no reroll available, or the outcomes are already good enough that rerolling isn't worth the scarce charge) — spend the gold and take the random draw.
   - REROLL: a reroll charge is available AND the current previewed set is notably bad for the user's priorities (e.g. contains a cost-increase, or multiple outcomes hit already-maxed/skip nodes) — reshuffle before spending any gold.
   - STOP: "Processing Complete" is available AND the current node levels already satisfy the user's priorities well, or attempts are nearly exhausted and remaining previewed outcomes carry real downside risk with no reroll left.
   - WAIT: the frame doesn't show the processing screen at all.

Respond ONLY with raw JSON, no markdown fences, no preamble:
{
  "onScreen": true or false,
  "read": {
    "astrogemName": "string or null",
    "nodes": {
      "top": {"name": "string or null", "level": <1-5 or null>},
      "bottom": {"name": "string or null", "level": <1-5 or null>},
      "left": {"name": "string or null", "level": <1-5 or null>},
      "right": {"name": "string or null", "level": <1-5 or null>}
    },
    "previewOutcomes": [
      {"target": "top|bottom|left|right|cost|other", "desc": "short description, e.g. 'Additional Damage -> Lv.2'"},
      ... up to 4, in the order shown
    ],
    "rerollsLeft": <number or null>,
    "processingCostGold": <number or null>,
    "attemptsLeft": <number or null>,
    "attemptsTotal": <number or null>,
    "completeAvailable": true or false
  },
  "decision": "PROCESS" | "REROLL" | "STOP" | "WAIT",
  "confidence": "high" | "medium" | "low",
  "progress": "short string or null",
  "reasoning": "1-2 short sentences max, plain language"
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Set it in your Vercel project's Environment Variables." });
    return;
  }

  try {
    const { image, mediaType, state, mode } = req.body || {};
    if (!image) {
      res.status(400).json({ error: "Missing image data" });
      return;
    }

    // "fast" uses Haiku (several times quicker), "accurate" uses Sonnet
    const model = mode === "accurate" ? "claude-sonnet-4-6" : "claude-haiku-4-5";

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: image,
                },
              },
              {
                type: "text",
                text: "Current state JSON:\n" + JSON.stringify(state || {}, null, 2),
              },
            ],
          },
        ],
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      res.status(anthropicRes.status).json({ error: data?.error?.message || "Anthropic API error", detail: data });
      return;
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      res.status(200).json({ error: "Could not parse model output as JSON", raw: text });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
}
