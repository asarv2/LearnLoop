import importlib.util
import json
import logging
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple, Type
from uuid import UUID

from app.extensions import TEMPLATES_DIR  # <-- your templates directory (Path)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("documents_service")

app = FastAPI(
    title="LearnLoop Documents Service",
    description="Document creation from parameterized templates (PyLaTeX + XeLaTeX)",
    version="0.3.0",
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

class CreateRequest(BaseModel):
    template_id: UUID = Field(description="UUID of the template module (filename without .py)")
    kwargs: Dict[str, Any] = Field(default_factory=dict, description="Arguments for the template's Args model")

# ---------- Utilities ----------

def _template_module_path(template_id: UUID) -> Path:
    return TEMPLATES_DIR / f"{str(template_id)}.py"

def _import_template_module(template_id: UUID) -> Any:
    path = _template_module_path(template_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found.")
    spec = importlib.util.spec_from_file_location(f"template_{template_id}", path)
    if spec is None or spec.loader is None:
        raise HTTPException(status_code=500, detail="Could not load template module spec.")
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)  # type: ignore[attr-defined]
    except Exception as e:
        logger.exception("Template import failed")
        raise HTTPException(status_code=500, detail=f"Template import error: {e}")
    return mod


def _get_template_contract(mod: Any) -> Tuple[Type[BaseModel], Callable[[BaseModel], bytes], Optional[str], Optional[str]]:
    """
    Each template module must define:
      - Args: pydantic BaseModel (argument schema)
      - render(args: Args) -> bytes  (PDF bytes)
    Optional:
      - DEFAULT_FILENAME: str (without .pdf)
      - TEMPLATE_DESCRIPTION: str (description of the template)
    """
    if not hasattr(mod, "Args"):
        raise HTTPException(status_code=500, detail="Template missing Args model.")
    if not hasattr(mod, "render"):
        raise HTTPException(status_code=500, detail="Template missing render(args) function.")
    ArgsModel = getattr(mod, "Args")
    render_fn = getattr(mod, "render")
    default_filename = getattr(mod, "DEFAULT_FILENAME", None)
    template_description = getattr(mod, "TEMPLATE_DESCRIPTION", None)
    if not issubclass(ArgsModel, BaseModel):
        raise HTTPException(status_code=500, detail="Template Args must subclass pydantic.BaseModel.")
    if not callable(render_fn):
        raise HTTPException(status_code=500, detail="Template render is not callable.")
    return ArgsModel, render_fn, default_filename, template_description

def _model_spec(ArgsModel: Type[BaseModel], template_description: Optional[str] = None, default_filename: Optional[str] = None) -> Dict[str, Any]:
    """
    Produce a JSON-serializable description of fields, types, defaults, and required flags.
    """
    model_schema = ArgsModel.model_json_schema()
    # Also return a flat summary of fields for convenience
    fields = {}
    for name, field in ArgsModel.model_fields.items():
        # Get the full type annotation string, not just the name
        ftype = str(field.annotation)
        # Normalize common typing patterns
        ftype = ftype.replace("typing.", "")
        ftype = ftype.replace("NoneType", "None")
        
        # Determine if field is required (no default and not Optional)
        is_required = field.is_required()
        
        # Get default value - use None for Optional types even if not explicitly set
        if is_required:
            default_val = None
        else:
            default_val = field.default
        
        fields[name] = {
            "type": ftype,
            "required": is_required,
            "default": default_val,
            "description": field.description,
        }
    spec = {
        "title": ArgsModel.__name__,
        "fields": fields,
        "json_schema": model_schema,
        "return_type": "application/pdf (bytes)",
    }
    if template_description:
        spec["template_description"] = template_description
    if default_filename:
        spec["default_filename"] = default_filename
    return spec

def _safe_filename(name: Optional[str]) -> str:
    if not name:
        return "document"
    s = "".join(ch for ch in name if ch.isalnum() or ch in (" ", "-", "_")).rstrip()
    return s if s else "document"

# ---------- Routes ----------

@app.get("/", response_model=Dict[str, str])
async def root() -> Dict[str, str]:
    return {"service": "LearnLoop Documents Service", "version": "0.3.0", "status": "running"}

@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="healthy", service="documents", version="0.3.0")

@app.get("/templates")
async def list_templates() -> JSONResponse:
    """
    List all available template IDs by scanning the templates directory.
    """
    template_ids = []
    for template_file in TEMPLATES_DIR.glob("*.py"):
        if template_file.name != "__init__.py":
            try:
                template_id = UUID(template_file.stem)
                template_ids.append(str(template_id))
            except ValueError:
                # Skip files that don't have valid UUID names
                continue
    
    return JSONResponse(content={"template_ids": template_ids})

@app.get("/templates/{template_id}/spec")
async def get_template_spec(template_id: UUID) -> JSONResponse:
    """
    Return the template's Args schema (fields, types, defaults) and declared return type.
    """
    mod = _import_template_module(template_id)
    ArgsModel, _, default_filename, template_description = _get_template_contract(mod)
    spec = _model_spec(ArgsModel, template_description, default_filename)
    return JSONResponse(content=spec)

@app.post("/create")
async def create_document(req: CreateRequest) -> StreamingResponse:
    """
    Single endpoint: pick template by UUID, validate kwargs against template's Args, then compile PDF.
    Returns PDF as streaming response.
    """
    mod = _import_template_module(req.template_id)
    ArgsModel, render_fn, default_filename, _ = _get_template_contract(mod)

    try:
        args_obj = ArgsModel(**req.kwargs)
    except Exception as e:
        # Pydantic validation errors are JSON-serializable already
        raise HTTPException(status_code=422, detail=json.loads(str(e).replace("'", '"')))  # best-effort

    try:
        pdf_bytes = render_fn(args_obj)
    except Exception as e:
        logger.exception("Template render failed")
        raise HTTPException(status_code=500, detail=f"Render error: {e}")

    # pick filename from args if present, else template's default, else generic
    filename = getattr(args_obj, "title", None) or default_filename or "document"
    return StreamingResponse(
        content=iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_safe_filename(filename)}.pdf"'},
    )


