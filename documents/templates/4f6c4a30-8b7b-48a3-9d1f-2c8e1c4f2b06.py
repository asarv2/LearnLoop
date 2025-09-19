"""
Example template module.

Contract:
- Args: pydantic BaseModel (schema for kwargs)
- render(args: Args) -> bytes  # returns compiled PDF bytes

Optional:
- DEFAULT_FILENAME: str
"""

from typing import List, Optional

from pydantic import BaseModel, Field
# PyLaTeX
from pylatex import Command, Document, NoEscape, Package  # type: ignore
from pylatex.utils import bold  # type: ignore

DEFAULT_FILENAME = "shopping-list"

class Args(BaseModel):
    title: str = Field(default="Shopping List", description="Document title")
    author: Optional[str] = Field(default=None, description="Author name on title page")
    items: List[str] = Field(default_factory=list, description="Bullet list of items")
    main_font: str = Field(default="Noto Serif", description="Main font (installed in container)")
    mono_font: str = Field(default="DejaVu Sans Mono", description="Monospace font")
    fontsize_pt: int = Field(default=12, ge=8, le=20, description="Font size in points")
    paper: str = Field(default="letterpaper", description="Paper size (letterpaper|a4paper)")
    margin_in: float = Field(default=1.0, ge=0.5, le=2.0, description="Geometry margin in inches")

def render(args: Args) -> bytes:
    """
    Build a simple PDF with Unicode fonts via XeLaTeX + fontspec.
    """
    doc = Document(
        documentclass="article",
        document_options=[f"{args.fontsize_pt}pt", args.paper],
        page_numbers=True,
        indent=False,
        lmodern=False,  # we use fontspec
    )

    # Core packages
    doc.packages.append(Package("fontspec"))
    doc.packages.append(Package("microtype"))
    doc.packages.append(Package("hyperref"))
    doc.packages.append(Package("geometry", options=[f"margin={args.margin_in}in"]))

    # Fonts
    doc.preamble.append(NoEscape(rf"\setmainfont{{{args.main_font}}}"))
    doc.preamble.append(NoEscape(rf"\setmonofont{{{args.mono_font}}}"))

    # Title
    doc.preamble.append(Command("title", NoEscape(args.title)))
    if args.author:
        doc.preamble.append(Command("author", NoEscape(args.author)))
    doc.preamble.append(Command("date", NoEscape(r"\today")))
    doc.append(NoEscape(r"\maketitle"))

    # Body: bullet list
    if args.items:
        doc.append(NoEscape(r"\begin{itemize}"))
        for it in args.items:
            # minimal escaping; for trusted inputs you can allow raw LaTeX
            doc.append(NoEscape(r"\item " + it))
        doc.append(NoEscape(r"\end{itemize}"))
    else:
        doc.append("No items provided.")

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
