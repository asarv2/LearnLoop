import logging
import uuid
from pathlib import Path
from typing import Any, List, Literal

from agents import Runner, trace
from app.db import get_session
from app.models import Assessments, Chats, Messages, Questions
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_conversation_history
from fastapi import Depends
from pydantic import BaseModel
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


class AssessmentQuestion(BaseModel):
    id: str
    type: Literal["rating", "multiple_choice", "yes_no", "text"]
    question: str
    options: List[str] = []  # Only for multiple_choice questions


class AssessmentQuestions(BaseModel):
    questions: List[AssessmentQuestion]


async def get_assessment_prompt() -> str:
    """Read the assessment prompt from the markdown file."""
    prompt_path = Path(__file__).parent.parent.parent / "lib" / "prompts" / "assessment.md"
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        logger.error(f"Assessment prompt file not found at {prompt_path}")
        raise
    except Exception as e:
        logger.error(f"Error reading assessment prompt: {str(e)}")
        raise


async def run_assessment_agent(
    chat_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """
    This function is used to run the assessment agent.
    Returns a dictionary with assessment questions.

    Args:
        chat_id: The ID of the chat
        session: Database session

    Returns:
        A dictionary containing assessment questions and metadata.
    """

    # Get the chat object
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).first()
    if not chat:
        return {
            "success": False,
            "message": f"Chat not found with ID {chat_id}",
            "questions_count": 0,
            "questions": [],
        }
    
    # get messages from the chat
    messages = session.exec(select(Messages).where(Messages.chat_id == chat_id)).all()

    conversation_history = get_conversation_history(messages)

    # Get the assessment prompt from the markdown file
    system_prompt = await get_assessment_prompt()

    assessment_agent = GenericAgent(
        agent_name="Assessment Question Generator",
        system_prompt=system_prompt,
        temperature=0.0,
        output_type=AssessmentQuestions,
    )

    try:
        with trace("Assessment"):
            result = await Runner.run(
                assessment_agent.agent(), 
                input=conversation_history
            )
            assessment_result = result.final_output_as(AssessmentQuestions)
            questions = assessment_result.questions

        logger.info(
            f"Successfully generated {len(questions)} assessment questions for chat {chat_id}"
        )

        # Create the Assessment record
        assessment = Assessments(
            chat_id=chat_id,
            title=f"Assessment for {chat.title}",
            training_id=chat.training_id,
            responses={}  # Empty responses initially
        )
        session.add(assessment)
        session.flush()  # Flush to get the assessment ID

        # Create Question records for each generated question
        created_questions = []
        for question_data in questions:
            # Map the question type from our format to database format
            question_type_mapping = {
                "rating": "mcq",  # Rating questions are multiple choice with numeric options
                "multiple_choice": "mcq",
                "yes_no": "mcq",  # Yes/No questions are multiple choice
                "text": "frq"     # Text questions are free response
            }
            
            db_question_type = question_type_mapping.get(question_data.type, "mcq")
            
            # Prepare options for multiple choice questions
            options = None
            if question_data.type in ["rating", "multiple_choice", "yes_no"]:
                if question_data.type == "rating":
                    # For rating questions, create 1-5 scale options
                    options = ["1", "2", "3", "4", "5"]
                elif question_data.type == "yes_no":
                    # For yes/no questions, create Yes/No options
                    options = ["Yes", "No"]
                else:
                    # For multiple choice, use the provided options
                    options = question_data.options

            question = Questions(
                assessment_id=assessment.id,
                stem=question_data.question,
                question_type=db_question_type,
                options=options,
                value=None  # Will be filled when user responds
            )
            session.add(question)
            created_questions.append(question)

        # Commit all changes to the database
        session.commit()

        logger.info(
            f"Successfully saved assessment {assessment.id} with {len(created_questions)} questions to database"
        )

        return {
            "success": True,
            "message": f"Successfully generated and saved {len(created_questions)} assessment questions",
            "questions_count": len(created_questions),
            "assessment_id": str(assessment.id),
            "chat_id": str(chat_id),
            "chat_title": chat.title,
            "questions": [
                {
                    "id": str(q.id),
                    "stem": q.stem,
                    "question_type": q.question_type,
                    "options": q.options
                } for q in created_questions
            ]
        }

    except Exception as e:
        logger.error(f"Error during assessment generation: {str(e)}")
        session.rollback()
        return {
            "success": False,
            "message": f"Assessment generation failed: {str(e)}",
            "questions_count": 0,
            "assessment_id": None,
            "chat_id": str(chat_id),
        }
