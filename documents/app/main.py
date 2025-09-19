import logging
import sys
import tempfile
from pathlib import Path
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
# PyLaTeX
from pylatex import Command, Document, NewPage
from pylatex.package import Package
from pylatex.utils import NoEscape

from .templates import build_basic_doc

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("documents_service")

app = FastAPI(
    title="LearnLoop Documents Service",
    description="Document creation (PyLaTeX + XeLaTeX)",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Schemas ----------

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str

class CreateDocumentRequest(BaseModel):
    title: str = Field(default="Untitled")
    author: Optional[str] = Field(default=None)
    text: str = Field(description="Freeform body text (markdown-ish allowed; minimal LaTeX escapes handled)")
    main_font: Optional[str] = Field(default="Noto Serif")  # any installed font
    mono_font: Optional[str] = Field(default="DejaVu Sans Mono")
    fontsize_pt: int = Field(default=11, ge=8, le=20)
    paper: str = Field(default="letterpaper", description="letterpaper|a4paper|...")

class RawLatexRequest(BaseModel):
    preamble: Optional[str] = Field(default=None, description="LaTeX preamble override (optional)")
    body: str = Field(description="Raw LaTeX body content")
    engine: str = Field(default="xelatex", description="xelatex|lualatex")
    paper: str = Field(default="letterpaper")
    fontsize_pt: int = Field(default=11, ge=8, le=20)

# ---------- Routes ----------

@app.get("/", response_model=Dict[str, str])
async def root() -> Dict[str, str]:
    return {"service": "LearnLoop Documents Service", "version": "0.2.0", "status": "running"}

@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="healthy", service="documents", version="0.2.0")

@app.post("/create")
async def create_document(req: CreateDocumentRequest):
    """
    Build a PDF using PyLaTeX and XeLaTeX with fontspec (Unicode + system fonts).
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required.")
    try:
        pdf_bytes = build_basic_doc(
            title=req.title,
            author=req.author,
            text=req.text,
            main_font=req.main_font,
            mono_font=req.mono_font,
            fontsize_pt=req.fontsize_pt,
            paper=req.paper,
        )
    except Exception as e:
        logger.exception("LaTeX build failed")
        raise HTTPException(status_code=500, detail=f"LaTeX build error: {e}")

    return StreamingResponse(
        content=iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename(req.title)}.pdf"'},
    )

@app.post("/create/raw")
async def create_from_raw(req: RawLatexRequest):
    """
    Pass raw LaTeX (preamble optional). Uses XeLaTeX or LuaLaTeX.
    """
    try:
        pdf_bytes = compile_raw_latex(
            body=req.body,
            preamble=req.preamble,
            engine=req.engine,
            paper=req.paper,
            fontsize_pt=req.fontsize_pt,
        )
    except Exception as e:
        logger.exception("Raw LaTeX build failed")
        raise HTTPException(status_code=500, detail=f"LaTeX build error: {e}")

    return StreamingResponse(
        content=iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="document.pdf"'},
    )

# ---------- Helpers ----------

def safe_filename(name: str) -> str:
    s = "".join(ch for ch in name if ch.isalnum() or ch in (" ", "-", "_")).rstrip()
    return s if s else "document"

def compile_raw_latex(*, body: str, preamble: Optional[str], engine: str, paper: str, fontsize_pt: int) -> bytes:
    """
    Compile arbitrary LaTeX. We always inject fontspec + unicode packages when using xelatex/lualatex.
    """
    # Create a minimal doc if preamble not provided
    if preamble is None:
        preamble = rf"""
\documentclass[{fontsize_pt}pt,{paper}]{{article}}
\usepackage{{fontspec}}
\usepackage{{microtype}}
\usepackage{{hyperref}}
\usepackage{{geometry}}
\geometry{{margin=1in}}
\setmainfont{{Noto Serif}}
\setmonofont{{DejaVu Sans Mono}}
"""

    full_tex = preamble + "\n\\begin{document}\n" + body + "\n\\end{document}\n"

    with tempfile.TemporaryDirectory() as d:
        tex_path = Path(d) / "doc.tex"
        tex_path.write_text(full_tex, encoding="utf-8")

        # Use latexmk for robust builds
        import shlex
        import subprocess
        engine_flag = "-xelatex" if engine == "xelatex" else "-lualatex"
        cmd = f"latexmk {engine_flag} -interaction=nonstopmode -halt-on-error -pdf doc.tex"
        proc = subprocess.run(
            shlex.split(cmd),
            cwd=d,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=60,  # keep tight
            check=False,
        )
        if proc.returncode != 0:
            log = proc.stdout.decode(errors="ignore")[-4000:]
            raise RuntimeError(f"latexmk failed (code {proc.returncode}). Tail:\n{log}")

        pdf_path = Path(d) / "doc.pdf"
        if not pdf_path.exists():
            raise RuntimeError("PDF not produced.")

        return pdf_path.read_bytes()
