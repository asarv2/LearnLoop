from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple, Type, get_args, get_origin
from uuid import UUID

from pydantic import BaseModel, Field, create_model

_TYPE_MAP = {
    "str": (str, ""),
    "int": (int, 0),
    "float": (float, 0.0),
    "bool": (bool, False),
    "list": (List[Any], list),         # we'll refine if we see "List[str]"
    "List[str]": (List[str], list),
    "List[int]": (List[int], list),
    "List[float]": (List[float], list),
    "List[bool]": (List[bool], list),
}

def _resolve_type(type_str: str) -> Tuple[type, Any]:
    # best-effort: prefer specific "List[str]", fall back to generic list
    if type_str in _TYPE_MAP:
        return _TYPE_MAP[type_str]
    # tiny convenience: Optional[T] -> T | None
    if type_str.startswith("Optional[") and type_str.endswith("]"):
        inner = type_str[len("Optional["):-1]
        t, default = _resolve_type(inner)
        return Optional[t], None  # type: ignore
    # unknowns default to string
    return str, ""

def build_args_model_from_spec(
    *, model_name: str, spec_fields: Dict[str, Dict[str, Any]]
) -> Any:
    """
    spec_fields: like
      {
        "title":  {"type":"str","required":False,"default":"Shopping List","description":"..."},
        "items":  {"type":"List[str]","required":False,"default":[],"description":"..."},
        "author": {"type":"str","required":False,"default":None,"description":"..."},
        ...
      }
    """
    # For now, let's use a simple approach that should work
    # Create a simple BaseModel subclass with the fields
    class SimpleArgsModel(BaseModel):
        class Config:
            extra = "forbid"
    
    # Add fields dynamically using setattr
    for name, meta in spec_fields.items():
        py_type, default = _resolve_type(str(meta.get("type", "str")))
        desc = meta.get("description")
        required = bool(meta.get("required", False))
        has_default = "default" in meta

        if required and not has_default:
            field_def = Field(description=desc)
        else:
            # if default is explicitly provided (can be None), use it; else fallback mapping default
            val = meta["default"] if "default" in meta else default
            field_def = Field(default=val, description=desc)
        
        # Set the field on the class
        setattr(SimpleArgsModel, name, (py_type, field_def))
    
    return SimpleArgsModel
