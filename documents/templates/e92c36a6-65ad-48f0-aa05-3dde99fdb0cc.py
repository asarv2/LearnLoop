"""
Incident Report Template Module.

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

def render(args: Args) -> bytes:
    """
    Build an incident report PDF using the provided LaTeX template structure.
    """
    doc = Document(
        documentclass="article",
        document_options=["11pt"],
        page_numbers=True,
        indent=False,
        lmodern=False,
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
    doc.packages.append(Package("fontspec"))
    doc.packages.append(Package("microtype"))
    doc.packages.append(Package("hyperref"))

    # Define custom colours based off the source document
    doc.preamble.append(NoEscape(r"\definecolor{primary}{RGB}{56,32,107}   % dark purple used for section headings"))
    doc.preamble.append(NoEscape(r"\definecolor{labelbg}{RGB}{233,251,255} % light blue for label cells"))
    
    # Configure headers and footers
    doc.preamble.append(NoEscape(r"\pagestyle{fancy}"))
    doc.preamble.append(NoEscape(r"\fancyhf{}"))
    doc.preamble.append(NoEscape(r"\fancyfoot[R]{\small Page \thepage{} of \pageref{LastPage}}"))
    
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
  \cellcolor{labelbg}\small Name & """ + args.employee_name + r""" & \cellcolor{labelbg}\small Job Title & """ + args.job_title + r""" \\
  \hline
  \cellcolor{labelbg}\small Department & """ + args.department + r""" & \cellcolor{labelbg}\small Supervisor & """ + args.supervisor + r""" \\
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
  \cellcolor{labelbg}\small Date & """ + args.incident_date + r""" & \cellcolor{labelbg}\small Time & """ + args.incident_time + r""" \\
  \hline
  \cellcolor{labelbg}\small Location & """ + args.incident_location + r""" & \cellcolor{labelbg}\small & \\
  \hline
\end{tabularx}

% Additional incident details with longer narratives
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Description of the incident & \parbox[t][4cm][t]{\hsize}{ """ + args.incident_description + r""" } \\
  \hline
  \cellcolor{labelbg}\small Immediate actions taken & \parbox[t][3cm][t]{\hsize}{ """ + args.immediate_actions + r""" } \\
  \hline
  \cellcolor{labelbg}\small Root cause of the incident & \parbox[t][3cm][t]{\hsize}{ """ + args.root_cause + r""" } \\
  \hline
  \cellcolor{labelbg}\small Follow-up actions & \parbox[t][3cm][t]{\hsize}{ """ + args.follow_up_actions + r""" } \\
  \hline
\end{tabularx}

\vspace{0.6cm}
""")
    doc.append(incident_details)


    # Generate PDF using FILES_DIR
    import os
    import time
    
    try:
        # Generate filename with template name and timestamp
        timestamp = int(time.time())
        pdf_filename = f"incident_report_{timestamp}"  # No .pdf extension - PyLaTeX adds it
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