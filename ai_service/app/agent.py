"""LangGraph agent:  START -> agent (LLM with tools) -> [tool calls?] -> tools -> agent -> ... -> END
Conversation memory is kept per thread with a checkpointer."""
import json
from datetime import date
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from .llm import get_llm
from .tools import langchain_tools

memory = MemorySaver()


def system_prompt(scope: int | None) -> str:
    today = date.today()
    scope_text = (f"This conversation is about ONE patient (id {scope}); you can only see that patient's data."
                  if scope else "You can look up any patient. Use find_patient first when the dentist mentions a name.")
    return f"""You are the AI assistant of a dentist's clinic management system. Today is {today.strftime('%A')}, {today.isoformat()}.
{scope_text}

Rules:
- Ground every statement about a patient in tool results; cite the record type and date, e.g. (Consultation, 10 Sep 2026).
- If the records do not contain the answer, say so. Never invent clinical facts, doses or dates.
- You support the dentist, you do not diagnose or make clinical decisions.
- You cannot save anything directly. draft_* tools only create drafts that the dentist must approve; say clearly that a draft was created and needs approval.
- After drafting a prescription, always report the safety warnings (or say there were none).
- Resolve relative dates ("in 2 weeks", "next Monday") from today's date and state the exact date you used.
- Amounts are in rupees. Be concise."""


def build_graph(scope: int | None):
    tools = langchain_tools(scope)
    model = get_llm().bind_tools(tools)

    def call_model(state: MessagesState):
        return {"messages": [model.invoke([SystemMessage(content=system_prompt(scope))] + state["messages"])]}

    g = StateGraph(MessagesState)
    g.add_node("agent", call_model)
    g.add_node("tools", ToolNode(tools, handle_tool_errors=True))
    g.add_edge(START, "agent")
    g.add_conditional_edges("agent", tools_condition)
    g.add_edge("tools", "agent")
    return g.compile(checkpointer=memory)


def _text(content) -> str:
    if isinstance(content, str):
        return content
    return "".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")


def ask(question: str, patient_id: int | None = None, thread_id: str = "default") -> dict:
    graph = build_graph(patient_id)
    config = {"configurable": {"thread_id": f"{patient_id or 'all'}:{thread_id}"}, "recursion_limit": 14}
    result = graph.invoke({"messages": [HumanMessage(content=question)]}, config)

    messages = result["messages"]
    start = max(i for i, m in enumerate(messages) if isinstance(m, HumanMessage))  # this turn only
    turn = messages[start + 1:]
    tools_used = [c["name"] for m in turn if isinstance(m, AIMessage) for c in m.tool_calls]
    draft_ids = []
    for m in turn:
        if isinstance(m, ToolMessage) and m.name and m.name.startswith("draft_"):
            try:
                draft_ids.append(json.loads(_text(m.content))["draft_id"])
            except (ValueError, KeyError, TypeError):
                pass
    answer = next((_text(m.content) for m in reversed(turn) if isinstance(m, AIMessage) and _text(m.content)), "")
    return {"answer": answer, "tools_used": tools_used, "drafts_created": draft_ids, "thread_id": thread_id}
