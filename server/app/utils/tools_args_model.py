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

def _resolve_type(type_str: str) -> Tuple[type, Any]:
    if type_str in _TYPE_MAP:
        return _TYPE_MAP[type_str]
    if type_str.startswith("Optional[") and type_str.endswith("]"):
        inner = type_str[len("Optional["):-1]
        t, _ = _resolve_type(inner)
        return Optional[t], None  # type: ignore
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

        if required and not has_default:
            # (annotation, Field(...)) means REQUIRED
            fields_def[name] = (py_type, Field(description=desc))
        else:
            default_val = meta["default"] if has_default else default_fallback
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
    return ArgsModel  # type: ignore