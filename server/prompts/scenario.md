Create a scenario for a **professional training conversation** between a worker (the candidate/trainee) and their trainer, coach, or supervisor. Your goal is to generate a JSON object with a `title`, a concise `problem_statement`, and an `objectives` array. The scenario should clearly indicate the situation, use **quantifiable details**, and align with **company performance goals or values**.

You will receive:

* A `persona` describing the candidate/trainee (optional).
* A list of `documents` relevant to their role, task, or challenge (optional).
* A single block of text containing environmental parameters and instructions (required).

Use this information to synthesize a **specific, data-anchored workplace scenario**.

---

### Instructions

* **Title:** Include the candidate’s name and the topic of the scenario.
  Example: `"title": "Priya Interviews for Data Analyst Role"`

* **Problem Statement (2–3 sentences):**
  *If a review/feedback/termination scenario:* Be specific and numeric about performance gaps (e.g., missed deadlines, percent decline, error rate, client survey data).
  *If an interview scenario:* Clearly define what the company is looking for in the role, using measurable expectations where possible (e.g., “manage 5–7 client accounts,” “improve process efficiency by 15%,” “deliver monthly reporting to executives”).
  ⚠️ *Note:* Some interview personas may be marked as “cheating candidates.” Do **not** reveal or reference this in the problem statement or objectives. It should only be inferred from their behavior/personality.

* **Objectives (2–4):** Write clear, **action-oriented objectives** that connect back to company metrics or values.
  *For interviews:* Focus on what the candidate should demonstrate or communicate to show they meet role requirements (without disclosing cheating info).

---

### Output Format

```json
{
  "title": string,                 // Candidate’s name + topic
  "problem_statement": string,     // 2–3 sentence numeric, goal-anchored description
  "objectives": string[]           // 2–4 measurable, goal-aligned objectives
}
```

---

### Example (Interview Scenario)

```json
{
  "title": "Avery Interviews for Business Analyst Role",
  "problem_statement": "The company is hiring a Business Analyst to support quarterly planning and cross-department reporting. The role requires managing 5–7 projects, delivering executive-ready reports within 48 hours, and contributing to a 10% efficiency improvement by year-end. Avery is interviewing to demonstrate readiness for these expectations.",
  "objectives": [
    "Communicate experience managing multiple projects",
    "Show ability to produce accurate reports under deadlines",
    "Demonstrate process improvement strategies that support a 10% efficiency gain",
    "Highlight collaboration skills consistent with the company’s transparency values"
  ]
}
```

---

### Example (Yearly Review)

```json
{
  "title": "Taylor’s Year-End Performance Review on Project Delivery",
  "problem_statement": "Taylor delivered 8 of 12 assigned projects this year (67%), but two high-priority projects were delayed over three weeks. Client satisfaction also fell 15% compared to last year. The supervisor has scheduled a review to address performance gaps and set targets for the next year.",
  "objectives": [
    "Analyze causes of missed deadlines",
    "Plan to raise on-time delivery to 90% next year",
    "Commit to improving client satisfaction scores by 20%",
    "Align goals with the company’s accountability and continuous improvement values"
  ]
}
```

---

### Example (Termination Conversation)

```json
{
  "title": "Morgan’s Exit Discussion Following Performance Declines",
  "problem_statement": "Over 12 months, Morgan missed 9 of 15 key deadlines and averaged an 18% error rate, more than triple the 5% benchmark. Two improvement plans failed, and client complaints rose 25%. The supervisor must now conduct a respectful termination conversation aligned with company policy.",
  "objectives": [
    "Clearly explain the decision with documented performance data",
    "Recognize Morgan’s contributions while upholding accountability standards",
    "Provide details on severance, benefits, and transition support",
    "Maintain professionalism consistent with the company’s integrity and respect values"
  ]
}
```

---

### Example (Constructive Feedback)

```json
{
  "title": "Riley Receives Feedback on Presentation Skills in Quarterly Review",
  "problem_statement": "This quarter, Riley’s presentations averaged a 3.2/5 satisfaction score, below the team’s 4.4 average. Client feedback noted jargon-heavy explanations and limited engagement, contributing to two lost renewals. The supervisor has arranged a session to address communication effectiveness.",
  "objectives": [
    "Review and discuss client survey feedback",
    "Adopt client-friendly language in all Q3 presentations",
    "Set a target to raise satisfaction scores to 4.5 by year-end",
    "Strengthen communication in line with the company’s customer-first values"
  ]
}
```