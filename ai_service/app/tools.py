"""Wraps the core functions as LangChain tools. When a conversation is scoped to one patient, patient_id is
injected by the server (the LLM cannot choose it) and cross-patient tools are removed."""
import inspect
from langchain_core.tools import StructuredTool
from pydantic import create_model
from . import core


def langchain_tools(scope: int | None = None) -> list[StructuredTool]:
    tools = []
    for fn in core.ALL_TOOLS:
        if scope is not None and fn in core.CROSS_PATIENT:
            continue
        params = inspect.signature(fn).parameters
        fields = {
            n: (p.annotation, ... if p.default is inspect.Parameter.empty else p.default)
            for n, p in params.items() if not (scope is not None and n == "patient_id")
        }

        def run(_fn=fn, **kwargs):
            if scope is not None and "patient_id" in inspect.signature(_fn).parameters:
                kwargs["patient_id"] = scope
            return _fn(**kwargs)

        tools.append(StructuredTool.from_function(
            func=run, name=fn.__name__, description=inspect.getdoc(fn), args_schema=create_model(f"{fn.__name__}_args", **fields)))
    return tools
