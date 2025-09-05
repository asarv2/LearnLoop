import logging
import uuid
from pathlib import Path
from typing import Any, List, Literal, Optional

from agents import Runner, trace
from app.db import get_session
from app.models import Assessments, Chats, Messages, Questions
from app.services.agents.generic import GenericAgent
from app.utils.chat import (get_conversation_history, get_parameter_history,
                            get_preamble)
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


# Pre-defined general/self-reflection questions
GENERAL_SELF_REFLECTION_QUESTIONS = [
    {
        "id": "overall_confidence",
        "type": "rating",
        "question": "Overall, how confident do you feel about applying what you learned in this training to real-world situations?",
        "options": []
    },
    {
        "id": "preparation_level",
        "type": "multiple_choice", 
        "question": "How would you describe your level of preparation for similar situations after this training?",
        "options": ["Much more prepared", "Somewhat more prepared", "About the same", "Need more practice", "Uncertain"]
    }
]


async def get_assessment_prompt() -> str:
    """Read the assessment prompt from the markdown file."""
    # Try multiple possible paths for different environments
    possible_paths = [
        Path(__file__).parent.parent.parent / "lib" / "prompts" / "assessment.md",  # Local development
        Path("/app/app/lib/prompts/assessment.md"),  # Docker container
        Path("/app/lib/prompts/assessment.md"),  # Alternative Docker path
    ]
    
    for prompt_path in possible_paths:
        if prompt_path.exists():
            try:
                with open(prompt_path, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except Exception as e:
                logger.error(f"Error reading assessment prompt from {prompt_path}: {str(e)}")
                continue
    
    # If none of the paths work, log all attempted paths and raise error
    logger.error(f"Assessment prompt file not found. Tried paths: {[str(p) for p in possible_paths]}")
    raise FileNotFoundError(f"Assessment prompt file not found. Tried paths: {[str(p) for p in possible_paths]}")


async def get_training_specific_prompt() -> str:
    """Read the training-specific assessment prompt from the markdown file."""
    # Try multiple possible paths for different environments
    possible_paths = [
        Path(__file__).parent.parent.parent / "lib" / "prompts" / "assessment_training_specific.md",  # Local development
        Path("/app/app/lib/prompts/assessment_training_specific.md"),  # Docker container
        Path("/app/lib/prompts/assessment_training_specific.md"),  # Alternative Docker path
    ]
    
    for prompt_path in possible_paths:
        if prompt_path.exists():
            try:
                with open(prompt_path, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except Exception as e:
                logger.error(f"Error reading training-specific assessment prompt from {prompt_path}: {str(e)}")
                continue
    
    # If none of the paths work, log all attempted paths and raise error
    logger.error(f"Training-specific assessment prompt file not found. Tried paths: {[str(p) for p in possible_paths]}")
    raise FileNotFoundError(f"Training-specific assessment prompt file not found. Tried paths: {[str(p) for p in possible_paths]}")


async def get_conversation_specific_prompt() -> str:
    """Read the conversation-specific assessment prompt from the markdown file."""
    # Try multiple possible paths for different environments
    possible_paths = [
        Path(__file__).parent.parent.parent / "lib" / "prompts" / "assessment_conversation_specific.md",  # Local development
        Path("/app/app/lib/prompts/assessment_conversation_specific.md"),  # Docker container
        Path("/app/lib/prompts/assessment_conversation_specific.md"),  # Alternative Docker path
    ]
    
    for prompt_path in possible_paths:
        if prompt_path.exists():
            try:
                with open(prompt_path, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except Exception as e:
                logger.error(f"Error reading conversation-specific assessment prompt from {prompt_path}: {str(e)}")
                continue
    
    # If none of the paths work, log all attempted paths and raise error
    logger.error(f"Conversation-specific assessment prompt file not found. Tried paths: {[str(p) for p in possible_paths]}")
    raise FileNotFoundError(f"Conversation-specific assessment prompt file not found. Tried paths: {[str(p) for p in possible_paths]}")


async def run_training_specific_assessment(
    chat_id: uuid.UUID,
    session: Optional[Session] = None,
) -> dict[str, Any]:
    """
    Generate 3 training-specific questions during training interaction.
    These questions are about the training scenario and can be generated early.
    """
    # Get a session if none is provided
    created = False
    if session is None:
        session = next(get_session())
        created = True
    
    # Type assertion to help linter understand session is not None
    assert session is not None

    # Get the chat object
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).first()
    if not chat:
        if created:
            try:
                session.close()
            except Exception:
                pass
        return {
            "success": False,
            "message": f"Chat not found with ID {chat_id}",
            "questions_count": 0,
            "questions": [],
        }
    
    # Get training context (preamble and parameters, but not conversation history)
    preamble = get_preamble(chat)
    parameter_history = get_parameter_history(chat, session)
    
    context = [preamble] + parameter_history

    # Get the training-specific assessment prompt
    system_prompt = await get_training_specific_prompt()

    assessment_agent = GenericAgent(
        agent_name="Training-Specific Assessment Generator",
        system_prompt=system_prompt,
        temperature=0.0,
        output_type=AssessmentQuestions,
    )

    try:
        logger.info(f"🔍 DEBUG: Running training-specific assessment agent with context length: {len(context)}")
        
        with trace("TrainingSpecificAssessment"):
            result = await Runner.run(
                assessment_agent.agent(), 
                input=context
            )
            assessment_result = result.final_output_as(AssessmentQuestions)
            questions = assessment_result.questions[:3]  # Limit to 3 questions

        logger.info(f"🔍 DEBUG: Generated {len(questions)} training-specific questions: {[q.question[:50] + '...' if len(q.question) > 50 else q.question for q in questions]}")
        logger.info(
            f"✅ Successfully generated {len(questions)} training-specific assessment questions for chat {chat_id}"
        )

        return {
            "success": True,
            "message": f"Successfully generated {len(questions)} training-specific assessment questions",
            "questions_count": len(questions),
            "questions": [
                {
                    "id": q.id,
                    "type": q.type,
                    "question": q.question,
                    "options": q.options
                } for q in questions
            ]
        }

    except Exception as e:
        logger.error(f"Error during training-specific assessment generation: {str(e)}")
        return {
            "success": False,
            "message": f"Training-specific assessment generation failed: {str(e)}",
            "questions_count": 0,
            "questions": [],
        }
    finally:
        if created:
            try:
                session.close()
            except Exception:
                pass


async def run_conversation_specific_assessment(
    chat_id: uuid.UUID,
    session: Optional[Session] = None,
) -> dict[str, Any]:
    """
    Generate 2 conversation-specific questions after training ends.
    These questions are about what was actually said during the conversation.
    """
    # Get a session if none is provided
    if session is None:
        session = next(get_session())
    
    # Type assertion to help linter understand session is not None
    assert session is not None

    # Get the chat object
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).first()
    if not chat:
        return {
            "success": False,
            "message": f"Chat not found with ID {chat_id}",
            "questions_count": 0,
            "questions": [],
        }
    
    # Get messages from the chat
    messages = session.exec(select(Messages).where(Messages.chat_id == chat_id)).all()

    preamble = get_preamble(chat)
    parameter_history = get_parameter_history(chat, session)
    conversation_history = get_conversation_history(messages)

    context = [preamble] + parameter_history + conversation_history

    # Get the conversation-specific assessment prompt
    system_prompt = await get_conversation_specific_prompt()

    assessment_agent = GenericAgent(
        agent_name="Conversation-Specific Assessment Generator",
        system_prompt=system_prompt,
        temperature=0.0,
        output_type=AssessmentQuestions,
    )

    try:
        logger.info(f"🔍 DEBUG: Running conversation-specific assessment agent with context length: {len(context)}")
        logger.info(f"🔍 DEBUG: Context includes {len(conversation_history)} conversation messages")
        
        with trace("ConversationSpecificAssessment"):
            result = await Runner.run(
                assessment_agent.agent(), 
                input=context
            )
            assessment_result = result.final_output_as(AssessmentQuestions)
            questions = assessment_result.questions[:2]  # Limit to 2 questions

        logger.info(f"🔍 DEBUG: Generated {len(questions)} conversation-specific questions: {[q.question[:50] + '...' if len(q.question) > 50 else q.question for q in questions]}")
        logger.info(
            f"✅ Successfully generated {len(questions)} conversation-specific assessment questions for chat {chat_id}"
        )

        return {
            "success": True,
            "message": f"Successfully generated {len(questions)} conversation-specific assessment questions",
            "questions_count": len(questions),
            "questions": [
                {
                    "id": q.id,
                    "type": q.type,
                    "question": q.question,
                    "options": q.options
                } for q in questions
            ]
        }

    except Exception as e:
        logger.error(f"Error during conversation-specific assessment generation: {str(e)}")
        return {
            "success": False,
            "message": f"Conversation-specific assessment generation failed: {str(e)}",
            "questions_count": 0,
            "questions": [],
        }


async def create_initial_assessment_with_training_questions(
    chat_id: uuid.UUID,
    training_questions: List[dict],
    session: Optional[Session] = None,
) -> dict[str, Any]:
    """
    Create an assessment with only the 3 training-specific questions.
    Conversation-specific and general questions will be added later.
    """
    # Get a session if none is provided
    if session is None:
        session = next(get_session())
    
    # Type assertion to help linter understand session is not None
    assert session is not None

    # Get the chat object
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).first()
    if not chat:
        return {
            "success": False,
            "message": f"Chat not found with ID {chat_id}",
            "questions_count": 0,
            "questions": [],
        }

    try:
        # Create the Assessment record
        assessment = Assessments(
            chat_id=chat_id,
            title=f"Assessment for {chat.title}",
            training_id=chat.training_id,
            responses={}  # Empty responses initially
        )
        session.add(assessment)
        session.flush()  # Flush to get the assessment ID

        # Create Question records for training questions only
        created_questions = []
        for i, question_data in enumerate(training_questions):
            # Map the question type from our format to database format
            question_type_mapping = {
                "rating": "mcq",  # Rating questions are multiple choice with numeric options
                "multiple_choice": "mcq",
                "yes_no": "mcq",  # Yes/No questions are multiple choice
                "text": "frq"     # Text questions are free response
            }
            
            db_question_type = question_type_mapping.get(question_data["type"], "mcq")
            
            # Prepare options for multiple choice questions
            options = None
            if question_data["type"] in ["rating", "multiple_choice", "yes_no"]:
                if question_data["type"] == "rating":
                    # For rating questions, create 1-5 scale options
                    options = ["1", "2", "3", "4", "5"]
                elif question_data["type"] == "yes_no":
                    # For yes/no questions, create Yes/No options
                    options = ["Yes", "No"]
                else:
                    # For multiple choice, use the provided options
                    options = question_data["options"]

            # These are training-specific questions, not default questions
            question = Questions(
                assessment_id=assessment.id,
                stem=question_data["question"],
                question_type=db_question_type,
                options=options,
                default_question=False,  # Training-specific questions
                value=None  # Will be filled when user responds
            )
            session.add(question)
            created_questions.append(question)

        # Commit all changes to the database
        session.commit()

        logger.info(
            f"Successfully created initial assessment {assessment.id} with {len(created_questions)} training-specific questions"
        )

        return {
            "success": True,
            "message": f"Successfully created initial assessment with {len(created_questions)} training-specific questions",
            "questions_count": len(created_questions),
            "assessment_id": str(assessment.id),
            "chat_id": str(chat_id),
            "chat_title": chat.title,
            "questions": [
                {
                    "id": str(q.id),
                    "stem": q.stem,
                    "question_type": q.question_type,
                    "options": q.options,
                    "default_question": q.default_question
                } for q in created_questions
            ]
        }

    except Exception as e:
        logger.error(f"Error creating initial assessment: {str(e)}")
        session.rollback()
        return {
            "success": False,
            "message": f"Initial assessment creation failed: {str(e)}",
            "questions_count": 0,
            "assessment_id": None,
            "chat_id": str(chat_id),
        }


async def create_assessment_with_questions(
    chat_id: uuid.UUID,
    training_questions: List[dict],
    conversation_questions: List[dict],
    session: Optional[Session] = None,
) -> dict[str, Any]:
    """
    Create an assessment with all 7 questions: 3 training-specific, 2 conversation-specific, 2 general.
    This combines pre-generated questions with the general questions.
    """
    # Get a session if none is provided
    if session is None:
        session = next(get_session())
    
    # Type assertion to help linter understand session is not None
    assert session is not None

    # Get the chat object
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).first()
    if not chat:
        return {
            "success": False,
            "message": f"Chat not found with ID {chat_id}",
            "questions_count": 0,
            "questions": [],
        }

    try:
        # Create the Assessment record
        assessment = Assessments(
            chat_id=chat_id,
            title=f"Assessment for {chat.title}",
            training_id=chat.training_id,
            responses={}  # Empty responses initially
        )
        session.add(assessment)
        session.flush()  # Flush to get the assessment ID

        # Combine all questions: 3 training + 2 conversation + 2 general
        all_questions = training_questions + conversation_questions + GENERAL_SELF_REFLECTION_QUESTIONS

        # Create Question records for each question
        created_questions = []
        for i, question_data in enumerate(all_questions):
            # Map the question type from our format to database format
            question_type_mapping = {
                "rating": "mcq",  # Rating questions are multiple choice with numeric options
                "multiple_choice": "mcq",
                "yes_no": "mcq",  # Yes/No questions are multiple choice
                "text": "frq"     # Text questions are free response
            }
            
            db_question_type = question_type_mapping.get(question_data["type"], "mcq")
            
            # Prepare options for multiple choice questions
            options = None
            if question_data["type"] in ["rating", "multiple_choice", "yes_no"]:
                if question_data["type"] == "rating":
                    # For rating questions, create 1-5 scale options
                    options = ["1", "2", "3", "4", "5"]
                elif question_data["type"] == "yes_no":
                    # For yes/no questions, create Yes/No options
                    options = ["Yes", "No"]
                else:
                    # For multiple choice, use the provided options
                    options = question_data["options"]

            # Determine if this is a general/self-reflection question (last 2)
            is_default_question = i >= 5  # Questions 6 and 7 (0-indexed)

            question = Questions(
                assessment_id=assessment.id,
                stem=question_data["question"],
                question_type=db_question_type,
                options=options,
                default_question=is_default_question,
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
            "message": f"Successfully created assessment with {len(created_questions)} questions",
            "questions_count": len(created_questions),
            "assessment_id": str(assessment.id),
            "chat_id": str(chat_id),
            "chat_title": chat.title,
            "questions": [
                {
                    "id": str(q.id),
                    "stem": q.stem,
                    "question_type": q.question_type,
                    "options": q.options,
                    "default_question": q.default_question
                } for q in created_questions
            ]
        }

    except Exception as e:
        logger.error(f"Error creating assessment with questions: {str(e)}")
        session.rollback()
        return {
            "success": False,
            "message": f"Assessment creation failed: {str(e)}",
            "questions_count": 0,
            "assessment_id": None,
            "chat_id": str(chat_id),
        }


async def run_assessment_agent(
    chat_id: uuid.UUID,
    session: Optional[Session] = None,
) -> dict[str, Any]:
    """
    NEW APPROACH: This function now orchestrates the creation of all assessment questions.
    It generates conversation-specific questions and combines them with pre-generated 
    training-specific questions and general questions.
    
    This should be called when training ends to add the conversation-specific questions
    to an already existing assessment with training-specific questions.
    """
    try:
        # Generate conversation-specific questions (2 questions)
        logger.info(f"🔍 DEBUG: Starting conversation-specific assessment for chat {chat_id}")
        conversation_result = await run_conversation_specific_assessment(chat_id, session)
        
        logger.info(f"🔍 DEBUG: Conversation assessment result: {conversation_result}")
        
        if not conversation_result.get("success"):
            logger.error(f"❌ Conversation-specific assessment failed: {conversation_result.get('message')}")
            return conversation_result

        conversation_questions = conversation_result.get("questions", [])
        logger.info(f"🔍 DEBUG: Got {len(conversation_questions)} conversation questions: {[q.get('question', 'No question text')[:50] + '...' if len(q.get('question', '')) > 50 else q.get('question', 'No question text') for q in conversation_questions]}")

        # Get existing training-specific questions from database
        # (These should have been generated during training)
        if session is None:
            session = next(get_session())
        
        # Check if assessment already exists with training-specific questions
        existing_assessment = session.exec(
            select(Assessments).where(Assessments.chat_id == chat_id)
        ).first()

        if existing_assessment:
            # Check how many questions already exist
            existing_questions_count = session.exec(
                select(Questions).where(Questions.assessment_id == existing_assessment.id)
            ).all()
            
            logger.info(f"Found existing assessment {existing_assessment.id} with {len(existing_questions_count)} questions")
            
            # Only add questions if we don't have all 7 yet
            if len(existing_questions_count) < 7:
                logger.info(f"🔍 DEBUG: Adding questions to assessment. Current count: {len(existing_questions_count)}, need to add: {7 - len(existing_questions_count)}")
                created_questions = []
                
                # Add conversation-specific questions (2 questions)
                for question_data in conversation_questions:
                    # Map the question type from our format to database format
                    question_type_mapping = {
                        "rating": "mcq",
                        "multiple_choice": "mcq",
                        "yes_no": "mcq",
                        "text": "frq"
                    }
                    
                    db_question_type = question_type_mapping.get(question_data["type"], "mcq")
                    
                    # Prepare options for multiple choice questions
                    options = None
                    if question_data["type"] in ["rating", "multiple_choice", "yes_no"]:
                        if question_data["type"] == "rating":
                            options = ["1", "2", "3", "4", "5"]
                        elif question_data["type"] == "yes_no":
                            options = ["Yes", "No"]
                        else:
                            options = question_data["options"]

                    question = Questions(
                        assessment_id=existing_assessment.id,
                        stem=question_data["question"],
                        question_type=db_question_type,
                        options=options,
                        default_question=False,  # These are conversation-specific, not default
                        value=None
                    )
                    session.add(question)
                    created_questions.append(question)

                # Add general self-reflection questions (2 questions)
                for question_data in GENERAL_SELF_REFLECTION_QUESTIONS:
                    question_type_mapping = {
                        "rating": "mcq",
                        "multiple_choice": "mcq",
                        "yes_no": "mcq",
                        "text": "frq"
                    }
                    
                    db_question_type = question_type_mapping.get(question_data["type"], "mcq")
                    
                    options = None
                    if question_data["type"] in ["rating", "multiple_choice", "yes_no"]:
                        if question_data["type"] == "rating":
                            options = ["1", "2", "3", "4", "5"]
                        elif question_data["type"] == "yes_no":
                            options = ["Yes", "No"]
                        else:
                            options = question_data["options"]

                    question = Questions(
                        assessment_id=existing_assessment.id,
                        stem=question_data["question"],
                        question_type=db_question_type,
                        options=options,
                        default_question=True,  # These are general/default questions
                        value=None
                    )
                    session.add(question)
                    created_questions.append(question)
            else:
                logger.info(f"Assessment {existing_assessment.id} already has {len(existing_questions_count)} questions, skipping addition")
                created_questions = []

            logger.info(f"🔍 DEBUG: About to commit {len(created_questions)} new questions to database")
            session.commit()
            logger.info(f"🔍 DEBUG: Committed questions successfully")

            # Get all questions for this assessment
            all_questions = session.exec(
                select(Questions).where(Questions.assessment_id == existing_assessment.id)
            ).all()

            logger.info(
                f"Successfully added {len(created_questions)} questions to existing assessment {existing_assessment.id}"
            )

            # Emit assessment completed event via WebSocket (loop-safe)
            try:
                from app.web.training import get_sio_instance
                sio = get_sio_instance()
                logger.info(f"🔍 DEBUG: About to emit assessment_completed event for chat {chat_id} with {len(all_questions)} total questions")
                # Use Socket.IO background task so the emit runs on the server's loop
                sio.start_background_task(
                    sio.emit,
                    "assessment_completed",
                    {
                        "success": True,
                        "message": f"Assessment completed with {len(all_questions)} questions",
                        "chat_id": str(chat_id),
                        "assessment_id": str(existing_assessment.id),
                    },
                    room=str(chat_id),
                )
                logger.info(f"✅ Scheduled assessment_completed emit for chat {chat_id}")
            except Exception as e:
                logger.error(f"❌ Error scheduling assessment_completed event: {str(e)}")
                # Continue even if event scheduling fails

            return {
                "success": True,
                "message": f"Successfully completed assessment with {len(all_questions)} total questions",
                "questions_count": len(all_questions),
                "assessment_id": str(existing_assessment.id),
                "chat_id": str(chat_id),
                "questions": [
                    {
                        "id": str(q.id),
                        "stem": q.stem,
                        "question_type": q.question_type,
                        "options": q.options,
                        "default_question": q.default_question
                    } for q in all_questions
                ]
            }
        else:
            # No existing assessment found - this shouldn't happen in the new flow
            logger.warning(f"No existing assessment found for chat {chat_id}. Creating new one.")
            return await create_assessment_with_questions(
                chat_id, [], conversation_questions, session
            )

    except Exception as e:
        logger.error(f"Error during assessment generation: {str(e)}")
        if session:
            session.rollback()
        return {
            "success": False,
            "message": f"Assessment generation failed: {str(e)}",
            "questions_count": 0,
            "assessment_id": None,
            "chat_id": str(chat_id),
        }
