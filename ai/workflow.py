from dataclasses import dataclass
from services.project_generator import ProjectGenerator
from services.persona_generator import PersonaGenerator
from ai.services.storymap_generator import StorymapGenerator
from services.backlog_generator import BacklogGenerator
from services.swot_generator import SWOTGenerator

@dataclass
class ProjectContext:

    project=None

    personas=None

    story_map=None

    backlog=None

    swot=None

def generate_project(state):

    project = ProjectGenerator().generate(
        state["idea"]
    )

    state["project"] = project

    return state

def generate_personas(state):

    state["personas"] = (
        PersonaGenerator()
        .generate(state["project"])
    )

    return state

def generate_storymap(state):

    state["storymap"] = (
        StorymapGenerator()
        .generate(state["project"])
    )

    return state

def generate_backlog(state):

    state["backlog"] = (
        BacklogGenerator()
        .generate(state["project"])
    )

    return state

def generate_swot(state):

    state["swot"] = (
        SWOTGenerator()
        .generate(state["project"])
    )

    return state