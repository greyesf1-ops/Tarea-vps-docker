# LangChain Example

## Requirements

- [uv](https://docs.astral.sh/uv/)
- Python 3.12: `uv python install 3.12`

## Setup

- Create the virtual environment: `uv venv -p 3.12`
- Activate the virtual environment:
    - Unix: `source .venv/bin/activate`
    - Windows: `...`
- Install dependencies
    - `uv pip install langchain "langchain[openai]"`
- Run python file
    - `uv run main.py`
