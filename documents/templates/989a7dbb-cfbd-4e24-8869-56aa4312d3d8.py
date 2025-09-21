"""
Sample Resume Template Module.

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

DEFAULT_FILENAME = "sample_resume"
TEMPLATE_DESCRIPTION = "A professional resume template for interview training scenarios. Includes personal information, professional summary, work experience, education, skills, and achievements. Suitable for various positions and industries."

class Args(BaseModel):
    # Personal Information
    candidate_name: str = Field(default="", description="Candidate's full name")
    email: str = Field(default="", description="Email address")
    phone: str = Field(default="", description="Phone number")
    location: str = Field(default="", description="City, State/Country")
    linkedin: str = Field(default="", description="LinkedIn profile URL")
    
    # Professional Summary
    professional_summary: str = Field(default="", description="Brief professional summary and career objectives")
    
    # Work Experience
    current_position: str = Field(default="", description="Current job title and company")
    current_company: str = Field(default="", description="Current company name")
    current_duration: str = Field(default="", description="Duration at current position")
    current_responsibilities: str = Field(default="", description="Key responsibilities and achievements at current role")
    
    previous_position: str = Field(default="", description="Previous job title and company")
    previous_company: str = Field(default="", description="Previous company name")
    previous_duration: str = Field(default="", description="Duration at previous position")
    previous_responsibilities: str = Field(default="", description="Key responsibilities and achievements at previous role")
    
    earlier_position: str = Field(default="", description="Earlier job title and company")
    earlier_company: str = Field(default="", description="Earlier company name")
    earlier_duration: str = Field(default="", description="Duration at earlier position")
    earlier_responsibilities: str = Field(default="", description="Key responsibilities and achievements at earlier role")
    
    # Education
    degree: str = Field(default="", description="Highest degree earned")
    university: str = Field(default="", description="University or institution name")
    graduation_year: str = Field(default="", description="Year of graduation")
    gpa: str = Field(default="", description="GPA (if applicable)")
    
    # Skills & Certifications
    technical_skills: str = Field(default="", description="Technical skills and proficiencies")
    soft_skills: str = Field(default="", description="Soft skills and personal attributes")
    certifications: str = Field(default="", description="Professional certifications and licenses")
    
    # Additional Information
    languages: str = Field(default="", description="Languages spoken and proficiency levels")
    volunteer_experience: str = Field(default="", description="Volunteer work or community involvement")
    interests: str = Field(default="", description="Personal interests and hobbies")

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
    Build a sample resume PDF using the provided LaTeX template structure.
    """
    doc = Document(
        documentclass="article",
        document_options=["11pt"],
        page_numbers=False,
        indent=False,
        lmodern=False,
    )

    # Page geometry: narrow margins for resume format
    doc.packages.append(Package("geometry", options=["margin=0.75in", "top=0.5in", "bottom=0.5in"]))
    
    # Provide colours for headings and shaded cells
    doc.packages.append(Package("xcolor", options=["table"]))
    
    # Extended table capabilities
    doc.packages.append(Package("tabularx"))
    doc.packages.append(Package("array"))
    
    # Core packages
    doc.packages.append(Package("fontspec"))
    doc.packages.append(Package("microtype"))
    doc.packages.append(Package("hyperref"))

    # Define custom colours for resume
    doc.preamble.append(NoEscape(r"\definecolor{primary}{RGB}{51,51,51}     % dark gray for headers"))
    doc.preamble.append(NoEscape(r"\definecolor{accent}{RGB}{0,102,204}     % blue for accents"))
    doc.preamble.append(NoEscape(r"\definecolor{labelbg}{RGB}{248,249,250}  % very light gray for label cells"))
    
    # Improve table row spacing
    doc.preamble.append(NoEscape(r"\renewcommand{\arraystretch}{1.2}"))
    
    # Do not indent paragraphs
    doc.preamble.append(NoEscape(r"\setlength{\parindent}{0pt}"))

    # Header with name and contact info
    header_section = NoEscape(r"""
{\centering
  {\huge\bfseries\color{primary}""" + _escape_latex(args.candidate_name) + r"""}\par
  \vspace{0.2cm}
  {\normalsize """ + _escape_latex(args.email) + r""" \textbullet\ """ + _escape_latex(args.phone) + r""" \textbullet\ """ + _escape_latex(args.location) + r"""}\par
  {\small """ + _escape_latex(args.linkedin) + r"""}\par
}
\vspace{0.3cm}
""")
    doc.append(header_section)

    # Professional Summary Section
    if args.professional_summary:
        summary_section = NoEscape(r"""
{\color{primary}\large\bfseries Professional Summary}\par
\vspace{0.1cm}
{\normalsize """ + _escape_latex(args.professional_summary) + r"""}\par
\vspace{0.3cm}
""")
        doc.append(summary_section)

    # Work Experience Section
    experience_section = NoEscape(r"""
{\color{primary}\large\bfseries Professional Experience}\par
\vspace{0.2cm}
""")
    doc.append(experience_section)

    # Current Position
    if args.current_position:
        current_exp = NoEscape(r"""
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.25\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small """ + _escape_latex(args.current_duration) + r""" & {\bfseries """ + _escape_latex(args.current_position) + r"""}\par
  {\normalsize """ + _escape_latex(args.current_company) + r"""}\par
  """ + _escape_latex(args.current_responsibilities) + r""" \\
  \hline
\end{tabularx}
\vspace{0.2cm}
""")
        doc.append(current_exp)

    # Previous Position
    if args.previous_position:
        prev_exp = NoEscape(r"""
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.25\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small """ + _escape_latex(args.previous_duration) + r""" & {\bfseries """ + _escape_latex(args.previous_position) + r"""}\par
  {\normalsize """ + _escape_latex(args.previous_company) + r"""}\par
  """ + _escape_latex(args.previous_responsibilities) + r""" \\
  \hline
\end{tabularx}
\vspace{0.2cm}
""")
        doc.append(prev_exp)

    # Earlier Position
    if args.earlier_position:
        earlier_exp = NoEscape(r"""
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.25\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small """ + _escape_latex(args.earlier_duration) + r""" & {\bfseries """ + _escape_latex(args.earlier_position) + r"""}\par
  {\normalsize """ + _escape_latex(args.earlier_company) + r"""}\par
  """ + _escape_latex(args.earlier_responsibilities) + r""" \\
  \hline
\end{tabularx}
\vspace{0.3cm}
""")
        doc.append(earlier_exp)

    # Education Section
    education_section = NoEscape(r"""
{\color{primary}\large\bfseries Education}\par
\vspace{0.1cm}
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.25\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small """ + _escape_latex(args.graduation_year) + r""" & {\bfseries """ + _escape_latex(args.degree) + r"""}\par
  {\normalsize """ + _escape_latex(args.university) + r"""}\par
  """ + (_escape_latex(args.gpa) if args.gpa else "") + r""" \\
  \hline
\end{tabularx}
\vspace{0.3cm}
""")
    doc.append(education_section)

    # Skills Section
    skills_section = NoEscape(r"""
{\color{primary}\large\bfseries Skills \& Competencies}\par
\vspace{0.1cm}
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Technical Skills & """ + _escape_latex(args.technical_skills) + r""" \\
  \hline
  \cellcolor{labelbg}\small Soft Skills & """ + _escape_latex(args.soft_skills) + r""" \\
  \hline
  \cellcolor{labelbg}\small Certifications & """ + _escape_latex(args.certifications) + r""" \\
  \hline
\end{tabularx}
\vspace{0.3cm}
""")
    doc.append(skills_section)

    # Additional Information Section
    additional_info = NoEscape(r"""
{\color{primary}\large\bfseries Additional Information}\par
\vspace{0.1cm}
\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}p{0.30\textwidth}|X|}
  \hline
  \cellcolor{labelbg}\small Languages & """ + _escape_latex(args.languages) + r""" \\
  \hline
  \cellcolor{labelbg}\small Volunteer Experience & """ + _escape_latex(args.volunteer_experience) + r""" \\
  \hline
  \cellcolor{labelbg}\small Interests & """ + _escape_latex(args.interests) + r""" \\
  \hline
\end{tabularx}
""")
    doc.append(additional_info)

    # Generate PDF using FILES_DIR
    import os
    import time
    
    try:
        # Generate filename with template name and timestamp
        timestamp = int(time.time())
        pdf_filename = f"sample_resume_{timestamp}"  # No .pdf extension - PyLaTeX adds it
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
