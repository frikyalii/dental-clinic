"""FastMCP server exposing the clinic tools to any MCP client (Claude Desktop, IDEs, other agents).

  stdio (Claude Desktop):   python -m app.mcp_server
  HTTP:                     python -m app.mcp_server --http      (http://localhost:8001/mcp)

Draft tools only create drafts - nothing is written to patient records until the dentist approves in the web app.
"""
import json
import sys
from fastmcp import FastMCP
from . import clinic_api as api, core

mcp = FastMCP("Dental Clinic")

for fn in core.ALL_TOOLS + core.MCP_ONLY:
    mcp.tool(fn)


@mcp.resource("patient://{patient_id}/summary")
def patient_summary(patient_id: int) -> str:
    """Read-only JSON overview of one patient (medical alerts, current treatment, next appointment, billing)."""
    return json.dumps({"patient": api.get(f"/patients/{patient_id}"), **api.get(f"/patients/{patient_id}/overview")}, default=str)


if __name__ == "__main__":
    if "--http" in sys.argv:
        mcp.run(transport="http", host="127.0.0.1", port=8001)
    else:
        mcp.run()
