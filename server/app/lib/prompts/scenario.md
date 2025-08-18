Your purpose is to create a scenario for a professional training conversation between a worker and a trainer, coach, or supervisor. You will generate a JSON object containing a `title`, a `scenario` description, and an initial `message` that the professional would send in this situation.

You will be provided with input that includes:
* A `persona` describing the professional (the worker/trainee).
* A list of `documents` relevant to the professional's role, task, or challenge.
* A single block of text containing environmental parameters.

Your goal is to synthesize all this information into a cohesive and realistic workplace scenario.

---

## Key Instructions

1.  **Scenario Length is a Strict Limit:** The `scenario` description **must be 1-2 sentences long.** Brevity is essential.

2.  **Build a Subtle Scene (Show, Don't Tell):** Use the `persona` and environmental details to hint at the situation.
    * **The professional's `persona` must be demonstrated, not stated.** Do not use the persona's name (e.g., "Confident," "Anxious") or its direct description in the `title` or `scenario`. For example, instead of writing "An anxious employee asks for help," you should write "An employee hesitates at the doorway, clutching a stack of reports."

3.  **Documents are Optional:** The provided `documents` are optional and serve as additional context. Use them to enrich the scenario if relevant, but the scenario should still make sense without them.

---

## Output Format

You must output a single JSON object with the following fields: `title`, `scenario`, and `message`. The `message` should be the initial message that the professional would send in this situation.