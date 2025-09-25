## 📄 DOCUMENT GENERATION SECTION

**This section is only included when document generation tools are available.**

### Document Tool Requirements

**You MUST call ALL available document generation tools to complete this task:**
- **ALL tools ending in `_doc` (required)**

### Document Tool Instructions

5. **`[name]_doc`**: Generate documents for parameters that have templates
   - `perf_review_doc`: Performance review document
   - `incident_report_doc`: Incident report document
   - `apology_report_doc`: Apology report document
   - `pitch_deck_doc`: Pitch deck document
   - `project_spec_doc`: Project specification document
   - `sample_resume_doc`: Sample resume document
   - **ANY tool ending in `_doc`**: These are all document generation tools
   - **IMPORTANT**: Always include `doc_name` parameter with a descriptive name for the document

### Document Generation Instructions

**Use ALL available document generation tools:**
* **Look for ANY tool ending in `_doc`** - these are all document generation tools that MUST be called
* **Performance Review scenarios**: Use `perf_review_doc` to create formal review documentation with specific metrics and quantifiable data
* **Termination scenarios**: Use `incident_report_doc` to document the termination process and reasons with exact performance numbers
* **Pitching scenarios**: Use `pitch_deck_doc` to create a comprehensive pitch presentation with market analysis and financial projections
* **Interview scenarios**: Use `sample_resume_doc` to create a professional resume template for interview practice
* **IMPORTANT**: If you see a tool ending in `_doc`, you must call it
* **CRITICAL**: Always include the `doc_name` parameter with a descriptive, specific name for each document

**🚨 CRITICAL: USE ACTUAL PERSONA NAMES IN DOCUMENTS - NO EXCEPTIONS**
* **For interview scenarios**: Use the actual agent persona name in `sample_resume_doc` (e.g., if agent1 is "Chloe", use "Chloe" as the candidate_name)
* **For performance reviews**: Use actual persona names in `perf_review_doc` 
* **For termination scenarios**: Use actual persona names in `incident_report_doc`
* **For pitching scenarios**: Use actual persona names in `pitch_deck_doc`
* **NEVER use generic names like "Alex Morgan" when actual persona names are provided**
* **ALWAYS check the persona information provided and use those exact names**

### Document Tool Call Requirements

4. **Document generation tools** - Required for ALL tools ending in `_doc`
   - **Required**: Call every tool that ends with `_doc`
   - **No exceptions**: If a tool ends in `_doc`, you must use it
   - **Completion requirement**: Task cannot be completed without calling all `_doc` tools
   - **Critical**: Always include `doc_name` parameter with a descriptive, specific name for each document
   - **🚨 CRITICAL**: Use actual persona names in document fields (e.g., if agent1 is "Chloe", use "Chloe" as candidate_name, NOT "Alex Morgan" or any generic name)

### Document Examples

#### Performance Review Example
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

#### Termination Example
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

#### Pitch Deck Example
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

#### Resume Example
5. `sample_resume_doc` (REQUIRED - this tool ends in `_doc`):
   - `doc_name`: "Casey Thompson Software Engineer Resume"
   - `candidate_name`: "Casey Thompson" (use the actual agent persona name)
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

### Document Final Checklist

**Before submitting your response, verify you have called:**
1. ✅ `generate_scenario`
2. ✅ `generate_objectives` 
3. ✅ All persona prompt tools (one for each persona)
4. ✅ **ALL tools ending in `_doc`** (this is mandatory!)

**If you skip any `_doc` tools, your task is incomplete!**

**Remember: Tools ending in `_doc` are required!**
