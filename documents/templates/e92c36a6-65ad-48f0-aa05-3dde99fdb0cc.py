"""
Incident Report Template Module.

Contract:
- Args: pydantic BaseModel (schema for kwargs)
- render(args: Args) -> bytes  # returns compiled PDF bytes

Optional:
- DEFAULT_FILENAME: str
"""

from typing import Optional

from pydantic import BaseModel, Field
# PyLaTeX
from pylatex import Command, Document, NoEscape, Package  # type: ignore
from pylatex.utils import bold  # type: ignore

DEFAULT_FILENAME = "incident-report"

class Args(BaseModel):
    # Employee Information
    employee_name: str = Field(default="", description="Employee's full name")
    employee_id: str = Field(default="", description="Employee ID number")
    job_title: str = Field(default="", description="Employee's job title")
    department: str = Field(default="", description="Employee's department")
    supervisor: str = Field(default="", description="Supervisor's name")
    employee_date: str = Field(default="", description="Date employee filled out the form")
    
    # Incident Details
    incident_date: str = Field(default="", description="Date of the incident")
    incident_time: str = Field(default="", description="Time of the incident")
    incident_location: str = Field(default="", description="Location where incident occurred")
    witnesses: str = Field(default="", description="Names of witnesses (if applicable)")
    incident_description: str = Field(default="", description="Detailed description of the incident")
    immediate_actions: str = Field(default="", description="Immediate actions taken after the incident")
    root_cause: str = Field(default="", description="Root cause analysis of the incident")
    
    # Follow-up Actions
    follow_up_actions: str = Field(default="", description="Follow-up actions to be taken")
    
    # Signatures
    employee_signature: str = Field(default="", description="Employee signature")
    supervisor_signature: str = Field(default="", description="Supervisor signature")
    
    # Received by
    receiver_name: str = Field(default="", description="Name of person receiving the report")
    receiver_date: str = Field(default="", description="Date report was received")
    receiver_signature: str = Field(default="", description="Signature of person receiving the report")
    
    # Document Styling
    fontsize_pt: int = Field(default=11, ge=8, le=20, description="Font size in points")
    paper: str = Field(default="letterpaper", description="Paper size (letterpaper|a4paper)")

def render(args: Args) -> bytes:
    """
    Build an incident report PDF using the provided LaTeX template structure.
    """
    doc = Document(
        documentclass="article",
        document_options=[f"{args.fontsize_pt}pt"],
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
  {\small Employees should use this form to report work‑related incidents to HR.}\par
}\par

\vspace{0.5cm}
""")
    doc.append(title_section)

    # Employee Information section
    employee_info = NoEscape(r"""
{\color{primary}\large\bfseries Employee Information}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.22\textwidth}|>{\raggedright\arraybackslash}p{0.28\textwidth}|>{\raggedright\arraybackslash}p{0.22\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Name & """ + args.employee_name + r""" & \cellcolor{labelbg}\small Employee ID & """ + args.employee_id + r""" \\
  \hline
  \cellcolor{labelbg}\small Job Title & """ + args.job_title + r""" & \cellcolor{labelbg}\small Department & """ + args.department + r""" \\
  \hline
  \cellcolor{labelbg}\small Supervisor & """ + args.supervisor + r""" & \cellcolor{labelbg}\small Date & """ + args.employee_date + r""" \\
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
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.15\textwidth}|>{\raggedright\arraybackslash}p{0.17\textwidth}|>{\raggedright\arraybackslash}p{0.15\textwidth}|>{\raggedright\arraybackslash}p{0.17\textwidth}|>{\raggedright\arraybackslash}p{0.15\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Date & """ + args.incident_date + r""" & \cellcolor{labelbg}\small Time & """ + args.incident_time + r""" & \cellcolor{labelbg}\small Location & """ + args.incident_location + r""" \\
  \hline
\end{tabularx}

% Additional incident details with longer narratives
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Witnesses (if applicable) & """ + args.witnesses + r""" \\
  \hline
  \cellcolor{labelbg}\small Description of the incident & \parbox[t][4cm][t]{\hsize}{ """ + args.incident_description + r""" } \\
  \hline
  \cellcolor{labelbg}\small Immediate actions taken & \parbox[t][3.5cm][t]{\hsize}{ """ + args.immediate_actions + r""" } \\
  \hline
  \cellcolor{labelbg}\small Root cause of the incident & \parbox[t][3.5cm][t]{\hsize}{ """ + args.root_cause + r""" } \\
  \hline
\end{tabularx}

\vspace{0.6cm}
""")
    doc.append(incident_details)

    # Follow-up actions section
    followup_section = NoEscape(r"""
{\color{primary}\large\bfseries Follow‑up actions}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|X|}
  \hline
  \parbox[t][4cm][t]{\hsize}{ """ + args.follow_up_actions + r""" } \\
  \hline
\end{tabularx}

\vspace{0.6cm}
""")
    doc.append(followup_section)

    # Signatures section
    signatures_section = NoEscape(r"""
{\color{primary}\large\bfseries Signatures}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|>{\raggedright\arraybackslash}p{0.20\textwidth}|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Employee signature & """ + args.employee_signature + r""" & \cellcolor{labelbg}\small Supervisor signature & """ + args.supervisor_signature + r""" \\
  \hline
\end{tabularx}

\vspace{0.6cm}
""")
    doc.append(signatures_section)

    # Received by section
    received_section = NoEscape(r"""
{\color{primary}\large\bfseries Received by}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.22\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Name & """ + args.receiver_name + r""" \\
  \hline
  \cellcolor{labelbg}\small Date & """ + args.receiver_date + r""" \\
  \hline
  \cellcolor{labelbg}\small Signature & """ + args.receiver_signature + r""" \\
  \hline
\end{tabularx}
""")
    doc.append(received_section)

    # Compile with latexmk + XeLaTeX; return bytes
    pdf, _ = doc.generate_pdf(  # type: ignore
        filepath=None,
        clean=True,
        clean_tex=True,
        compiler="xelatex",
        latexmk=True,
        silent=True,
    )
    return pdf  # type: ignore