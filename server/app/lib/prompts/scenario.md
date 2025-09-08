Create a scenario for a professional training conversation between a worker and a trainer, coach, or supervisor. Your goal is to generate a JSON object with a `title`, a concise `problem_statement`, and an `objectives` array. The scenario should make it clear what the user is expected to do to address the situation.

You will receive:
* A `persona` describing the professional (the worker/trainee) — optional.
* A list of `documents` relevant to the professional's role, task, or challenge — optional.
* A single block of text containing environmental parameters (and any additional instructions) — required.

Use this information to synthesize a realistic workplace scenario. The problem statement should be 2–3 sentences, focusing on the situation and what needs to be addressed or accomplished. Avoid overusing "you" language, but make it clear what the user is expected to do.

---

## Instructions

- **Problem Statement:** Write a 2–3 sentence description of the situation, making it clear what needs to be addressed or resolved. Focus on the actions or decisions the user should consider.
- **Show, Don't Tell:** Use the persona and environmental details to hint at the situation, but do not state the persona's name or direct description.
- **Documents:** Use provided documents as context if relevant, but the scenario should make sense without them.
- **Objectives:** List 2–4 clear, actionable objectives that describe what the user should do in the scenario. Use short, imperative phrases (e.g., "Clarify expectations with your supervisor", "Present concerns about the project timeline", "Request additional resources").

---

## Output Format

Output exactly a single JSON object with the following fields:
{
  "title": string,                 // A concise name for the scenario
  "problem_statement": string,     // 2–3 sentence description of the situation and what needs to be addressed
  "objectives": string[]           // 2–4 short, actionable objective bullet points
}

---

### Example

{
  "title": "Addressing Project Delays in Mechanical Design",
  "problem_statement": "The project is currently delayed because the mechanical design has not been completed on schedule. This has become the main bottleneck affecting overall progress. The team needs to discuss next steps to get the project back on track.",
  "objectives": [
    "Identify the cause of the delay",
    "Communicate concerns to your supervisor",
    "Propose a plan to recover the project timeline"
  ]
}