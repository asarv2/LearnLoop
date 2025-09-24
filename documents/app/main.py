import importlib.util
import json
import logging
import os
import tempfile
from typing import Any, Callable, Dict, Optional, Tuple, Type
from uuid import UUID

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("documents_service")

# Supabase Storage configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SERVICE_ROLE_KEY")
BUCKET_NAME = "templates"

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

async def _download_template_from_storage(template_id: UUID) -> str:
    """Download template Python code from Supabase Storage."""
    if not all([SUPABASE_URL, SERVICE_ROLE_KEY]):
        raise HTTPException(
            status_code=500, 
            detail="Supabase configuration missing. Check SUPABASE_URL and SERVICE_ROLE_KEY environment variables."
        )
    
    file_key = f"{template_id}.py"
    storage_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{file_key}"
    
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(storage_url, headers=headers)
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Template {template_id} not found in storage.")
            else:
                raise HTTPException(status_code=500, detail=f"Failed to download template: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

async def _list_templates_from_storage() -> list[str]:
    """List all template IDs from Supabase Storage."""
    if not all([SUPABASE_URL, SERVICE_ROLE_KEY]):
        raise HTTPException(
            status_code=500, 
            detail="Supabase configuration missing. Check SUPABASE_URL and SERVICE_ROLE_KEY environment variables."
        )
    
    storage_url = f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET_NAME}"
    
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Use JSON body with proper structure for Supabase Storage API
    request_body = {
        "prefix": "",  # Required property - empty string to list all objects
        "limit": 1000,
        "offset": 0,
        "sortBy": {
            "column": "name",
            "order": "asc"
        }
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(storage_url, headers=headers, json=request_body)
            response.raise_for_status()
            data = response.json()
            
            template_ids = []
            for item in data:
                if item.get("name", "").endswith(".py"):
                    # Extract UUID from filename (remove .py extension)
                    filename = item["name"]
                    template_id = filename[:-3]  # Remove .py extension
                    try:
                        # Validate it's a valid UUID
                        UUID(template_id)
                        template_ids.append(template_id)
                    except ValueError:
                        # Skip files that don't have valid UUID names
                        continue
            
            return template_ids
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=500, detail=f"Failed to list templates: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

# Removed _template_module_path as we're now using Supabase Storage

async def _import_template_module(template_id: UUID) -> Any:
    """Import template module from Supabase Storage."""
    try:
        # Download template code from storage
        template_code = await _download_template_from_storage(template_id)
        
        # Create a temporary file to execute the template code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
            temp_file.write(template_code)
            temp_path = temp_file.name
        
        try:
            # Load the module from the temporary file
            spec = importlib.util.spec_from_file_location(f"template_{template_id}", temp_path)
            if spec is None or spec.loader is None:
                raise HTTPException(status_code=500, detail="Could not load template module spec.")
            
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore[attr-defined]
            return mod
        finally:
            # Clean up the temporary file
            try:
                os.unlink(temp_path)
            except OSError:
                pass  # Ignore cleanup errors
                
    except Exception as e:
        logger.exception("Template import failed")
        raise HTTPException(status_code=500, detail=f"Template import error: {e}")


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
    List all available template IDs from Supabase Storage.
    """
    template_ids = await _list_templates_from_storage()
    return JSONResponse(content={"template_ids": template_ids})

@app.post("/verify-args")
async def verify_args_class(request: dict) -> JSONResponse:
    """
    Verify that Args class code is valid and can be imported without errors.
    Accepts Args class code as freeform text.
    Returns validation status and any error details.
    """
    try:
        args_code = request.get("args_code", "")
        if not args_code.strip():
            return JSONResponse(content={
                "valid": False,
                "message": "No Args code provided",
                "error_type": "ValidationError",
                "error_details": "args_code field is required and cannot be empty"
            }, status_code=400)
        
        import importlib.util
        import tempfile
        from pathlib import Path

        # Create a minimal template with the Args class
        template_code = f"""# Generated Args class
from pydantic import BaseModel, Field

{args_code}

# Dummy render function for testing
def render(args: Args) -> bytes:
    return b"dummy"
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(template_code)
            temp_file = f.name
        
        try:
            spec = importlib.util.spec_from_file_location("temp_template", temp_file)
            if spec is None or spec.loader is None:
                return JSONResponse(content={
                    "valid": False,
                    "message": "Could not create module spec",
                    "error_type": "ImportError",
                    "error_details": "Failed to create module specification"
                }, status_code=400)
            
            temp_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(temp_module)
            
            if not hasattr(temp_module, 'Args'):
                return JSONResponse(content={
                    "valid": False,
                    "message": "Args class not found",
                    "error_type": "ValidationError",
                    "error_details": "Args class is required but not found in code"
                }, status_code=400)
            
            Args = getattr(temp_module, 'Args')
            try:
                args_instance = Args()
            except Exception as e:
                return JSONResponse(content={
                    "valid": False,
                    "message": f"Could not instantiate Args class: {str(e)}",
                    "error_type": "InstantiationError",
                    "error_details": str(e)
                }, status_code=400)
            
            try:
                import json
                json.dumps(args_instance.model_dump())
            except Exception as e:
                return JSONResponse(content={
                    "valid": False,
                    "message": f"Args instance not JSON serializable: {str(e)}",
                    "error_type": "SerializationError",
                    "error_details": str(e)
                }, status_code=400)
            
            return JSONResponse(content={
                "valid": True,
                "message": "Args class is valid and ready to use"
            })
            
        finally:
            Path(temp_file).unlink()
        
    except Exception as e:
        return JSONResponse(content={
            "valid": False,
            "message": f"Args validation failed: {str(e)}",
            "error_type": type(e).__name__,
            "error_details": str(e)
        }, status_code=400)


@app.post("/verify-render")
async def verify_render_function(request: dict) -> JSONResponse:
    """
    Verify that render function code is valid and can compile a PDF.
    Accepts either:
    1. render_code: Just the render function code (uses dummy Args)
    2. full_template: Complete template with both Args and render function
    
    Returns validation status and any error details.
    """
    try:
        render_code = request.get("render_code", "")
        full_template = request.get("full_template", "")
        
        if not render_code.strip() and not full_template.strip():
            return JSONResponse(content={
                "valid": False,
                "message": "No render code or full template provided",
                "error_type": "ValidationError",
                "error_details": "Either render_code or full_template field is required"
            }, status_code=400)
        
        import importlib.util
        import tempfile
        from pathlib import Path

        # Use full template if provided, otherwise create minimal template
        if full_template.strip():
            template_code = full_template
        else:
            # Create a minimal template with a dummy Args class and the render function
            template_code = f"""# Generated render function
from pydantic import BaseModel, Field

# Dummy Args class for testing
class Args(BaseModel):
    title: str = Field(default="Test Document", description="Document title")

{render_code}
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(template_code)
            temp_file = f.name
        
        try:
            spec = importlib.util.spec_from_file_location("temp_template", temp_file)
            if spec is None or spec.loader is None:
                return JSONResponse(content={
                    "valid": False,
                    "message": "Could not create module spec",
                    "error_type": "ImportError",
                    "error_details": "Failed to create module specification"
                }, status_code=400)
            
            temp_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(temp_module)
            
            if not hasattr(temp_module, 'render'):
                return JSONResponse(content={
                    "valid": False,
                    "message": "render function not found",
                    "error_type": "ValidationError",
                    "error_details": "render function is required but not found in code"
                }, status_code=400)
            
            render_func = getattr(temp_module, 'render')
            Args = getattr(temp_module, 'Args')
            
            # Validate function signature
            import inspect
            sig = inspect.signature(render_func)
            if len(sig.parameters) != 1:
                return JSONResponse(content={
                    "valid": False,
                    "message": "render function must take exactly one parameter (args: Args)",
                    "error_type": "ValidationError",
                    "error_details": f"Expected 1 parameter, got {len(sig.parameters)}"
                }, status_code=400)
            
            # Try to instantiate Args and call render function to test PyLaTeX compilation
            try:
                args_instance = Args()
                
                # This will test the actual PyLaTeX imports and compilation
                # We catch the error and provide detailed feedback
                try:
                    pdf_bytes = render_func(args_instance)
                    
                    # Verify we got bytes back
                    if not isinstance(pdf_bytes, bytes):
                        return JSONResponse(content={
                            "valid": False,
                            "message": "render function must return bytes, not file path",
                            "error_type": "ValidationError",
                            "error_details": f"Expected bytes, got {type(pdf_bytes).__name__}"
                        }, status_code=400)
                    
                    # Verify PDF is not empty
                    if len(pdf_bytes) == 0:
                        return JSONResponse(content={
                            "valid": False,
                            "message": "render function returned empty PDF",
                            "error_type": "ValidationError",
                            "error_details": "Generated PDF has 0 bytes"
                        }, status_code=400)
                    
                    # Verify it's actually a PDF (check for PDF header)
                    if not pdf_bytes.startswith(b'%PDF'):
                        return JSONResponse(content={
                            "valid": False,
                            "message": "render function did not generate valid PDF",
                            "error_type": "ValidationError",
                            "error_details": "Generated file does not have PDF header"
                        }, status_code=400)
                    
                    return JSONResponse(content={
                        "valid": True,
                        "message": f"render function is valid and generated {len(pdf_bytes)} byte PDF",
                        "pdf_size": len(pdf_bytes)
                    })
                    
                except ImportError as e:
                    return JSONResponse(content={
                        "valid": False,
                        "message": f"PyLaTeX import error: {str(e)}",
                        "error_type": "ImportError",
                        "error_details": str(e)
                    }, status_code=400)
                    
                except Exception as e:
                    # This catches LaTeX compilation errors, syntax errors, etc.
                    error_msg = str(e)
                    if "LaTeX Error" in error_msg:
                        return JSONResponse(content={
                            "valid": False,
                            "message": f"LaTeX compilation error: {error_msg}",
                            "error_type": "LaTeXError",
                            "error_details": error_msg
                        }, status_code=400)
                    elif "XeLaTeX failed" in error_msg:
                        return JSONResponse(content={
                            "valid": False,
                            "message": f"XeLaTeX compilation failed: {error_msg}",
                            "error_type": "LaTeXError",
                            "error_details": error_msg
                        }, status_code=400)
                    else:
                        return JSONResponse(content={
                            "valid": False,
                            "message": f"render function execution failed: {error_msg}",
                            "error_type": "ExecutionError",
                            "error_details": error_msg
                        }, status_code=400)
                
            except Exception as e:
                return JSONResponse(content={
                    "valid": False,
                    "message": f"Could not validate render function: {str(e)}",
                    "error_type": "ValidationError",
                    "error_details": str(e)
                }, status_code=400)
            
        finally:
            Path(temp_file).unlink()
        
    except Exception as e:
        return JSONResponse(content={
            "valid": False,
            "message": f"render validation failed: {str(e)}",
            "error_type": type(e).__name__,
            "error_details": str(e)
        }, status_code=400)



@app.get("/templates/{template_id}/spec")
async def get_template_spec(template_id: UUID) -> JSONResponse:
    """
    Return the template's Args schema (fields, types, defaults) and declared return type.
    """
    mod = await _import_template_module(template_id)
    ArgsModel, _, default_filename, template_description = _get_template_contract(mod)
    spec = _model_spec(ArgsModel, template_description, default_filename)
    return JSONResponse(content=spec)

@app.post("/create")
async def create_document(req: CreateRequest) -> StreamingResponse:
    """
    Single endpoint: pick template by UUID, validate kwargs against template's Args, then compile PDF.
    Returns PDF as streaming response.
    """
    mod = await _import_template_module(req.template_id)
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


