"""
Performance Review Template Module.

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

DEFAULT_FILENAME = "perf_review"
TEMPLATE_DESCRIPTION = "A professional performance review template for employee evaluations. Includes employee information, strengths and improvement areas, goal tracking, and reviewer details. Suitable for annual or quarterly performance assessments."

class Args(BaseModel):
    # Company Information
    company_name: str = Field(default="Your Company Name", description="Company name for header")
    
    # Employee Information
    employee_name: str = Field(default="", description="Employee's full name")
    position_held: str = Field(default="", description="Employee's current position")
    department: str = Field(default="", description="Employee's department")
    
    # Review Information
    reviewer_name: str = Field(default="", description="Name of the reviewer")
    date_of_review: str = Field(default="", description="Date of the performance review")
    
    # Performance Content
    greatest_strengths: str = Field(default="", description="Employee's greatest strengths and achievements")
    improvement_areas: str = Field(default="", description="Areas requiring improvement and development")
    achieved_goals: str = Field(default="", description="Goals achieved from previous review period")
    next_goals: str = Field(default="", description="Goals and objectives for next review period")

def render(args: Args) -> bytes:
    """
    Build a performance review PDF using the provided LaTeX template structure.
    """
    doc = Document(
        documentclass="article",
        document_options=["11pt"],
        page_numbers=True,
        indent=False,
        lmodern=False,
    )

    # Page geometry: match original margins (0.75in left/right, 0.5in top/bottom)
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
    doc.packages.append(Package("fontspec"))
    doc.packages.append(Package("microtype"))
    doc.packages.append(Package("hyperref"))

    # Define custom colours based off the source document
    doc.preamble.append(NoEscape(r"\definecolor{primary}{RGB}{14,104,202}    % blue used for section titles"))
    doc.preamble.append(NoEscape(r"\definecolor{labelbg}{RGB}{242,242,242}    % light grey for label cells"))
    
    # Configure headers and footers
    doc.preamble.append(NoEscape(r"\pagestyle{fancy}"))
    doc.preamble.append(NoEscape(r"\fancyhf{}"))
    doc.preamble.append(NoEscape(r"\fancyfoot[L]{\small\itshape Template downloaded from HelpJuice.com}"))
    doc.preamble.append(NoEscape(r"\fancyfoot[R]{\small Page \thepage{} of \pageref{LastPage}}"))
    
    # Improve table row spacing
    doc.preamble.append(NoEscape(r"\renewcommand{\arraystretch}{1.3}"))
    
    # Do not indent paragraphs
    doc.preamble.append(NoEscape(r"\setlength{\parindent}{0pt}"))

    # Header: company name
    header_table = NoEscape(r"""
{\centering
  {\huge\bfseries """ + args.company_name + r"""}\par
  \vspace{0.3cm}
  {\LARGE\color{primary}\bfseries Performance Review}\par
}

\vspace{0.5cm}
""")
    doc.append(header_table)

    # Employee Info section
    employee_info = NoEscape(r"""
{\color{primary}\large\bfseries Employee Information}\par
\vspace{0.2cm}

% Four-column table: labels in shaded cells and corresponding values
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash\hspace{0pt}}p{0.25\textwidth}|>{\raggedright\arraybackslash\hspace{0pt}}X|>{\raggedright\arraybackslash\hspace{0pt}}p{0.25\textwidth}|>{\raggedright\arraybackslash\hspace{0pt}}X|}
  \hline
  \rowcolor{labelbg}\small Employee Name & """ + args.employee_name + r""" & \rowcolor{labelbg}\small Department & """ + args.department + r""" \\
  \hline
  \rowcolor{labelbg}\small Position & """ + args.position_held + r""" & \rowcolor{labelbg}\small Reviewer & """ + args.reviewer_name + r""" \\
  \hline
  \rowcolor{labelbg}\small Review Date & """ + args.date_of_review + r""" & \rowcolor{labelbg}\small & \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(employee_info)

    # Strengths / Training Needs section
    strengths_section = NoEscape(r"""
{\color{primary}\large\bfseries Strengths / Training Needs}\par
\vspace{0.2cm}

% Table with one column: alternating shaded labels and blank areas of fixed height
\begin{tabularx}{\textwidth}{|X|}
  \hline
  \rowcolor{labelbg}\small Detail Employee's Greatest Strengths \\
  \hline
  % Leave an empty parbox to create a large blank area for narrative text.
  \parbox[t][4cm][t]{\hsize}{ """ + args.greatest_strengths + r""" }\\
  \hline
  \rowcolor{labelbg}\small Detail Aspects Requiring Improvement \\
  \hline
  \parbox[t][4cm][t]{\hsize}{ """ + args.improvement_areas + r""" }\\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(strengths_section)

    # Goals section
    goals_section = NoEscape(r"""
{\color{primary}\large\bfseries Goals}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|X|}
  \hline
  \rowcolor{labelbg}\small Achieved Goals Set In Previous Review? \\
  \hline
  \parbox[t][3cm][t]{\hsize}{ """ + args.achieved_goals + r""" }\\
  \hline
  \rowcolor{labelbg}\small Goals For Next Review Period \\
  \hline
  \parbox[t][3cm][t]{\hsize}{ """ + args.next_goals + r""" }\\
  \hline
\end{tabularx}
""")
    doc.append(goals_section)

    # Generate PDF using FILES_DIR
    import os
    import time
    
    try:
        # Generate filename with template name and timestamp
        timestamp = int(time.time())
        pdf_filename = f"perf_review_{timestamp}"  # No .pdf extension - PyLaTeX adds it
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