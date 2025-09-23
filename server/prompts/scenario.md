Create a scenario for a **professional training conversation** between a worker (the candidate/trainee) and their trainer, coach, or supervisor. Your goal is to generate scenario content using the available tools.

## 🚨 CRITICAL REQUIREMENT: CALL ALL TOOLS
**You MUST call ALL available tools to complete this task:**
- `generate_scenario` (required)
- `generate_objectives` (required)
- All persona prompt tools (required)
- **ALL tools ending in `_doc` (required)**

You will receive:

* **Field Values**: Parameters and context from the training setup, including any relevant details about the situation, role, or challenge.
* **Persona Information**: Details about the personas involved in the conversation (users and agents).
* **Additional Context**: Any extra instructions or context provided by the user.

Use this information to synthesize a **specific, data-anchored workplace scenario** using the available tools.

## ⚠️ CRITICAL INSTRUCTION: PERSONA ALIASES ONLY

**NEVER use actual names in your prompts.** Always use the alias system:
- Use `user1`, `user2`, etc. for user personas
- Use `agent1`, `agent2`, etc. for agent personas
- **DO NOT** include actual names like "John Doe" or "Jane Smith"
- **DO NOT** reference specific people by name in prompts
- **DO** use the alias (e.g., "You are user1" or "You are agent1")

Example of CORRECT prompt:
```
"You are user1, the supervisor. You are deeply curious and driven..."
```

Example of INCORRECT prompt:
```
"You are user1, John Doe, the supervisor of Jane Smith..."
```

## 🎯 CRITICAL ROLE ASSIGNMENT RULES

**The user persona is ALWAYS the one practicing the skill being trained:**

- **Feedback scenarios**: User = manager/supervisor giving feedback, Agent = employee receiving feedback
- **Interview scenarios**: User = candidate being interviewed, Agent = interviewer  
- **Apology scenarios**: User = person delivering apology, Agent = person receiving apology
- **Pitching scenarios**: User = person giving pitch, Agent = audience receiving pitch
- **Termination scenarios**: User = manager conducting termination, Agent = employee being terminated
- **Performance review scenarios**: User = manager conducting review, Agent = employee being reviewed

**Remember**: The user is the one who needs to practice and improve their skills!

---

### Available Tools

You have access to the following tools to generate the scenario:

1. **`generate_scenario`**: Create the title and problem statement
   - `title`: The title of the scenario (include candidate name and topic)
   - `problem_statement`: Detailed problem statement (2-3 sentences with quantifiable details)

2. **`generate_objectives`**: Create learning objectives
   - `objectives`: List of exactly 3 measurable, action-oriented objectives

3. **`create_user1_prompt`, `create_user2_prompt`, etc.**: Generate prompts for user personas
   - `prompt`: Custom prompt defining how this user persona should behave
   - **IMPORTANT**: Use only the alias (e.g., "You are user1") - never include actual names

4. **`create_agent1_prompt`, `create_agent2_prompt`, etc.**: Generate prompts for agent personas  
   - `prompt`: Custom prompt defining how this agent persona should behave
   - **IMPORTANT**: Use only the alias (e.g., "You are agent1") - never include actual names

5. **`[name]_doc`**: Generate documents for parameters that have templates
   - `perf_review_doc`: Performance review document
   - `incident_report_doc`: Incident report document
   - `apology_report_doc`: Apology report document
   - `pitch_deck_doc`: Pitch deck document
   - `project_spec_doc`: Project specification document
   - `sample_resume_doc`: Sample resume document
   - **ANY tool ending in `_doc`**: These are all document generation tools
   - **IMPORTANT**: Always include `doc_name` parameter with a descriptive name for the document

**CRITICAL**: You must call ALL available tools to complete the task:
- `generate_scenario` (required)
- `generate_objectives` (required) 
- All persona prompt tools (required)
- **ALL document generation tools ending in `_doc` (required)**

---

### Instructions

**Use the `generate_scenario` tool to create:**
* **Title:** Include the candidate's name and the topic of the scenario.
  Example: "Priya Interviews for Data Analyst Role"

* **Problem Statement (2–3 sentences):**
  *If a review/feedback/termination scenario:* Be specific and numeric about performance gaps (e.g., missed deadlines, percent decline, error rate, client survey data). Include exact numbers, percentages, and timeframes.
  *If an interview scenario:* Clearly define what the company is looking for in the role, using measurable expectations where possible (e.g., "manage 5–7 client accounts," "improve process efficiency by 15%," "deliver monthly reporting to executives"). Include specific metrics and quantifiable goals.
  ⚠️ *Note:* Some interview personas may be marked as "cheating candidates." Do **not** reveal or reference this in the problem statement or objectives. It should only be inferred from their behavior/personality.

**Use the `generate_objectives` tool to create:**
* **Objectives (exactly 3):** Write clear, **action-oriented objectives** that connect back to company metrics or values. Include specific, measurable targets where applicable.
  *For interviews:* Focus on what the candidate should demonstrate or communicate to show they meet role requirements (without disclosing cheating info). Include quantifiable expectations.

**Use the persona prompt tools to create:**
* **User Persona Prompts:** Define how user personas (candidates/trainees) should behave in the conversation. **IMPORTANT**: The user persona is ALWAYS the one practicing the skill being trained (e.g., delivering feedback, giving apologies, conducting interviews, etc.)
* **Agent Persona Prompts:** Define how agent personas (trainers/coaches/supervisors) should behave in the conversation. **IMPORTANT**: The agent persona is ALWAYS the one the user is practicing with (e.g., receiving feedback, being apologized to, being interviewed, etc.)

**CRITICAL ROLE CLARIFICATION:**
- For **feedback scenarios**: User = manager giving feedback, Agent = employee receiving feedback
- For **interview scenarios**: User = candidate being interviewed, Agent = interviewer
- For **apology scenarios**: User = person delivering apology, Agent = person receiving apology
- For **pitching scenarios**: User = person giving pitch, Agent = audience receiving pitch

**Use ALL available document generation tools:**
* **Look for ANY tool ending in `_doc`** - these are all document generation tools that MUST be called
* **Performance Review scenarios**: Use `perf_review_doc` to create formal review documentation with specific metrics and quantifiable data
* **Termination scenarios**: Use `incident_report_doc` to document the termination process and reasons with exact performance numbers
* **Apology scenarios**: Use `apology_report_doc` to document incident details, impact assessment, and corrective actions
* **Pitching scenarios**: Use `pitch_deck_doc` to create a comprehensive pitch presentation with market analysis and financial projections
* **Brainstorming scenarios**: Use `project_spec_doc` to create detailed project specifications with requirements and deliverables
* **Interview scenarios**: Use `sample_resume_doc` to create a professional resume template for interview practice
* **IMPORTANT**: If you see a tool ending in `_doc`, you must call it
* **CRITICAL**: Always include the `doc_name` parameter with a descriptive, specific name for each document

---

### Tool Call Requirements

You must call these tools to complete the scenario generation:

1. **`generate_scenario`** - Required
   - `title`: Candidate's name + topic
   - `problem_statement`: 2–3 sentence numeric, goal-anchored description

2. **`generate_objectives`** - Required  
   - `objectives`: Exactly 3 measurable, goal-aligned objectives

3. **Persona prompt tools** - Required (one for each persona)
   - `create_user1_prompt`, `create_user2_prompt`, etc. for user personas
   - `create_agent1_prompt`, `create_agent2_prompt`, etc. for agent personas
   - `prompt`: Custom behavior definition for each persona

4. **Document generation tools** - Required for ALL tools ending in `_doc`
   - **Required**: Call every tool that ends with `_doc`
   - **No exceptions**: If a tool ends in `_doc`, you must use it
   - **Completion requirement**: Task cannot be completed without calling all `_doc` tools
   - **Critical**: Always include `doc_name` parameter with a descriptive, specific name for each document

---

## ⚠️ FINAL REMINDER: TOOL CALL COMPLETION
**Before you finish, verify you have called:**
1. ✅ `generate_scenario`
2. ✅ `generate_objectives` 
3. ✅ All persona prompt tools (one for each persona)
4. ✅ **ALL tools ending in `_doc`** (this is mandatory!)

**If you skip any `_doc` tools, your task is incomplete!**

---

### Example (Interview Scenario)

**Tool Calls:**

1. `generate_scenario`:
   - `title`: "Avery Interviews for Business Analyst Role"
   - `problem_statement`: "The company is hiring a Business Analyst to support quarterly planning and cross-department reporting. The role requires managing 5–7 projects, delivering executive-ready reports within 48 hours, and contributing to a 10% efficiency improvement by year-end. Avery is interviewing to demonstrate readiness for these expectations."

2. `generate_objectives`:
   - `objectives`: [
     "Communicate experience managing multiple projects",
     "Show ability to produce accurate reports under deadlines", 
     "Demonstrate process improvement strategies that support a 10% efficiency gain"
   ]

3. `create_user1_prompt`:
   - `prompt`: "You are user1, a candidate interviewing for a Business Analyst role. You have experience with project management and data analysis. Be professional, ask thoughtful questions, and demonstrate your analytical thinking skills."

4. `create_agent1_prompt`:
   - `prompt`: "You are agent1, the hiring manager conducting an interview for a Business Analyst position. Focus on assessing project management experience, analytical skills, and cultural fit. Ask behavioral questions and evaluate responses against the role requirements."

---

### Example (Yearly Review)

**Tool Calls:**

1. `generate_scenario`:
   - `title`: "Sarah Conducts Year-End Performance Review with Taylor"
   - `problem_statement`: "Taylor delivered 8 of 12 assigned projects this year (67%), but two high-priority projects were delayed over three weeks. Client satisfaction also fell 15% compared to last year. Sarah, as the supervisor, must conduct a performance review to address these gaps and set targets for the next year."

2. `generate_objectives`:
   - `objectives`: [
     "Address performance gaps with specific data and examples",
     "Set clear, measurable goals for the next year",
     "Create a supportive environment for improvement and growth"
   ]

3. `create_user1_prompt`:
   - `prompt`: "You are user1, a supervisor conducting a year-end performance review with a team member who has had some challenges with project delivery. Focus on addressing performance gaps constructively, setting clear goals for next year, and maintaining a supportive but firm tone."

4. `create_agent1_prompt`:
   - `prompt`: "You are agent1, an employee receiving a year-end performance review. You've had some challenges with project delivery this year. Be honest about the issues, show accountability, and demonstrate commitment to improvement."

5. `perf_review_doc` (REQUIRED - this tool ends in `_doc`):
   - `doc_name`: "Taylor Johnson Q4 2024 Performance Review"
   - `company_name`: "TechCorp Solutions"
   - `employee_name`: "Taylor Johnson"
   - `position_held`: "Senior Project Manager"
   - `department`: "Engineering"
   - `reviewer_name`: "Sarah Chen"
   - `date_of_review`: "December 15, 2024"
   - `greatest_strengths`: "Strong technical skills and team collaboration. Successfully delivered 8 of 12 projects (67%) despite challenges."
   - `improvement_areas`: "Project timeline management and client communication. Need to improve deadline adherence from 67% to 90% and proactive status updates."
   - `achieved_goals`: "Completed 67% of assigned projects and maintained team morale during challenging periods."
   - `next_goals`: "Achieve 90% on-time delivery rate, improve client satisfaction scores by 20%, and implement better project tracking systems."

**Note**: If there were additional tools like `project_status_doc` or `incident_report_doc` available, you would also need to call ALL of them.

---

### Example (Termination Conversation)

**Tool Calls:**

1. `generate_scenario`:
   - `title`: "Alex Conducts Termination Discussion with Morgan"
   - `problem_statement`: "Over 12 months, Morgan missed 9 of 15 key deadlines and averaged an 18% error rate, more than triple the 5% benchmark. Two improvement plans failed, and client complaints rose 25%. Alex, as the supervisor, must conduct a respectful termination conversation aligned with company policy."

2. `generate_objectives`:
   - `objectives`: [
     "Clearly explain the decision with documented performance data",
     "Recognize Morgan's contributions while upholding accountability standards",
     "Provide details on severance, benefits, and transition support"
   ]

3. `create_user1_prompt`:
   - `prompt`: "You are user1, a supervisor conducting a termination conversation with an employee due to performance issues. Be respectful but firm, provide clear documentation of performance issues, and ensure all company policies are followed."

4. `create_agent1_prompt`:
   - `prompt`: "You are agent1, an employee being terminated due to performance issues. You're disappointed but understand the decision. Be respectful, ask questions about next steps, and maintain professionalism."

5. `incident_report_doc` (REQUIRED - this tool ends in `_doc`):
   - `doc_name`: "Morgan Davis Performance Termination Report"
   - `employee_name`: "Morgan Davis"
   - `job_title`: "Senior Developer"
   - `department`: "Engineering"
   - `supervisor`: "Alex Rodriguez"
   - `incident_date`: "December 10, 2024"
   - `incident_time`: "2:00 PM"
   - `incident_location`: "Conference Room A"
   - `incident_description`: "Performance termination discussion following documented performance issues over 12 months: missed 9 of 15 key deadlines (60% failure rate) and averaged 18% error rate (3.6x above 5% benchmark)."
   - `immediate_actions`: "Conducted respectful termination conversation, provided severance package details, and arranged for equipment return."
   - `root_cause`: "Consistent performance issues despite multiple improvement plans and support interventions over 12-month period."
   - `follow_up_actions`: "Process final paperwork, arrange for benefits continuation, and ensure smooth transition of work responsibilities."

---

### Example (Constructive Feedback)

**Tool Calls:**

1. `generate_scenario`:
   - `title`: "Jordan Delivers Constructive Feedback on Presentation Skills"
   - `problem_statement`: "This quarter, team member Riley's presentations averaged a 3.2/5 satisfaction score, below the team's 4.4 average. Client feedback noted jargon-heavy explanations and limited engagement, contributing to two lost renewals. Jordan, as the supervisor, must deliver constructive feedback to address communication effectiveness and help Riley improve."

2. `generate_objectives`:
   - `objectives`: [
     "Deliver specific, actionable feedback about presentation skills",
     "Create a supportive environment for improvement and growth",
     "Establish clear expectations and measurable goals for improvement"
   ]

3. `create_user1_prompt`:
   - `prompt`: "You are user1, a supervisor delivering constructive feedback to a team member about presentation skills. You want to help them improve while being supportive and specific. Focus on providing actionable suggestions and creating a positive environment for growth."

4. `create_agent1_prompt`:
   - `prompt`: "You are agent1, a team member receiving constructive feedback on presentation skills. You want to improve and are open to feedback. Ask questions about specific improvements and show commitment to change."

5. `perf_review_doc` (REQUIRED - this tool ends in `_doc`):
   - `doc_name`: "Riley Communication Skills Quarterly Review"
   - `company_name`: "TechCorp Solutions"
   - `employee_name`: "Riley Chen"
   - `position_held`: "Senior Consultant"
   - `department`: "Client Services"
   - `reviewer_name`: "Jordan Kim"
   - `date_of_review`: "December 1, 2024"
   - `greatest_strengths`: "Strong technical expertise and analytical thinking. Successfully managed 12 client accounts this quarter."
   - `improvement_areas`: "Presentation communication skills. Current satisfaction score of 3.2/5 needs improvement to meet team average of 4.4/5. Need to reduce technical jargon and increase client engagement."
   - `achieved_goals`: "Maintained client relationships despite communication challenges and completed all technical deliverables on time."
   - `next_goals`: "Raise presentation satisfaction scores to 4.5/5, adopt client-friendly language, and improve client engagement during presentations."

### Example (Apology Scenario)

**Tool Calls:**

1. `generate_scenario`:
   - `title`: "Alex Delivers Apology for Data Breach Incident"
   - `problem_statement`: "A security incident exposed 1,247 customer records due to a misconfigured database. The breach lasted 72 hours before detection, resulting in a 23% increase in customer complaints and potential regulatory penalties. Alex must deliver a formal apology to affected stakeholders and outline corrective measures."

2. `generate_objectives`:
   - `objectives`: [
     "Deliver sincere apology acknowledging the impact on affected customers",
     "Explain the technical root cause and immediate containment actions taken",
     "Present comprehensive prevention plan to rebuild stakeholder trust"
   ]

3. `create_user1_prompt`:
   - `prompt`: "You are user1, the manager who must deliver an apology for a data breach incident. You are the one practicing how to apologize and take responsibility. Be sincere, take full accountability for the incident, demonstrate commitment to preventing future incidents, and be prepared to answer tough questions from stakeholders."

4. `create_agent1_prompt`:
   - `prompt`: "You are agent1, an affected stakeholder who is receiving an apology for the data breach. You are the one the user is practicing with - you are being apologized to. Be concerned about the incident, ask specific questions about data protection, expect concrete action plans, and challenge the apologizer to ensure they understand the full impact."

5. `apology_report_doc` (REQUIRED - this tool ends in `_doc`):
   - `doc_name`: "Data Breach Incident Apology Report"
   - `company_name`: "SecureData Corp"
   - `incident_date`: "November 15, 2024"
   - `incident_description`: "Security incident involving misconfigured database that exposed 1,247 customer records for 72 hours before detection."
   - `affected_parties`: "1,247 customers with exposed personal data, regulatory bodies, business partners"
   - `incident_location`: "Primary data center, Database Server DB-03"
   - `impact_description`: "Customer data exposure, 23% increase in complaints, potential regulatory penalties, reputational damage"
   - `severity_level`: "High"
   - `business_impact`: "Regulatory investigation initiated, customer trust compromised, potential financial penalties"
   - `apologizer_name`: "Alex Rodriguez"
   - `apologizer_title`: "Chief Technology Officer"
   - `apology_date`: "November 20, 2024"
   - `apology_method`: "Stakeholder meeting and formal written communication"
   - `immediate_actions`: "Contained breach within 2 hours of detection, notified affected customers within 24 hours, engaged security consultants"
   - `preventive_measures`: "Implemented automated security monitoring, enhanced access controls, mandatory security training for all staff"
   - `follow_up_actions`: "Regular security audits, customer support hotline, ongoing monitoring and reporting"
   - `acknowledgment_received`: "Yes, from 78% of affected customers"
   - `response_from_affected`: "Mixed responses - some customers appreciated transparency, others expressed ongoing concerns about data protection"

### Example (Pitching Scenario)

**Tool Calls:**

1. `generate_scenario`:
   - `title`: "Jordan Pitches AI Automation Platform to Executive Team"
   - `problem_statement`: "The company currently processes 15,000 manual reports monthly at an average cost of $45 per report. Jordan's proposed AI automation platform could reduce processing time by 70% and costs by $315,000 annually. The executive team needs to approve a $180,000 investment for platform development and implementation."

2. `generate_objectives`:
   - `objectives`: [
     "Demonstrate clear ROI with specific cost savings projections",
     "Address implementation timeline and resource requirements",
     "Gain executive approval for $180,000 development budget"
   ]

3. `create_user1_prompt`:
   - `prompt`: "You are user1, a product manager pitching an AI automation platform to the executive team. Be confident, data-driven, and prepared to address concerns about implementation costs and timeline."

4. `create_agent1_prompt`:
   - `prompt`: "You are agent1, a skeptical executive evaluating the AI automation pitch. Ask tough questions about ROI, implementation risks, and competitive advantages."

5. `pitch_deck_doc` (REQUIRED - this tool ends in `_doc`):
   - `doc_name`: "AI Automation Platform Pitch Deck"
   - `company_name`: "InnovateTech Solutions"
   - `tagline`: "Transforming Manual Processes Through Intelligent Automation"
   - `presenter_name`: "Jordan Martinez"
   - `presenter_title`: "Product Manager, AI Solutions"
   - `presentation_date`: "December 10, 2024"
   - `problem_statement`: "Current manual report processing costs $675,000 annually with 15,000 reports at $45 each, creating inefficiencies and resource constraints."
   - `solution_description`: "AI-powered automation platform that processes reports with 70% time reduction and 65% cost savings through intelligent document analysis and automated workflow management."
   - `unique_value_proposition`: "Only platform combining natural language processing with industry-specific templates, reducing implementation time from 6 months to 8 weeks."
   - `target_market`: "Mid to large enterprises with high-volume document processing needs, particularly in finance, healthcare, and legal sectors"
   - `market_size`: "$2.3B document automation market growing at 15% annually"
   - `competition_analysis`: "Main competitors lack industry-specific customization and require 6+ month implementations. Our platform offers faster deployment and better ROI."
   - `revenue_model`: "SaaS subscription model with tiered pricing based on processing volume and feature access"
   - `pricing_strategy`: "Starter: $5,000/month (5,000 reports), Professional: $12,000/month (15,000 reports), Enterprise: Custom pricing"
   - `sales_strategy`: "Direct sales to enterprise accounts, partnerships with system integrators, freemium model for small businesses"
   - `funding_requirements`: "$180,000 for platform development and initial market entry"
   - `use_of_funds`: "$120,000 development team (6 months), $40,000 infrastructure, $20,000 marketing and sales"
   - `financial_projections`: "Break-even in 18 months, $2.1M ARR by year 2, 45% gross margins"
   - `team_overview`: "Experienced AI engineers with 15+ years combined experience in document processing and enterprise software"
   - `milestones`: "MVP in 3 months, beta testing in 5 months, full launch in 8 months, 50 customers by year 1"
   - `call_to_action`: "Approve $180,000 budget and provide 2 dedicated engineers for 6-month development sprint"

### Example (Brainstorming Scenario)

**Tool Calls:**

1. `generate_scenario`:
   - `title`: "Team Brainstorms Mobile App Strategy for Customer Engagement"
   - `problem_statement`: "Customer retention has dropped 12% over the past year, with mobile engagement particularly low at 23% compared to desktop's 67%. The team must develop a mobile app strategy to increase customer engagement by 40% and improve retention rates within 6 months."

2. `generate_objectives`:
   - `objectives`: [
     "Identify key features that will drive mobile customer engagement",
     "Create implementation roadmap with specific milestones and resources",
     "Establish success metrics and KPIs for mobile app performance"
   ]

3. `create_user1_prompt`:
   - `prompt`: "You are user1, a UX designer participating in a mobile app strategy brainstorming session. Bring creative ideas about user experience and interface design that will increase engagement."

4. `create_agent1_prompt`:
   - `prompt`: "You are agent1, a product manager facilitating the brainstorming session. Guide the discussion toward actionable solutions and ensure all ideas are evaluated against business objectives."

5. `create_agent2_prompt`:
   - `prompt`: "You are agent2, a marketing specialist participating in the brainstorming session. Build on others' ideas, ask thoughtful questions, and help synthesize different perspectives into cohesive strategies."

6. `project_spec_doc` (REQUIRED - this tool ends in `_doc`):
   - `doc_name`: "Mobile App Strategy Project Specification"
   - `project_name`: "Customer Engagement Mobile App Initiative"
   - `project_code`: "MOBILE-ENG-2024"
   - `project_manager`: "Taylor Kim"
   - `creation_date`: "December 5, 2024"
   - `version`: "1.0"
   - `project_description`: "Development of a comprehensive mobile app strategy to increase customer engagement by 40% and improve retention rates within 6 months through enhanced mobile user experience."
   - `objectives`: "Increase mobile engagement from 23% to 60%, improve overall customer retention by 15%, and establish mobile-first customer journey optimization"
   - `success_criteria`: "40% increase in mobile engagement, 15% improvement in retention rate, 4.5+ app store rating, 50% reduction in mobile bounce rate"
   - `background`: "Customer retention dropped 12% over past year with mobile engagement significantly lower than desktop (23% vs 67%). Need mobile-first strategy to compete effectively."
   - `project_scope`: "Mobile app design, development, testing, launch, and post-launch optimization. Includes user research, competitive analysis, and marketing strategy."
   - `functional_requirements`: "User authentication, personalized dashboard, push notifications, offline functionality, social sharing, customer support integration"
   - `non_functional_requirements`: "App loads in under 3 seconds, 99.9% uptime, supports iOS 14+ and Android 8+, handles 10,000 concurrent users"
   - `constraints`: "6-month timeline, $500,000 budget limit, must integrate with existing CRM system, compliance with data privacy regulations"
   - `key_deliverables`: "Mobile app MVP, user research report, competitive analysis, technical architecture document, launch marketing plan"
   - `project_phases`: "Phase 1: Research and Planning (4 weeks), Phase 2: Design and Prototyping (6 weeks), Phase 3: Development (12 weeks), Phase 4: Testing and Launch (6 weeks)"
   - `timeline`: "Project start: Dec 15, 2024. MVP delivery: March 15, 2025. Full launch: April 30, 2025"
   - `dependencies`: "CRM system API access, marketing team support, legal compliance review, app store approval processes"
   - `team_structure`: "Project Manager (1), UX/UI Designer (2), Mobile Developers (4), QA Engineer (2), Marketing Specialist (1)"
   - `resource_requirements`: "Development team, design tools, testing devices, marketing budget, third-party integrations"
   - `communication_plan`: "Weekly team standups, bi-weekly stakeholder updates, monthly executive reviews, daily Slack communication"
   - `risk_assessment`: "Technical complexity risk (mitigation: proof of concept), timeline risk (mitigation: agile development), budget overrun (mitigation: phased approach)"
   - `quality_assurance`: "Automated testing suite, user acceptance testing, performance testing, security audit, accessibility compliance"
   - `change_management`: "Change request process, impact assessment protocol, stakeholder approval workflow for scope modifications"

### Example (Interview Scenario with Resume)

**Tool Calls:**

1. `generate_scenario`:
   - `title`: "Casey Interviews for Software Engineer Position at TechStart"
   - `problem_statement`: "TechStart is hiring a Software Engineer to join their 12-person development team. The role requires building scalable web applications, managing 3-5 concurrent projects, and contributing to a 25% increase in development velocity. Casey is interviewing to demonstrate technical skills and cultural fit for this fast-paced startup environment."

2. `generate_objectives`:
   - `objectives`: [
     "Demonstrate technical proficiency in full-stack development",
     "Show ability to manage multiple projects and meet deadlines",
     "Communicate experience working in agile development environments"
   ]

3. `create_user1_prompt`:
   - `prompt`: "You are user1, a software engineer candidate interviewing for a position at a tech startup. Be enthusiastic about the role, demonstrate your technical skills, and show how you can contribute to team velocity and product development."

4. `create_agent1_prompt`:
   - `prompt`: "You are agent1, the technical lead conducting an interview for a Software Engineer position. Focus on assessing technical skills, project management experience, and cultural fit. Ask both technical and behavioral questions to evaluate the candidate's potential."

5. `sample_resume_doc` (REQUIRED - this tool ends in `_doc`):
   - `doc_name`: "Casey Thompson Software Engineer Resume"
   - `candidate_name`: "Casey Thompson"
   - `email`: "casey.thompson@email.com"
   - `phone`: "(555) 123-4567"
   - `location`: "San Francisco, CA"
   - `linkedin`: "linkedin.com/in/caseythompson"
   - `professional_summary`: "Full-stack software engineer with 4 years of experience building scalable web applications using React, Node.js, and Python. Proven track record of delivering high-quality code in agile environments and contributing to 30% improvement in development velocity."
   - `current_position`: "Senior Software Engineer"
   - `current_company`: "CloudTech Solutions"
   - `current_duration`: "2022 - Present"
   - `current_responsibilities`: "Developed and maintained 5+ web applications serving 50,000+ users. Led migration of legacy system to microservices architecture, reducing response time by 40%. Mentored 3 junior developers and established code review processes."
   - `previous_position`: "Software Engineer"
   - `previous_company`: "DataFlow Inc"
   - `previous_duration`: "2020 - 2022"
   - `previous_responsibilities`: "Built RESTful APIs and React frontend components for data visualization platform. Collaborated with cross-functional teams to deliver features on schedule. Implemented automated testing reducing bug reports by 25%."
   - `earlier_position`: "Junior Developer"
   - `earlier_company`: "StartupXYZ"
   - `earlier_duration`: "2019 - 2020"
   - `earlier_responsibilities`: "Assisted in development of mobile-responsive web applications. Participated in daily standups and sprint planning. Gained experience with Git, Docker, and AWS deployment."
   - `degree`: "Bachelor of Science in Computer Science"
   - `university`: "University of California, Berkeley"
   - `graduation_year`: "2019"
   - `gpa`: "3.7/4.0"
   - `technical_skills`: "JavaScript, Python, React, Node.js, SQL, MongoDB, Git, Docker, AWS, RESTful APIs, Agile/Scrum"
   - `soft_skills`: "Team collaboration, problem-solving, mentoring, code review, technical writing, project management"
   - `certifications`: "AWS Certified Developer Associate, Scrum Master Certification"
   - `languages`: "English (Native), Spanish (Conversational)"
   - `volunteer_experience`: "Volunteer coding instructor at local community center, teaching web development basics to high school students"
   - `interests`: "Open source contributions, hackathons, rock climbing, photography"

---

## 🔥 ABSOLUTE FINAL CHECKLIST

**Before submitting your response, ask yourself:**
1. ✅ Did I call `generate_scenario`?
2. ✅ Did I call `generate_objectives`?
3. ✅ Did I call ALL persona prompt tools (one for each persona)?
4. ✅ **Did I call EVERY tool that ends with `_doc`?** (This is the most important!)

**If the answer to ANY question is NO, your task is incomplete!**

**Remember: Tools ending in `_doc` are required!**