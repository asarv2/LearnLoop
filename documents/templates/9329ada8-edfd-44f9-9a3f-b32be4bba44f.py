"""
Apology Report Template Module.

Contract:
- Args: pydantic BaseModel (schema for kwargs)
- render(args: Args) -> bytes  # returns compiled PDF bytes

Optional:
- DEFAULT_FILENAME: str
"""

from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field
# PyLaTeX
from pylatex import Command, Document, NoEscape, Package  # type: ignore
from pylatex.utils import bold  # type: ignore

# Define the files directory path
FILES_DIR = Path(__file__).parent.parent / "files"
FILES_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_FILENAME = "apology_report"
TEMPLATE_DESCRIPTION = "A professional apology report template for documenting workplace incidents that require formal apologies. Includes incident details, impact assessment, corrective actions, and apology delivery documentation."

class Args(BaseModel):
    # Company Information
    company_name: str = Field(default="Your Company Name", description="Company name for header")
    
    # Incident Information
    incident_date: str = Field(default="", description="Date when the incident occurred")
    incident_description: str = Field(default="", description="Detailed description of what happened")
    affected_parties: str = Field(default="", description="Names and roles of affected employees/parties")
    incident_location: str = Field(default="", description="Location where incident occurred")
    
    # Impact Assessment
    impact_description: str = Field(default="", description="Description of how the incident affected people/operations")
    severity_level: str = Field(default="", description="Severity level (Low, Medium, High, Critical)")
    business_impact: str = Field(default="", description="Impact on business operations, if any")
    
    # Apology Details
    apologizer_name: str = Field(default="", description="Name of person delivering the apology")
    apologizer_title: str = Field(default="", description="Title/position of the apologizer")
    apology_date: str = Field(default="", description="Date when apology was delivered")
    apology_method: str = Field(default="", description="Method of apology delivery (in-person, written, meeting)")
    
    # Corrective Actions
    immediate_actions: str = Field(default="", description="Immediate actions taken to address the incident")
    preventive_measures: str = Field(default="", description="Measures put in place to prevent recurrence")
    follow_up_actions: str = Field(default="", description="Ongoing follow-up actions planned")
    
    # Acknowledgment
    acknowledgment_received: str = Field(default="", description="Whether acknowledgment was received from affected parties")
    response_from_affected: str = Field(default="", description="Response or feedback from affected parties")

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
    Build an apology report PDF using the provided LaTeX template structure.
    """
    doc = Document(
        documentclass="article",
        document_options=["11pt"],
        page_numbers=True,
        indent=False,
        lmodern=True,
    )

    # Page geometry: match original margins
    doc.packages.append(Package("geometry", options=["margin=0.75in", "top=0.5in", "bottom=0.5in"]))
    
    # Provide colours for headings and shaded cells
    doc.packages.append(Package("xcolor", options=["table"]))
    
    # Extended table capabilities
    doc.packages.append(Package("tabularx"))
    doc.packages.append(Package("array"))
    
    # Allow graphics for company logos (optional)
    doc.packages.append(Package("graphicx"))
    
    # Configure headers and footers
    doc.packages.append(Package("fancyhdr"))
    doc.packages.append(Package("lastpage"))
    
    # Core packages
    # doc.packages.append(Package("fontspec"))  # removed to avoid NFSS conflicts
    doc.packages.append(Package("microtype"))
    doc.packages.append(Package("hyperref"))

    # Define custom colours
    doc.preamble.append(NoEscape(r"\definecolor{primary}{RGB}{220,38,127}    % red-pink for incident reports"))
    doc.preamble.append(NoEscape(r"\definecolor{labelbg}{RGB}{255,245,245}   % light red for label cells"))
    
    # Configure headers and footers
    doc.preamble.append(NoEscape(r"\pagestyle{fancy}"))
    doc.preamble.append(NoEscape(r"\fancyhf{}"))
    
    # Improve table row spacing
    doc.preamble.append(NoEscape(r"\renewcommand{\arraystretch}{1.3}"))
    
    # Do not indent paragraphs
    doc.preamble.append(NoEscape(r"\setlength{\parindent}{0pt}"))

    # Header: company name and title
    header_table = NoEscape(r"""
{\centering
  {\huge\bfseries """ + args.company_name + r"""}\par
  \vspace{0.3cm}
  {\LARGE\color{primary}\bfseries Incident Apology Report}\par
}
\vspace{0.5cm}
""")
    doc.append(header_table)

    # Incident Information section
    incident_info = NoEscape(r"""
{\color{primary}\large\bfseries Incident Information}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.25\textwidth}|>{\raggedright\arraybackslash}p{0.25\textwidth}|>{\raggedright\arraybackslash}p{0.25\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Incident Date & """ + _escape_latex(args.incident_date) + r""" & \cellcolor{labelbg}\small Location & """ + _escape_latex(args.incident_location) + r""" \\
  \hline
  \cellcolor{labelbg}\small Affected Parties & """ + _escape_latex(args.affected_parties) + r""" & \cellcolor{labelbg}\small Severity & """ + _escape_latex(args.severity_level) + r""" \\
  \hline
\end{tabularx}

\vspace{0.3cm}
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Incident Description & """ + _escape_latex(args.incident_description) + r""" \\
  \hline
  \cellcolor{labelbg}\small Impact Description & """ + _escape_latex(args.impact_description) + r""" \\
  \hline
  \cellcolor{labelbg}\small Business Impact & """ + _escape_latex(args.business_impact) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(incident_info)

    # Apology Details section
    apology_details = NoEscape(r"""
{\color{primary}\large\bfseries Apology Details}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.25\textwidth}|>{\raggedright\arraybackslash}p{0.25\textwidth}|>{\raggedright\arraybackslash}p{0.25\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Apologizer Name & """ + _escape_latex(args.apologizer_name) + r""" & \cellcolor{labelbg}\small Title & """ + _escape_latex(args.apologizer_title) + r""" \\
  \hline
  \cellcolor{labelbg}\small Apology Date & """ + _escape_latex(args.apology_date) + r""" & \cellcolor{labelbg}\small Method & """ + _escape_latex(args.apology_method) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(apology_details)

    # Corrective Actions section
    corrective_actions = NoEscape(r"""
{\color{primary}\large\bfseries Corrective Actions}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Immediate Actions Taken & """ + _escape_latex(args.immediate_actions) + r""" \\
  \hline
  \cellcolor{labelbg}\small Preventive Measures & """ + _escape_latex(args.preventive_measures) + r""" \\
  \hline
  \cellcolor{labelbg}\small Follow-up Actions & """ + _escape_latex(args.follow_up_actions) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(corrective_actions)

    # Acknowledgment section
    acknowledgment = NoEscape(r"""
{\color{primary}\large\bfseries Acknowledgment \& Response}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Acknowledgment Received & """ + _escape_latex(args.acknowledgment_received) + r""" \\
  \hline
  \cellcolor{labelbg}\small Response from Affected Parties & """ + _escape_latex(args.response_from_affected) + r""" \\
  \hline
\end{tabularx}
""")
    doc.append(acknowledgment)

    # Generate PDF using FILES_DIR
    import os
    import time
    
    try:
        # Generate filename with template name and timestamp
        timestamp = int(time.time())
        pdf_filename = f"apology_report_{timestamp}"  # No .pdf extension - PyLaTeX adds it
        pdf_path = FILES_DIR / pdf_filename
        
        # Generate PDF to FILES_DIR
        doc.generate_pdf(
            filepath=str(pdf_path),
            clean=True,
            clean_tex=True,
            compiler="xelatex",
            silent=True,
        )
        
        # Check if file was created and has content (PyLaTeX adds .pdf extension)
        pdf_file_path = pdf_path.with_suffix('.pdf')
        if not pdf_file_path.exists():
            raise Exception(f"PDF file was not created at {pdf_file_path}")
        
        file_size = pdf_file_path.stat().st_size
        if file_size == 0:
            raise Exception(f"PDF file is empty (0 bytes) at {pdf_file_path}")
        
        # Read the generated PDF bytes
        with open(pdf_file_path, 'rb') as f:
            pdf_bytes = f.read()
        
        # Keep the file for later retrieval
        # pdf_path.unlink()  # Commented out to persist the file
        
        return pdf_bytes
    except Exception as e:
        # Clean up the generated file if it exists
        if 'pdf_path' in locals() and pdf_path.exists():
            pdf_path.unlink()
        raise Exception(f"PDF generation failed: {e}")
