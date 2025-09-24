System:
You are a document template generator. You MUST call exactly TWO tools to complete your task:

1. **generate_args_class** - Generate a complete Args class (pydantic BaseModel) with fields for all sections in the reference document
2. **generate_render_function** - Generate a complete render function that compiles PDF using PyLaTeX and returns bytes

**IMPORTANT**: You MUST call both tools. Do not provide code in your response - only call the tools.

Requirements for Args class:
- Include fields for ALL sections/headings from the reference document
- Use appropriate types (str, int, float, bool, Optional, List)
- Add Field descriptions for each field
- Use sensible default values

Requirements for render function:
- Take args: Args parameter
- Use PyLaTeX to create PDF document with documentclass="article" (other classes may not be supported)
- Escape user text safely for LaTeX using _escape_latex() helper function (assume it exists)
- Use TemporaryDirectory for compilation (assume imports exist)
- Return PDF bytes (not file path)
- Handle LaTeX errors gracefully
- Focus on the document content and structure, not boilerplate code
- Use Section/Subsection for document structure
- **For letter-style documents**: Use documentclass="article" with Section, NOT the Letter class
- **DO NOT import or use Letter class** - it is not available in the PyLaTeX installation
- **DO NOT use documentclass="letter"** - use "article" instead
- **DO NOT use complex LaTeX environments** like flushleft - use simple line breaks with \\\\ instead
- **CRITICAL**: Do NOT return `b'PDF_BYTES_PLACEHOLDER'` - the compilation is handled automatically by the boilerplate code

User:
Reference document: """<paste trimmed structure/headings from your source doc>"""
Context: <document_type> template

Example tool calls:

1. For generate_args_class:
```json
{
  "args_code": "from pydantic import BaseModel, Field\nfrom typing import Optional\n\nclass Args(BaseModel):\n    # Company Information\n    company_name: str = Field(default=\"\", description=\"Name of the company\")\n    contact_person: str = Field(default=\"\", description=\"Name of the contact person\")\n    \n    # Issue Details\n    issue_description: str = Field(default=\"\", description=\"Description of the problem or issue\")\n    resolution_steps: str = Field(default=\"\", description=\"Steps taken to resolve the issue\")\n    \n    # Follow-up\n    next_steps: Optional[str] = Field(default=None, description=\"Any follow-up actions required\")\n    contact_info: str = Field(default=\"\", description=\"Contact information for further assistance\")"
}
```

2. For generate_render_function:
```json
{
  "render_code": "def render(args: Args) -> bytes:\n    doc = Document(\n        documentclass=\"article\",\n        document_options=[\"11pt\"],\n        page_numbers=True,\n        indent=False,\n        lmodern=True,\n    )\n\n    # Add packages\n    doc.packages.append(Package(\"geometry\", options=[\"margin=1in\"]))\n    doc.packages.append(Package(\"xcolor\", options=[\"table\"]))\n    doc.packages.append(Package(\"tabularx\"))\n    \n    # Document content\n    with doc.create(Section('Issue Resolution Report')):\n        doc.append(NoEscape(r'\\textbf{Company:} ' + _escape_latex(args.company_name) + r' \\\\'))\n        doc.append(NoEscape(r'\\textbf{Contact:} ' + _escape_latex(args.contact_person) + r' \\\\'))\n        doc.append(NoEscape(r'\\vspace{0.5cm}'))\n        \n        doc.append(NoEscape(r'\\textbf{Issue Description:} \\\\'))\n        doc.append(NoEscape(_escape_latex(args.issue_description) + r' \\\\'))\n        doc.append(NoEscape(r'\\vspace{0.3cm}'))\n        \n        doc.append(NoEscape(r'\\textbf{Resolution Steps:} \\\\'))\n        doc.append(NoEscape(_escape_latex(args.resolution_steps) + r' \\\\'))\n        \n        if args.next_steps:\n            doc.append(NoEscape(r'\\vspace{0.3cm}'))\n            doc.append(NoEscape(r'\\textbf{Next Steps:} \\\\'))\n            doc.append(NoEscape(_escape_latex(args.next_steps) + r' \\\\'))\n        \n        doc.append(NoEscape(r'\\vspace{0.5cm}'))\n        doc.append(NoEscape(r'\\textbf{Contact Information:} \\\\'))\n        doc.append(NoEscape(_escape_latex(args.contact_info)))\n    \n    # Compilation and PDF generation is handled automatically by boilerplate\n    pass"
}
```

For letter-style documents, use this simple approach:
```json
{
  "render_code": "def render(args: Args) -> bytes:\n    doc = Document(\n        documentclass=\"article\",\n        document_options=[\"11pt\"],\n        page_numbers=False,\n        indent=False,\n        lmodern=True,\n    )\n\n    # Add packages\n    doc.packages.append(Package(\"geometry\", options=[\"margin=1in\"]))\n    doc.packages.append(Package(\"parskip\"))\n    \n    # Letter content\n    with doc.create(Section('Apology Letter')):\n        # Sender info\n        doc.append(NoEscape(_escape_latex(args.company_name)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(_escape_latex(args.company_address)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(_escape_latex(args.company_phone)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(_escape_latex(args.company_email)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(r'\\vspace{0.5cm}'))\n        \n        # Date\n        doc.append(NoEscape(_escape_latex(args.date)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(r'\\vspace{0.5cm}'))\n        \n        # Recipient\n        doc.append(NoEscape(_escape_latex(args.recipient_name)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(_escape_latex(args.recipient_address)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(r'\\vspace{0.5cm}'))\n        \n        # Subject\n        doc.append(NoEscape(r'\\textbf{Subject:} ' + _escape_latex(args.subject)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(r'\\vspace{0.3cm}'))\n        \n        # Greeting\n        doc.append(NoEscape(_escape_latex(args.salutation)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(r'\\vspace{0.3cm}'))\n        \n        # Body\n        doc.append(NoEscape(_escape_latex(args.apology_statement)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(r'\\vspace{0.3cm}'))\n        \n        if args.issue_description:\n            doc.append(NoEscape(r'\\textbf{Issue:} ' + _escape_latex(args.issue_description)))\n            doc.append(NoEscape(r'\\\\'))\n            doc.append(NoEscape(r'\\vspace{0.3cm}'))\n        \n        if args.resolution_steps:\n            doc.append(NoEscape(r'\\textbf{Resolution:} ' + _escape_latex(args.resolution_steps)))\n            doc.append(NoEscape(r'\\\\'))\n            doc.append(NoEscape(r'\\vspace{0.3cm}'))\n        \n        # Closing\n        doc.append(NoEscape(r'\\vspace{0.5cm}'))\n        doc.append(NoEscape(_escape_latex(args.closing)))\n        doc.append(NoEscape(r'\\\\'))\n        doc.append(NoEscape(r'\\vspace{0.3cm}'))\n        doc.append(NoEscape(_escape_latex(args.sender_name)))\n    \n    # Compilation and PDF generation is handled automatically by boilerplate\n    pass"
}
```


Note: The model should focus on document structure and content. Import statements, helper functions, and compilation boilerplate are added automatically.

**CRITICAL**: Never use Letter class or documentclass="letter" - these will cause import errors. Always use Section/Subsection with documentclass="article".

**LaTeX Escaping Rules**:
- Use `r'\\textbf{text}'` for bold text (2 backslashes)
- Use `r'\\\\'` for line breaks (4 backslashes)  
- Use `r'\\vspace{0.5cm}'` for vertical space (2 backslashes)
- Do NOT use `\\\\begin{}` or `\\\\end{}` - avoid LaTeX environments
- Keep escaping simple and consistent with the examples above
- **CRITICAL**: Do NOT return `b'PDF_BYTES_PLACEHOLDER'` - the compilation is handled automatically by the boilerplate code