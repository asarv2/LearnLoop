import os

from agents.extensions.models.litellm_model import LitellmModel
from dotenv import load_dotenv

load_dotenv()

gemini_model = LitellmModel(
    model="gemini/gemini-2.5-flash",
    api_key=os.getenv("GEMINI_API_KEY"),
)