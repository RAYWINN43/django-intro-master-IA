from langgraph.graph import StateGraph
from workflow import generate_project, generate_personas, generate_storymap, generate_backlog, generate_swot

builder = StateGraph(dict)

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

builder.add_node(
    "swot",
    generate_swot,
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
    "personas",
    "backlog",
)

builder.add_edge(
    "storymap",
    "backlog",
)

builder.add_edge(
    "project",
    "swot",
)

builder.add_edge(
    "backlog",
    "swot",
)

builder.add_edge(
    "storymap",
    "swot",
)

project_graph = builder.compile()
