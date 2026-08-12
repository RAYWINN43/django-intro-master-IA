from typing import TypedDict

from langgraph.graph import START, StateGraph

from ai.workflow import (
    generate_backlog,
    generate_personas,
    generate_project,
    generate_storymap,
)


class State(TypedDict, total=False):
    idea: str
    project: str
    personas: str
    storymap: str
    backlog: str


builder = StateGraph(State)

builder.add_node(
    "project",
    generate_project,
)

builder.add_node(
    "personas",
    generate_personas,
)

builder.add_node(
    "storymap",
    generate_storymap,
)

builder.add_node(
    "backlog",
    generate_backlog,
)

builder.add_edge(
    START,
    "project",
)

builder.add_edge(
    "project",
    "personas",
)

builder.add_edge(
    "project",
    "storymap",
)

builder.add_edge(
    "storymap",
    "backlog",
)

project_graph = builder.compile()


def ask_groq(message):
    return project_graph.invoke(
        {
            "idea": message,
        }
    )
