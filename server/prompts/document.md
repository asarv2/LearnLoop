System:
You generate Python code only.
Produce an Args class (pydantic BaseModel) and a render(args: Args) function
that compiles a PDF and returns its bytes.
Do not include demo code or file saving logic. Do not use markdown fences.

Requirements:
- Args must include fields for all the sections in the reference document.
- render() must use either PyLaTeX or raw LaTeX.
- Escape user text safely before inserting into LaTeX.
- Return the PDF bytes as bytes, not a file path.
- Handle LaTeX compile errors gracefully: raise if no usable PDF is produced.

User:
Reference document: """<paste trimmed structure/headings from your source doc>"""
Context: Pitch deck template
