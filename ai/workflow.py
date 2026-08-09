from dataclasses import dataclass
from ai.services.project_generator import ProjectGenerator
from ai.services.persona_generator import PersonaGenerator
from ai.services.storymap_generator import StorymapGenerator
from ai.services.backlog_generator import BacklogGenerator
from ai.services.swot_generator import SWOTGenerator

@dataclass
class ProjectContext:

    project=None

    personas=None

    story_map=None

    backlog=None

    swot=None

def generate_project(state):
    return {"project" : ProjectGenerator().generate(
        state["idea"]
    )}

def generate_personas(state):
    return {"personas" : PersonaGenerator().generate(
        state["project"]
        )}

def generate_storymap(state):

    return {"storymap": StorymapGenerator().generate(
        state["project"]
    )}

def generate_backlog(state):

    return {"backlog": BacklogGenerator().generate(
        state["storymap"]
    )}

def generate_swot(state):

    return {"swot": SWOTGenerator().generate(
        state["backlog"]
    )}