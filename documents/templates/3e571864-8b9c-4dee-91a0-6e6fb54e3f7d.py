"""
Incident Report Template Module.

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

DEFAULT_FILENAME = "incident_report"
TEMPLATE_DESCRIPTION = "A comprehensive incident report template for documenting workplace incidents, accidents, or safety issues. Includes employee information, incident details, witness information, root cause analysis, and follow-up actions with signature fields."

class Args(BaseModel):
    # Employee Information
    employee_name: str = Field(default="", description="Employee's full name")
    job_title: str = Field(default="", description="Employee's job title")
    department: str = Field(default="", description="Employee's department")
    supervisor: str = Field(default="", description="Supervisor's name")
    
    # Incident Details
    incident_date: str = Field(default="", description="Date of the incident")
    incident_time: str = Field(default="", description="Time of the incident")
    incident_location: str = Field(default="", description="Location where incident occurred")
    incident_description: str = Field(default="", description="Detailed description of what happened")
    immediate_actions: str = Field(default="", description="Immediate actions taken after the incident")
    root_cause: str = Field(default="", description="Root cause analysis of the incident")
    follow_up_actions: str = Field(default="", description="Follow-up actions to be taken")

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
    Build an incident report PDF using the provided LaTeX template structure.
    """
    doc = Document(
        documentclass="article",
        document_options=["11pt"],
        page_numbers=True,
        indent=False,
        lmodern=True,
    )

    # Page geometry: the margins approximate the source document
    doc.packages.append(Package("geometry", options=["margin=1in", "top=0.5in", "bottom=0.5in"]))
    
    # Colour support for headings and shaded cells
    doc.packages.append(Package("xcolor", options=["table"]))
    
    # Table packages
    doc.packages.append(Package("tabularx"))
    doc.packages.append(Package("array"))
    
    # Graphics (if you wish to include a logo later)
    doc.packages.append(Package("graphicx"))
    
    # Fancy headers/footers and last page referencing
    doc.packages.append(Package("fancyhdr"))
    doc.packages.append(Package("lastpage"))
    
    # Core packages
    # doc.packages.append(Package("fontspec"))  # removed to avoid NFSS conflicts
    doc.packages.append(Package("microtype"))
    doc.packages.append(Package("hyperref"))

    # Define custom colours based off the source document
    doc.preamble.append(NoEscape(r"\definecolor{primary}{RGB}{56,32,107}   % dark purple used for section headings"))
    doc.preamble.append(NoEscape(r"\definecolor{labelbg}{RGB}{233,251,255} % light blue for label cells"))
    
    # Configure headers and footers
    doc.preamble.append(NoEscape(r"\pagestyle{fancy}"))
    doc.preamble.append(NoEscape(r"\fancyhf{}"))
    
    # Improve table row spacing
    doc.preamble.append(NoEscape(r"\renewcommand{\arraystretch}{1.4}"))
    
    # No paragraph indentation
    doc.preamble.append(NoEscape(r"\setlength{\parindent}{0pt}"))

    # Title
    title_section = NoEscape(r"""
{\centering
  {\color{primary}\bfseries\LARGE Incident Report Form}\par
  \vspace{0.3cm}
  {\small Employees should use this form to report work-related incidents to HR.}\par
}\par

\vspace{0.5cm}
""")
    doc.append(title_section)

    # Employee Information section
    employee_info = NoEscape(r"""
{\color{primary}\large\bfseries Employee Information}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.25\textwidth}|>{\raggedright\arraybackslash}p{0.25\textwidth}|>{\raggedright\arraybackslash}p{0.25\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Name & """ + _escape_latex(args.employee_name) + r""" & \cellcolor{labelbg}\small Job Title & """ + _escape_latex(args.job_title) + r""" \\
  \hline
  \cellcolor{labelbg}\small Department & """ + _escape_latex(args.department) + r""" & \cellcolor{labelbg}\small Supervisor & """ + _escape_latex(args.supervisor) + r""" \\
  \hline
\end{tabularx}

\vspace{0.6cm}
""")
    doc.append(employee_info)

    # Incident Details section
    incident_details = NoEscape(r"""
{\color{primary}\large\bfseries Incident Details}\par
\vspace{0.2cm}

% Row for date/time/location (three pairs)
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.20\textwidth}|>{\raggedright\arraybackslash}p{0.20\textwidth}|>{\raggedright\arraybackslash}p{0.20\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Date & """ + _escape_latex(args.incident_date) + r""" & \cellcolor{labelbg}\small Time & """ + _escape_latex(args.incident_time) + r""" \\
  \hline
  \cellcolor{labelbg}\small Location & """ + _escape_latex(args.incident_location) + r""" & \cellcolor{labelbg}\small & \\
  \hline
\end{tabularx}

% Additional incident details with longer narratives
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Description of the incident & """ + _escape_latex(args.incident_description) + r""" \\
  \hline
  \cellcolor{labelbg}\small Immediate actions taken & """ + _escape_latex(args.immediate_actions) + r""" \\
  \hline
  \cellcolor{labelbg}\small Root cause of the incident & """ + _escape_latex(args.root_cause) + r""" \\
  \hline
  \cellcolor{labelbg}\small Follow-up actions & """ + _escape_latex(args.follow_up_actions) + r""" \\
  \hline
\end{tabularx}

\vspace{0.6cm}
""")
    doc.append(incident_details)


    # Compile to a temp dir; return bytes
    ts = int(time.time())
    stem = f"incident_report_{ts}"  # no .pdf suffix; PyLaTeX adds it
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