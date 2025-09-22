"""
Pitch Deck Template Module.

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

DEFAULT_FILENAME = "pitch_deck"
TEMPLATE_DESCRIPTION = "A professional pitch deck template for presenting business ideas to stakeholders. Includes company overview, problem statement, solution, market analysis, business model, financial projections, and team information."

class Args(BaseModel):
    # Company Information
    company_name: str = Field(default="Your Company Name", description="Company or project name")
    tagline: str = Field(default="", description="Company tagline or mission statement")
    presenter_name: str = Field(default="", description="Name of the presenter")
    presenter_title: str = Field(default="", description="Title of the presenter")
    presentation_date: str = Field(default="", description="Date of the presentation")
    
    # Problem & Solution
    problem_statement: str = Field(default="", description="Clear description of the problem being solved")
    solution_description: str = Field(default="", description="Description of the proposed solution")
    unique_value_proposition: str = Field(default="", description="What makes this solution unique")
    
    # Market Information
    target_market: str = Field(default="", description="Description of target market")
    market_size: str = Field(default="", description="Total addressable market size")
    competition_analysis: str = Field(default="", description="Analysis of competitors and competitive advantage")
    
    # Business Model
    revenue_model: str = Field(default="", description="How the company will generate revenue")
    pricing_strategy: str = Field(default="", description="Pricing approach and strategy")
    sales_strategy: str = Field(default="", description="How the company will acquire customers")
    
    # Financial Projections
    funding_requirements: str = Field(default="", description="Amount of funding being requested")
    use_of_funds: str = Field(default="", description="How the funding will be used")
    financial_projections: str = Field(default="", description="Key financial projections and milestones")
    
    # Team & Next Steps
    team_overview: str = Field(default="", description="Overview of key team members and their expertise")
    milestones: str = Field(default="", description="Key milestones and timeline")
    call_to_action: str = Field(default="", description="What you're asking from the audience")

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
    Build a pitch deck PDF using the provided LaTeX template structure.
    """
    doc = Document(
        documentclass="article",
        document_options=["11pt"],
        page_numbers=True,
        indent=False,
        lmodern=False,
    )

    # Page geometry: wider margins for presentation format
    doc.packages.append(Package("geometry", options=["margin=1in", "top=0.5in", "bottom=0.5in"]))
    
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

    # Define custom colours for pitch deck
    doc.preamble.append(NoEscape(r"\definecolor{primary}{RGB}{0,102,204}    % professional blue"))
    doc.preamble.append(NoEscape(r"\definecolor{accent}{RGB}{255,153,0}     % orange accent"))
    doc.preamble.append(NoEscape(r"\definecolor{labelbg}{RGB}{245,248,255}  % light blue for label cells"))
    
    # Configure headers and footers
    doc.preamble.append(NoEscape(r"\pagestyle{fancy}"))
    doc.preamble.append(NoEscape(r"\fancyhf{}"))
    doc.preamble.append(NoEscape(r"\fancyhead[L]{\small " + _escape_latex(args.company_name) + r"}"))
    doc.preamble.append(NoEscape(r"\fancyhead[R]{\small Pitch Deck}"))
    doc.preamble.append(NoEscape(r"\fancyfoot[R]{\small Page \thepage{} of \pageref{LastPage}}"))
    
    # Improve table row spacing
    doc.preamble.append(NoEscape(r"\renewcommand{\arraystretch}{1.4}"))
    
    # Do not indent paragraphs
    doc.preamble.append(NoEscape(r"\setlength{\parindent}{0pt}"))

    # Title Page
    title_page = NoEscape(r"""
{\centering
  {\huge\bfseries\color{primary}""" + _escape_latex(args.company_name) + r"""}\par
  \vspace{0.2cm}
  {\Large\color{accent}""" + _escape_latex(args.tagline) + r"""}\par
  \vspace{0.5cm}
  {\large\bfseries Pitch Deck}\par
  \vspace{0.3cm}
  {\normalsize Presented by: """ + _escape_latex(args.presenter_name) + r"""}\par
  {\normalsize """ + _escape_latex(args.presenter_title) + r"""}\par
  \vspace{0.2cm}
  {\small """ + _escape_latex(args.presentation_date) + r"""}\par
}
\newpage
""")
    doc.append(title_page)

    # Problem & Solution Section
    problem_solution = NoEscape(r"""
{\color{primary}\large\bfseries Problem \& Solution}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Problem Statement & """ + _escape_latex(args.problem_statement) + r""" \\
  \hline
  \cellcolor{labelbg}\small Solution Description & """ + _escape_latex(args.solution_description) + r""" \\
  \hline
  \cellcolor{labelbg}\small Unique Value Proposition & """ + _escape_latex(args.unique_value_proposition) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(problem_solution)

    # Market Analysis Section
    market_analysis = NoEscape(r"""
{\color{primary}\large\bfseries Market Analysis}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Target Market & """ + _escape_latex(args.target_market) + r""" \\
  \hline
  \cellcolor{labelbg}\small Market Size & """ + _escape_latex(args.market_size) + r""" \\
  \hline
  \cellcolor{labelbg}\small Competition Analysis & """ + _escape_latex(args.competition_analysis) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(market_analysis)

    # Business Model Section
    business_model = NoEscape(r"""
{\color{primary}\large\bfseries Business Model}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Revenue Model & """ + _escape_latex(args.revenue_model) + r""" \\
  \hline
  \cellcolor{labelbg}\small Pricing Strategy & """ + _escape_latex(args.pricing_strategy) + r""" \\
  \hline
  \cellcolor{labelbg}\small Sales Strategy & """ + _escape_latex(args.sales_strategy) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(business_model)

    # Financial Projections Section
    financial_projections = NoEscape(r"""
{\color{primary}\large\bfseries Financial Projections}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Funding Requirements & """ + _escape_latex(args.funding_requirements) + r""" \\
  \hline
  \cellcolor{labelbg}\small Use of Funds & """ + _escape_latex(args.use_of_funds) + r""" \\
  \hline
  \cellcolor{labelbg}\small Financial Projections & """ + _escape_latex(args.financial_projections) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(financial_projections)

    # Team & Next Steps Section
    team_next_steps = NoEscape(r"""
{\color{primary}\large\bfseries Team \& Next Steps}\par
\vspace{0.3cm}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Team Overview & """ + _escape_latex(args.team_overview) + r""" \\
  \hline
  \cellcolor{labelbg}\small Key Milestones & """ + _escape_latex(args.milestones) + r""" \\
  \hline
  \cellcolor{labelbg}\small Call to Action & """ + _escape_latex(args.call_to_action) + r""" \\
  \hline
\end{tabularx}

\vspace{0.5cm}
""")
    doc.append(team_next_steps)

    # Contact Information Footer
    contact_info = NoEscape(r"""
{\centering
  {\large\bfseries\color{primary}Thank You}\par
  \vspace{0.3cm}
  {\normalsize Questions \& Discussion}\par
  \vspace{0.2cm}
  {\small """ + _escape_latex(args.presenter_name) + r""" - """ + _escape_latex(args.presenter_title) + r"""}\par
}
\label{LastPage}
""")
    doc.append(contact_info)

    # Generate PDF using FILES_DIR
    import os
    import time
    
    try:
        # Generate filename with template name and timestamp
        timestamp = int(time.time())
        pdf_filename = f"pitch_deck_{timestamp}"  # No .pdf extension - PyLaTeX adds it
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
