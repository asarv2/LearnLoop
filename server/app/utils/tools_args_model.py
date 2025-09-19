import re
from typing import Any, Dict, List, Optional, Tuple, Type

from pydantic import BaseModel, Field, create_model
from pydantic.config import ConfigDict

_TYPE_MAP = {
    "str": (str, ""),
    "int": (int, 0),
    "float": (float, 0.0),
    "bool": (bool, False),
    "list": (List[Any], list),
    "List[str]": (List[str], list),
    "List[int]": (List[int], list),
    "List[float]": (List[float], list),
    "List[bool]": (List[bool], list),
}

def _normalize_type_str(s: str) -> str:
    """Normalize type strings to handle common variants from str(annotation)."""
    # Remove typing. prefix
    s = s.replace("typing.", "")
    # Convert Union[X, NoneType] to Optional[X]
    s = re.sub(r"Union\[(.*),\s*NoneType\]", r"Optional[\1]", s)
    # Convert NoneType to None
    s = s.replace("NoneType", "None")
    return s

def _resolve_type(type_str: str) -> Tuple[type, Any]:
    """Resolve type string to actual Python type and default value."""
    s = _normalize_type_str(type_str)
    
    if s in _TYPE_MAP:
        return _TYPE_MAP[s]
    
    if s.startswith("Optional[") and s.endswith("]"):
        inner = s[len("Optional["):-1]
        t, _ = _resolve_type(inner)
        return Optional[t], None  # type: ignore
    
    if s.startswith("List[") and s.endswith("]"):
        inner = s[len("List["):-1]
        t, _ = _resolve_type(inner)
        return List[t], list  # type: ignore
    
    return str, ""

def build_args_model_from_spec(*, model_name: str, spec_fields: Dict[str, Dict[str, Any]]) -> Type[BaseModel]:
    """
    spec_fields:
      {
        "title":  {"type":"str","required":False,"default":"Shopping List","description":"..."},
        "items":  {"type":"List[str]","required":False,"default":[],"description":"..."},
        ...
      }
    """
    fields_def: Dict[str, Tuple[type, Any]] = {}
    for name, meta in spec_fields.items():
        py_type, default_fallback = _resolve_type(str(meta.get("type", "str")))
        desc = meta.get("description")
        required = bool(meta.get("required", False))
        has_default = "default" in meta

        # Only mark fields as required when they truly have no default
        if required and not has_default:
            # (annotation, Field(...)) means REQUIRED
            fields_def[name] = (py_type, Field(description=desc))
        else:
            # Use explicit default if provided, otherwise use fallback
            # For Optional types, ensure None is used as default
            if has_default:
                default_val = meta["default"]
            else:
                # Check if this is an Optional type and use None as default
                if str(py_type).startswith("typing.Optional") or str(py_type).startswith("typing.Union"):
                    default_val = None
                else:
                    default_val = default_fallback
            fields_def[name] = (py_type, Field(default=default_val, description=desc))

    # Pydantic v2: set extra='forbid' via model_config
    try:
        ArgsModel = create_model(  # type: ignore
            model_name,
            **fields_def,
        )
    except Exception:
        # Fallback approach
        class ArgsModel(BaseModel):  # type: ignore
            model_config = ConfigDict(extra="forbid")
        
        # Add fields dynamically
        for name, (py_type, field_def) in fields_def.items():
            setattr(ArgsModel, name, field_def)
    
    ArgsModel.model_config = ConfigDict(extra="forbid")
    
    # Verification: ensure schema generation works correctly
    try:
        sch = ArgsModel.model_json_schema()
        # Quick verification that optional fields are not in required list
        required_fields = sch.get("required", [])
        properties = sch.get("properties", {})
        
        # Log schema info for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"ArgsModel {model_name} schema: {len(required_fields)} required, {len(properties)} total fields")
        
        # Verify that fields with defaults are not in required list
        for name, meta in spec_fields.items():
            has_default = "default" in meta
            if has_default and name in required_fields:
                logger.warning(f"Field {name} has default but is marked as required in schema")
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to generate schema for {model_name}: {e}")
    
    return ArgsModel  # type: ignore