"""
Project Specification Template Module.

Contract:
- Args: pydantic BaseModel (schema for kwargs)
- render(args: Args) -> bytes  # returns compiled PDF bytes

Optional:
- DEFAULT_FILENAME: str
"""

import time
from pathlib import Path
from subprocess import CalledProcessError
from tempfile import TemporaryDirectory
from typing import Optional

from pydantic import BaseModel, Field
# PyLaTeX
from pylatex import Command, Document, NoEscape, Package  # type: ignore
from pylatex.utils import bold  # type: ignore

DEFAULT_FILENAME = "project_specification"
TEMPLATE_DESCRIPTION = "A comprehensive project specification template for documenting project requirements, scope, deliverables, timeline, and team structure. Suitable for software development, product launches, and other technical projects."

class Args(BaseModel):
    # Project Information
    project_name: str = Field(default="", description="Name of the project")
    project_code: str = Field(default="", description="Project code or identifier")
    project_manager: str = Field(default="", description="Name of the project manager")
    creation_date: str = Field(default="", description="Date when specification was created")
    version: str = Field(default="1.0", description="Version of the specification")
    
    # Project Overview
    project_description: str = Field(default="", description="High-level description of the project")
    objectives: str = Field(default="", description="Main objectives and goals of the project")
    success_criteria: str = Field(default="", description="How project success will be measured")
    background: str = Field(default="", description="Background and context for the project")
    
    # Scope & Requirements
    project_scope: str = Field(default="", description="What is included and excluded from the project")
    functional_requirements: str = Field(default="", description="Functional requirements and features")
    non_functional_requirements: str = Field(default="", description="Performance, security, and other non-functional requirements")
    constraints: str = Field(default="", description="Project constraints and limitations")
    
    # Deliverables & Timeline
    key_deliverables: str = Field(default="", description="Main deliverables and outputs")
    project_phases: str = Field(default="", description="Project phases and milestones")
    timeline: str = Field(default="", description="Project timeline and key dates")
    dependencies: str = Field(default="", description="Dependencies on other projects or resources")
    
    # Team & Resources
    team_structure: str = Field(default="", description="Project team structure and roles")
    resource_requirements: str = Field(default="", description="Human, technical, and financial resources needed")
    communication_plan: str = Field(default="", description="How project communication will be managed")
    
    # Risk & Quality
    risk_assessment: str = Field(default="", description="Identified risks and mitigation strategies")
    quality_assurance: str = Field(default="", description="Quality standards and testing approach")
    change_management: str = Field(default="", description="Process for managing scope and requirement changes")

def _escape_latex(text: str) -> str:
    """Escape special LaTeX characters in text."""
    if not text:
        return ""
    
    # Replace special LaTeX characters
    replacements = {
        '\\': r'\textbackslash{}',
        '{': r'\{',
        '}': r'\}',
        '$': r'\$',
        '&': r'\&',
        '%': r'\%',
        '#': r'\#',
        '^': r'\textasciicircum{}',
        '_': r'\_',
        '~': r'\textasciitilde{}',
    }
    
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    
    return text

def render(args: Args) -> bytes:
    """
    Build a project specification PDF using the provided LaTeX template structure.
    """
    doc = Document(
        documentclass="article",
        document_options=["11pt"],
        page_numbers=True,
        indent=False,
        lmodern=True,
    )

    # Page geometry: standard margins for documentation
    doc.packages.append(Package("geometry", options=["margin=1in", "top=0.75in", "bottom=0.75in"]))
    
    # Provide colours for headings and shaded cells
    doc.packages.append(Package("xcolor", options=["table"]))
    
    # Extended table capabilities
    doc.packages.append(Package("tabularx"))
    doc.packages.append(Package("array"))
    
    # Allow graphics for diagrams (optional)
    doc.packages.append(Package("graphicx"))
    
    # Configure headers and footers
    doc.packages.append(Package("fancyhdr"))
    doc.packages.append(Package("lastpage"))
    
    # Core packages
    # doc.packages.append(Package("fontspec"))  # removed to avoid NFSS conflicts
    doc.packages.append(Package("microtype"))
    doc.packages.append(Package("hyperref"))

    # Define custom colours for project documentation
    doc.preamble.append(NoEscape(r"\definecolor{primary}{RGB}{34,139,34}     % forest green"))
    doc.preamble.append(NoEscape(r"\definecolor{labelbg}{RGB}{240,255,240}   % light green for label cells"))
    
    # Configure headers and footers
    doc.preamble.append(NoEscape(r"\pagestyle{fancy}"))
    doc.preamble.append(NoEscape(r"\fancyhf{}"))
    doc.preamble.append(NoEscape(r"\fancyhead[L]{\small " + _escape_latex(args.project_name) + r" - Project Specification}"))
    doc.preamble.append(NoEscape(r"\fancyhead[R]{\small Version " + _escape_latex(args.version) + r"}"))
    
    # Improve table row spacing
    doc.preamble.append(NoEscape(r"\renewcommand{\arraystretch}{1.4}"))
    
    # Do not indent paragraphs
    doc.preamble.append(NoEscape(r"\setlength{\parindent}{0pt}"))

    # Title Page
    title_page = NoEscape(r"""
{\centering
  {\huge\bfseries\color{primary}Project Specification}\par
  \vspace{0.3cm}
  {\LARGE\bfseries """ + _escape_latex(args.project_name) + r"""}\par
  \vspace{0.2cm}
  {\large Project Code: """ + _escape_latex(args.project_code) + r"""}\par
  \vspace{0.5cm}
  \begin{tabular}{ll}
    Project Manager: & """ + _escape_latex(args.project_manager) + r""" \\
    Creation Date: & """ + _escape_latex(args.creation_date) + r""" \\
    Version: & """ + _escape_latex(args.version) + r""" \\
  \end{tabular}
}
\newpage
""")
    doc.append(title_page)

    # Project Overview Section
    project_overview = NoEscape(r"""
{\color{primary}\large\bfseries Project Overview}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Project Description & """ + _escape_latex(args.project_description) + r""" \\
  \hline
  \cellcolor{labelbg}\small Objectives & """ + _escape_latex(args.objectives) + r""" \\
  \hline
  \cellcolor{labelbg}\small Success Criteria & """ + _escape_latex(args.success_criteria) + r""" \\
  \hline
  \cellcolor{labelbg}\small Background & """ + _escape_latex(args.background) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(project_overview)

    # Scope & Requirements Section
    scope_requirements = NoEscape(r"""
{\color{primary}\large\bfseries Scope \& Requirements}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Project Scope & """ + _escape_latex(args.project_scope) + r""" \\
  \hline
  \cellcolor{labelbg}\small Functional Requirements & """ + _escape_latex(args.functional_requirements) + r""" \\
  \hline
  \cellcolor{labelbg}\small Non-Functional Requirements & """ + _escape_latex(args.non_functional_requirements) + r""" \\
  \hline
  \cellcolor{labelbg}\small Constraints & """ + _escape_latex(args.constraints) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(scope_requirements)

    # Deliverables & Timeline Section
    deliverables_timeline = NoEscape(r"""
{\color{primary}\large\bfseries Deliverables \& Timeline}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Key Deliverables & """ + _escape_latex(args.key_deliverables) + r""" \\
  \hline
  \cellcolor{labelbg}\small Project Phases & """ + _escape_latex(args.project_phases) + r""" \\
  \hline
  \cellcolor{labelbg}\small Timeline & """ + _escape_latex(args.timeline) + r""" \\
  \hline
  \cellcolor{labelbg}\small Dependencies & """ + _escape_latex(args.dependencies) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(deliverables_timeline)

    # Team & Resources Section
    team_resources = NoEscape(r"""
{\color{primary}\large\bfseries Team \& Resources}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Team Structure & """ + _escape_latex(args.team_structure) + r""" \\
  \hline
  \cellcolor{labelbg}\small Resource Requirements & """ + _escape_latex(args.resource_requirements) + r""" \\
  \hline
  \cellcolor{labelbg}\small Communication Plan & """ + _escape_latex(args.communication_plan) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(team_resources)

    # Risk & Quality Section
    risk_quality = NoEscape(r"""
{\color{primary}\large\bfseries Risk \& Quality Management}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Risk Assessment & """ + _escape_latex(args.risk_assessment) + r""" \\
  \hline
  \cellcolor{labelbg}\small Quality Assurance & """ + _escape_latex(args.quality_assurance) + r""" \\
  \hline
  \cellcolor{labelbg}\small Change Management & """ + _escape_latex(args.change_management) + r""" \\
  \hline
\end{tabularx}
""")
    doc.append(risk_quality)

    # Document Approval Section
    approval_section = NoEscape(r"""
\vspace{1cm}
{\color{primary}\large\bfseries Document Approval}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.25\textwidth}|>{\raggedright\arraybackslash}p{0.25\textwidth}|>{\raggedright\arraybackslash}p{0.25\textwidth}|>{\raggedright\arraybackslash}p{0.25\textwidth}|}
  \hline
  \cellcolor{labelbg}\small Role & \cellcolor{labelbg}\small Name & \cellcolor{labelbg}\small Signature & \cellcolor{labelbg}\small Date \\
  \hline
  \small Project Manager & & & \\
  \hline
  \small Stakeholder & & & \\
  \hline
  \small Technical Lead & & & \\
  \hline
\end{tabularx}
""")
    doc.append(approval_section)

    # Compile to a temp dir; return bytes
    ts = int(time.time())
    stem = f"project_spec_{ts}"  # no .pdf suffix; PyLaTeX adds it
    with TemporaryDirectory() as tmp:
        out = Path(tmp) / stem
        try:
            doc.generate_pdf(
                filepath=str(out),
                clean=True,
                clean_tex=True,
                compiler="xelatex",
                silent=True,
            )
        except CalledProcessError as e:
            pdf_file = out.with_suffix(".pdf")
            if not (pdf_file.exists() and pdf_file.stat().st_size > 0):
                raise RuntimeError(f"XeLaTeX failed and no PDF produced (code {e.returncode}).") from e
        pdf_file = out.with_suffix(".pdf")
        if not pdf_file.exists() or pdf_file.stat().st_size == 0:
            raise RuntimeError("PDF not generated or empty.")
        return pdf_file.read_bytes()
