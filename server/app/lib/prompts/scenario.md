Create a scenario for a **professional training conversation** between a worker (the candidate/trainee) and their trainer, coach, or supervisor. Your goal is to generate a JSON object with a `title`, a concise `problem_statement`, and an `objectives` array. The scenario should clearly indicate the situation, use **quantifiable details**, and align with **company performance goals or values**.

You will receive:

* A `persona` describing the candidate/trainee (optional).
* A list of `documents` relevant to their role, task, or challenge (optional).
* A single block of text containing environmental parameters and instructions (required).

Use this information to synthesize a **specific, data-anchored workplace scenario**.

---

### Instructions

* **Title:** Include the candidate’s name and the topic of the scenario.
  Example: `"title": "Priya Discusses Sales Decline in Midwest Region"`

* **Problem Statement (2–3 sentences):**
  *Be specific and numeric.* Mention measurable performance (e.g., “conversion rate dropped from 18% to 11%,” “missed 2 of 6 client deliverables,” “team productivity is 25% below target”). Tie the shortfall to a company target or standard where possible.

* **Objectives (2–4):** Write clear, **action-oriented objectives** that connect back to company metrics or values. They should sound like **realistic expectations** a supervisor would set, e.g.:

  * “Develop a plan to raise quarterly conversion rate back to 15%.”
  * “Commit to submitting weekly reports by Friday 5PM for the next 8 weeks.”
  * “Align communication style with the company’s ‘collaboration and transparency’ value.”

---

### Output Format

Output exactly one JSON object:

```json
{
  "title": string,                 // Candidate’s name + topic
  "problem_statement": string,     // 2–3 sentence numeric, goal-anchored description
  "objectives": string[]           // 2–4 measurable, goal-aligned objectives
}
```

---

### Example (Critical Conversation: Yearly Review)

```json
{
  "title": "Taylor’s Year-End Performance Review on Project Delivery",
  "problem_statement": "Taylor successfully delivered 8 of 12 assigned projects this year, meeting 67% of their delivery target. However, two high-priority projects missed deadlines by more than three weeks, and client satisfaction surveys showed a 15% decline compared to last year. The supervisor has scheduled a performance review to address these issues and set goals for the next year.",
  "objectives": [
    "Acknowledge the missed deadlines and analyze root causes for delays",
    "Outline a plan to achieve at least 90% on-time project delivery next year",
    "Commit to improving client satisfaction scores by 20% by the next annual review",
    "Align personal goals with the company’s core values of accountability and continuous improvement"
  ]
}
```
---

### Example (Termination Conversation)

```json
{
  "title": "Morgan’s Exit Discussion Following Performance Declines",
  "problem_statement": "Over the past 12 months, Morgan has missed 9 of 15 critical project deadlines and their error rate in deliverables has averaged 18%, more than triple the company’s 5% quality benchmark. Despite two formal performance improvement plans, progress has not been sustained, and client complaints have risen by 25%. The supervisor must now conduct a respectful termination conversation aligned with company policies.",
  "objectives": [
    "Communicate the decision clearly and reference documented performance data",
    "Acknowledge Morgan’s contributions while upholding company accountability standards",
    "Provide information on severance, benefits, and transition resources",
    "Maintain professionalism and compassion consistent with the company’s values of integrity and respect"
  ]
}
```

---

### Example (Constructive Feedback)

```json
{
  "title": "Riley Receives Feedback on Presentation Skills in Quarterly Review",
  "problem_statement": "Riley’s presentations to clients this quarter averaged a satisfaction score of 3.2 out of 5, compared to the team average of 4.4. Feedback highlighted frequent overuse of technical jargon and insufficient engagement with client questions, which has contributed to two lost renewal opportunities. The supervisor has scheduled a feedback session to help Riley strengthen communication and client impact.",
  "objectives": [
    "Review client survey data and identify specific areas for improvement",
    "Commit to incorporating client-friendly language in all Q3 presentations",
    "Set a measurable goal of achieving an average satisfaction score of 4.5 by year-end",
    "Demonstrate alignment with the company’s value of customer-centric communication"
  ]
}
```