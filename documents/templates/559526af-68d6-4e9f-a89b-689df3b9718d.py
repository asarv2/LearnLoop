"""
Project Status Update Template Module.

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

DEFAULT_FILENAME = "project-status-update"
TEMPLATE_DESCRIPTION = "A comprehensive project status update template covering 30, 60, and 90-day milestones. Includes project information, status summaries, challenges, next steps, and optional metrics graphs for each time period."

class Args(BaseModel):
    # Project Information
    project_name: str = Field(default="", description="Name of the project")
    project_manager: str = Field(default="", description="Project manager's name")
    department: str = Field(default="", description="Department responsible for the project")
    report_date: str = Field(default="", description="Date of the status report")
    stakeholders: str = Field(default="", description="Key stakeholders involved")
    overall_status: str = Field(default="", description="Overall project status")
    
    # 30-Day Status
    thirty_day_summary: str = Field(default="", description="30-day project summary")
    thirty_day_graph: Optional[str] = Field(default=None, description="Path to 30-day metrics graph (optional)")
    thirty_day_challenges: str = Field(default="", description="30-day challenges faced")
    thirty_day_next_steps: str = Field(default="", description="30-day next steps")
    thirty_day_notes: str = Field(default="", description="30-day additional notes")
    
    # 60-Day Status
    sixty_day_summary: str = Field(default="", description="60-day project summary")
    sixty_day_graph: Optional[str] = Field(default=None, description="Path to 60-day metrics graph (optional)")
    sixty_day_challenges: str = Field(default="", description="60-day challenges faced")
    sixty_day_next_steps: str = Field(default="", description="60-day next steps")
    sixty_day_notes: str = Field(default="", description="60-day additional notes")
    
    # 90-Day Status
    ninety_day_summary: str = Field(default="", description="90-day project summary")
    ninety_day_graph: Optional[str] = Field(default=None, description="Path to 90-day metrics graph (optional)")
    ninety_day_challenges: str = Field(default="", description="90-day challenges faced")
    ninety_day_next_steps: str = Field(default="", description="90-day next steps")
    ninety_day_notes: str = Field(default="", description="90-day additional notes")
    
    # Document Styling
    fontsize_pt: int = Field(default=11, ge=8, le=20, description="Font size in points")
    paper: str = Field(default="letterpaper", description="Paper size (letterpaper|a4paper)")

def render(args: Args) -> bytes:
    """
    Build a project status update PDF using the provided LaTeX template structure.
    """
    doc = Document(
        documentclass="article",
        document_options=[f"{args.fontsize_pt}pt"],
        page_numbers=True,
        indent=False,
        lmodern=False,
    )

    # Page layout
    doc.packages.append(Package("geometry", options=["margin=1in", "top=0.75in", "bottom=0.75in"]))
    
    # Colour definitions for headings and labels
    doc.packages.append(Package("xcolor", options=["table"]))
    
    # Table and layout packages
    doc.packages.append(Package("tabularx"))
    doc.packages.append(Package("array"))
    
    # Graphics for graphs and logos
    doc.packages.append(Package("graphicx"))
    
    # Fancy headers/footers
    doc.packages.append(Package("fancyhdr"))
    doc.packages.append(Package("lastpage"))
    
    # Core packages
    doc.packages.append(Package("fontspec"))
    doc.packages.append(Package("microtype"))
    doc.packages.append(Package("hyperref"))

    # Define custom colours based off the source document
    doc.preamble.append(NoEscape(r"\definecolor{primary}{RGB}{14,104,202}   % blue headings"))
    doc.preamble.append(NoEscape(r"\definecolor{labelbg}{RGB}{242,242,242}   % light grey for label cells"))
    
    # Configure headers and footers
    doc.preamble.append(NoEscape(r"\pagestyle{fancy}"))
    doc.preamble.append(NoEscape(r"\fancyhf{}"))
    doc.preamble.append(NoEscape(r"\fancyfoot[R]{\small Page \thepage{} of \pageref{LastPage}}"))
    
    # Improve table spacing
    doc.preamble.append(NoEscape(r"\renewcommand{\arraystretch}{1.3}"))
    
    # Disable paragraph indentation
    doc.preamble.append(NoEscape(r"\setlength{\parindent}{0pt}"))
    
    # Conditional inclusion macro for graphs: displays an empty framed box if no image path is provided
    doc.preamble.append(NoEscape(r"""
\newcommand{\includeprojectgraph}[2][3.5cm]{%
  \ifx\relax\detokenize{\relax #2}\relax
    \fbox{\rule{0pt}{#1}\rule{0.95\linewidth}{0pt}}% placeholder box
  \else
    \includegraphics[height=#1,width=0.95\linewidth,keepaspectratio]{#2}% include provided image
  \fi
}
"""))

    # Title and subtitle
    title_section = NoEscape(r"""
{\centering
  {\color{primary}\bfseries\LARGE 30–60–90 Project Status Update}\par
  \vspace{0.2cm}
  {\small A concise summary of project progress, challenges and next steps across the first 90 days.}\par
}\par

\vspace{0.5cm}
""")
    doc.append(title_section)

    # Project information section
    project_info = NoEscape(r"""
{\color{primary}\large\bfseries Project Information}\par
\vspace{0.2cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.25\textwidth}|>{\raggedright\arraybackslash}p{0.35\textwidth}|>{\raggedright\arraybackslash}p{0.20\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Project Name & """ + args.project_name + r""" & \cellcolor{labelbg}\small Project Manager & """ + args.project_manager + r""" \\
  \hline
  \cellcolor{labelbg}\small Department & """ + args.department + r""" & \cellcolor{labelbg}\small Date & """ + args.report_date + r""" \\
  \hline
  \cellcolor{labelbg}\small Stakeholders & """ + args.stakeholders + r""" & \cellcolor{labelbg}\small Overall Status & """ + args.overall_status + r""" \\
  \hline
\end{tabularx}

\vspace{0.6cm}
""")
    doc.append(project_info)

    # Helper macro for each time period section
    doc.preamble.append(NoEscape(r"""
\newcommand{\statussection}[7]{%
  {\color{primary}\large\bfseries #1}\par
  \vspace{0.2cm}
  % Summary and graph side by side
  \begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.4\textwidth}|p{0.6\textwidth}|}
    \hline
    \cellcolor{labelbg}\small Summary & \cellcolor{labelbg}\small Key Metrics Graph \\
    \hline
    \parbox[t][3.5cm][t]{\hsize}{ #2 } & \includeprojectgraph[3.5cm]{#3} \\
    \hline
    \cellcolor{labelbg}\small Challenges & \cellcolor{labelbg}\small Next Steps \\
    \hline
    \parbox[t][2.5cm][t]{\hsize}{ #4 } & \parbox[t][2.5cm][t]{\hsize}{ #5 } \\
    \hline
    \cellcolor{labelbg}\small Additional Notes & \multicolumn{1}{>{\raggedright\arraybackslash}p{0.6\textwidth}|}{ #6 } \\
    \hline
  \end{tabularx}
  \vspace{0.6cm}
}
"""))

    # 30-Day Status Section
    thirty_day_section = NoEscape(r"""
\statussection{30‑Day Status}{ """ + args.thirty_day_summary + r""" }{ """ + (args.thirty_day_graph or "") + r""" }{ """ + args.thirty_day_challenges + r""" }{ """ + args.thirty_day_next_steps + r""" }{ """ + args.thirty_day_notes + r""" }
""")
    doc.append(thirty_day_section)

    # 60-Day Status Section
    sixty_day_section = NoEscape(r"""
\statussection{60‑Day Status}{ """ + args.sixty_day_summary + r""" }{ """ + (args.sixty_day_graph or "") + r""" }{ """ + args.sixty_day_challenges + r""" }{ """ + args.sixty_day_next_steps + r""" }{ """ + args.sixty_day_notes + r""" }
""")
    doc.append(sixty_day_section)

    # 90-Day Status Section
    ninety_day_section = NoEscape(r"""
\statussection{90‑Day Status}{ """ + args.ninety_day_summary + r""" }{ """ + (args.ninety_day_graph or "") + r""" }{ """ + args.ninety_day_challenges + r""" }{ """ + args.ninety_day_next_steps + r""" }{ """ + args.ninety_day_notes + r""" }
""")
    doc.append(ninety_day_section)

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