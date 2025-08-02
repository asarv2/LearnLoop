import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (ARRAY, Boolean, CheckConstraint, Column, Computed,
                        DateTime, Double, Enum, ForeignKeyConstraint, Index,
                        Integer, PrimaryKeyConstraint, SmallInteger, String,
                        Text, UniqueConstraint, Uuid, text)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel
class _Base(SQLModel):
    """Shared config so Pydantic will accept SQLAlchemy types."""
    model_config = {"arbitrary_types_allowed": True}
class Users(_Base, table=True):
    __table_args__ = (
        CheckConstraint('email_change_confirm_status >= 0 AND email_change_confirm_status <= 2', name='users_email_change_confirm_status_check'),
        PrimaryKeyConstraint('id', name='users_pkey'),
        UniqueConstraint('phone', name='users_phone_key'),
        Index('confirmation_token_idx', 'confirmation_token', unique=True),
        Index('email_change_token_current_idx', 'email_change_token_current', unique=True),
        Index('email_change_token_new_idx', 'email_change_token_new', unique=True),
        Index('reauthentication_token_idx', 'reauthentication_token', unique=True),
        Index('recovery_token_idx', 'recovery_token', unique=True),
        Index('users_email_partial_key', 'email', unique=True),
        Index('users_instance_id_email_idx', 'instance_id'),
        Index('users_instance_id_idx', 'instance_id'),
        Index('users_is_anonymous_idx', 'is_anonymous'),
        {'comment': 'Auth: Stores user login data within a secure schema.',
     'schema': 'auth'}
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True))
    is_sso_user: bool = Field(sa_column=Column('is_sso_user', Boolean, default=False, comment='Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.'))
    is_anonymous: bool = Field(sa_column=Column('is_anonymous', Boolean, default=False))
    instance_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('instance_id', Uuid(as_uuid=True)))
    aud: Optional[str] = Field(default=None, sa_column=Column('aud', String(255)))
    role: Optional[str] = Field(default=None, sa_column=Column('role', String(255)))
    email: Optional[str] = Field(default=None, sa_column=Column('email', String(255)))
    encrypted_password: Optional[str] = Field(default=None, sa_column=Column('encrypted_password', String(255)))
    email_confirmed_at: Optional[datetime] = Field(default=None, sa_column=Column('email_confirmed_at', DateTime(True)))
    invited_at: Optional[datetime] = Field(default=None, sa_column=Column('invited_at', DateTime(True)))
    confirmation_token: Optional[str] = Field(default=None, sa_column=Column('confirmation_token', String(255)))
    confirmation_sent_at: Optional[datetime] = Field(default=None, sa_column=Column('confirmation_sent_at', DateTime(True)))
    recovery_token: Optional[str] = Field(default=None, sa_column=Column('recovery_token', String(255)))
    recovery_sent_at: Optional[datetime] = Field(default=None, sa_column=Column('recovery_sent_at', DateTime(True)))
    email_change_token_new: Optional[str] = Field(default=None, sa_column=Column('email_change_token_new', String(255)))
    email_change: Optional[str] = Field(default=None, sa_column=Column('email_change', String(255)))
    email_change_sent_at: Optional[datetime] = Field(default=None, sa_column=Column('email_change_sent_at', DateTime(True)))
    last_sign_in_at: Optional[datetime] = Field(default=None, sa_column=Column('last_sign_in_at', DateTime(True)))
    raw_app_meta_data: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column('raw_app_meta_data', JSONB))
    raw_user_meta_data: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column('raw_user_meta_data', JSONB))
    is_super_admin: Optional[bool] = Field(default=None, sa_column=Column('is_super_admin', Boolean))
    created_at: Optional[datetime] = Field(default=None, sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default=None, sa_column=Column('updated_at', DateTime(True)))
    phone: Optional[str] = Field(default=None, sa_column=Column('phone', Text, server_default=text('NULL::character varying')))
    phone_confirmed_at: Optional[datetime] = Field(default=None, sa_column=Column('phone_confirmed_at', DateTime(True)))
    phone_change: Optional[str] = Field(default=None, sa_column=Column('phone_change', Text, server_default=text("''::character varying")))
    phone_change_token: Optional[str] = Field(default=None, sa_column=Column('phone_change_token', String(255), server_default=text("''::character varying")))
    phone_change_sent_at: Optional[datetime] = Field(default=None, sa_column=Column('phone_change_sent_at', DateTime(True)))
    confirmed_at: Optional[datetime] = Field(default=None, sa_column=Column('confirmed_at', DateTime(True), Computed('LEAST(email_confirmed_at, phone_confirmed_at)', persisted=True)))
    email_change_token_current: Optional[str] = Field(default=None, sa_column=Column('email_change_token_current', String(255), server_default=text("''::character varying")))
    email_change_confirm_status: Optional[int] = Field(default=None, sa_column=Column('email_change_confirm_status', SmallInteger, default=0))
    banned_until: Optional[datetime] = Field(default=None, sa_column=Column('banned_until', DateTime(True)))
    reauthentication_token: Optional[str] = Field(default=None, sa_column=Column('reauthentication_token', String(255), server_default=text("''::character varying")))
    reauthentication_sent_at: Optional[datetime] = Field(default=None, sa_column=Column('reauthentication_sent_at', DateTime(True)))
    deleted_at: Optional[datetime] = Field(default=None, sa_column=Column('deleted_at', DateTime(True)))

    logs: List['Logs'] = Relationship(back_populates='user')
    resumes: List['Resumes'] = Relationship(back_populates='user')
    chats: List['Chats'] = Relationship(back_populates='user')


class Fields(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='fields_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    field_type: str = Field(sa_column=Column('field_type', Enum('persona', 'document', 'numerical', 'categorical', 'text', name='field_type')))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))

    parameters: List['Parameters'] = Relationship(back_populates='field')


class Profiles(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='profiles_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))

    attempts: List['Attempts'] = Relationship(back_populates='profile')
    documents: List['Documents'] = Relationship(back_populates='profile')
    personas: List['Personas'] = Relationship(back_populates='profile')
    chats: List['Chats'] = Relationship(back_populates='profile')


class Rubrics(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='rubrics_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    total_points: Optional[int] = Field(default=None, sa_column=Column('total_points', Integer, default=100))
    standard_length: Optional[int] = Field(default=None, sa_column=Column('standard_length', Integer, default=5))

    scenarios: List['Scenarios'] = Relationship(back_populates='rubric')
    standards: List['Standards'] = Relationship(back_populates='rubric')


class Trainings(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='trainings_pkey'),
        Index('idx_trainings_created_at', 'created_at'),
        Index('idx_trainings_type', 'type'),
        Index('idx_trainings_user_id', 'user_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    type: str = Field(sa_column=Column('type', Text))
    title: str = Field(sa_column=Column('title', Text))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    user_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('user_id', Uuid(as_uuid=True)))
    additional_info: Optional[Dict[str, Any]] = Field(default_factory=dict, sa_column=Column('additional_info', JSONB))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    active: Optional[bool] = Field(default=None, sa_column=Column('active', Boolean, default=False))
    practice: Optional[bool] = Field(default=None, sa_column=Column('practice', Boolean, default=False))
    what_to_do: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('what_to_do', ARRAY(Text())))
    what_not_to_do: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('what_not_to_do', ARRAY(Text())))

    attempts: List['Attempts'] = Relationship(back_populates='training')
    logs: List['Logs'] = Relationship(back_populates='training')
    resumes: List['Resumes'] = Relationship(back_populates='training')
    scenarios: List['Scenarios'] = Relationship(back_populates='training')
    chats: List['Chats'] = Relationship(back_populates='training')
    assessments: List['Assessments'] = Relationship(back_populates='training')
    feedback: List['Feedback'] = Relationship(back_populates='training')
    interview_scores: List['InterviewScores'] = Relationship(back_populates='training')
    messages: List['Messages'] = Relationship(back_populates='training')
    offboarding_scores: List['OffboardingScores'] = Relationship(back_populates='training')


class Attempts(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='attempts_profile_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], ondelete='CASCADE', name='attempts_training_id_fkey'),
        PrimaryKeyConstraint('id', name='attempts_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))

    profile: Optional['Profiles'] = Relationship(back_populates='attempts')
    training: Optional['Trainings'] = Relationship(back_populates='attempts')
    chats: List['Chats'] = Relationship(back_populates='attempt')


class Documents(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='documents_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='documents_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    google_file_id: Optional[str] = Field(default=None, sa_column=Column('google_file_id', Text))
    content: Optional[str] = Field(default=None, sa_column=Column('content', Text))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))

    profile: Optional['Profiles'] = Relationship(back_populates='documents')


class Logs(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='logs_training_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='CASCADE', name='logs_user_id_fkey'),
        PrimaryKeyConstraint('id', name='logs_pkey'),
        Index('idx_logs_training_id', 'training_id'),
        Index('idx_logs_user_id', 'user_id'),
        {'comment': 'for viewing client logs'}
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    level: str = Field(sa_column=Column('level', Enum('info', 'error', 'warn', 'debug', name='log_level')))
    message: str = Field(sa_column=Column('message', Text))
    user_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('user_id', Uuid(as_uuid=True)))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))

    training: Optional['Trainings'] = Relationship(back_populates='logs')
    user: Optional['Users'] = Relationship(back_populates='logs')


class Parameters(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='CASCADE', name='parameters_field_id_fkey'),
        PrimaryKeyConstraint('id', name='parameters_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    field_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('field_id', Uuid(as_uuid=True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    value: Optional[str] = Field(default=None, sa_column=Column('value', Text))

    field: Optional['Fields'] = Relationship(back_populates='parameters')


class Personas(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='SET NULL', name='personas_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='personas_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    system_prompt: Optional[str] = Field(default=None, sa_column=Column('system_prompt', Text))
    temperature: Optional[float] = Field(default=None, sa_column=Column('temperature', Double(53), default=0.0))
    voice: Optional[str] = Field(default=None, sa_column=Column('voice', Text))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))

    profile: Optional['Profiles'] = Relationship(back_populates='personas')
    messages: List['Messages'] = Relationship(back_populates='persona')


class Resumes(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='resumes_training_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='CASCADE', name='resumes_user_id_fkey'),
        PrimaryKeyConstraint('id', name='resumes_pkey'),
        Index('idx_resumes_training_id', 'training_id'),
        Index('idx_resumes_user_id', 'user_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    google_file_id: Optional[str] = Field(default=None, sa_column=Column('google_file_id', Text))
    content: Optional[str] = Field(default=None, sa_column=Column('content', Text))
    user_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('user_id', Uuid(as_uuid=True)))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))

    training: Optional['Trainings'] = Relationship(back_populates='resumes')
    user: Optional['Users'] = Relationship(back_populates='resumes')
    chats: List['Chats'] = Relationship(back_populates='resume')


class Scenarios(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='SET NULL', name='scenarios_rubric_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], ondelete='CASCADE', name='scenarios_training_id_fkey'),
        PrimaryKeyConstraint('id', name='scenarios_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    title: str = Field(sa_column=Column('title', Text))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))
    rubric_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('rubric_id', Uuid(as_uuid=True)))
    field_ids: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('field_ids', ARRAY(Uuid(as_uuid=True))))

    rubric: Optional['Rubrics'] = Relationship(back_populates='scenarios')
    training: Optional['Trainings'] = Relationship(back_populates='scenarios')


class Standards(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='standards_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='standards_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    rubric_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('rubric_id', Uuid(as_uuid=True)))
    items: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('items', ARRAY(Text())))

    rubric: Optional['Rubrics'] = Relationship(back_populates='standards')
    standard_grades: List['StandardGrades'] = Relationship(back_populates='standard')


class Chats(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['attempt_id'], ['attempts.id'], ondelete='CASCADE', name='chats_attempt_id_fkey'),
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='chats_profile_id_fkey'),
        ForeignKeyConstraint(['resume_id'], ['resumes.id'], ondelete='SET NULL', onupdate='CASCADE', name='chats_resume_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='chats_training_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='CASCADE', name='chats_user_id_fkey'),
        PrimaryKeyConstraint('id', name='chats_pkey'),
        Index('idx_chats_training_id', 'training_id'),
        Index('idx_chats_user_id', 'user_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    title: str = Field(sa_column=Column('title', Text))
    completed: bool = Field(sa_column=Column('completed', Boolean, default=False))
    name: str = Field(sa_column=Column('name', Text, server_default=text("''::text"), comment='candidate name'))
    position: str = Field(sa_column=Column('position', Text, server_default=text("''::text"), comment='candidate position'))
    additional_info: str = Field(sa_column=Column('additional_info', Text, server_default=text("''::text")))
    type: str = Field(sa_column=Column('type', Enum('regular', 'cheating', 'ai-assisted', 'preparation', name='interview_type'), default=r'regular', comment='cheating or regular'))
    voice: str = Field(sa_column=Column('voice', Text, default=r'alloy', comment='for openAI'))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))
    feedback: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column('feedback', JSONB, comment='fallback'))
    resume_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('resume_id', Uuid(as_uuid=True)))
    trace_id: Optional[str] = Field(default=None, sa_column=Column('trace_id', Text, comment='for openAI traces'))
    user_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('user_id', Uuid(as_uuid=True)))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))
    training_type: Optional[str] = Field(default=None, sa_column=Column('training_type', Enum('interview', 'offboarding', 'preparation', name='training_type'), default=r'interview'))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))
    attempt_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('attempt_id', Uuid(as_uuid=True)))
    parameter_ids: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('parameter_ids', ARRAY(Uuid(as_uuid=True))))

    attempt: Optional['Attempts'] = Relationship(back_populates='chats')
    profile: Optional['Profiles'] = Relationship(back_populates='chats')
    resume: Optional['Resumes'] = Relationship(back_populates='chats')
    training: Optional['Trainings'] = Relationship(back_populates='chats')
    user: Optional['Users'] = Relationship(back_populates='chats')
    assessments: List['Assessments'] = Relationship(back_populates='chat')
    feedback_: List['Feedback'] = Relationship(back_populates='chat')
    interview_scores: List['InterviewScores'] = Relationship(back_populates='chat')
    messages: List['Messages'] = Relationship(back_populates='chat')
    offboarding_scores: List['OffboardingScores'] = Relationship(back_populates='chat')
    rubric_grades: List['RubricGrades'] = Relationship(back_populates='chat')


class Assessments(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', name='assessments_chat_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='assessments_training_id_fkey'),
        PrimaryKeyConstraint('id', name='assessments_pkey'),
        Index('idx_assessments_chat_id', 'chat_id'),
        Index('idx_assessments_training_id', 'training_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    responses: Dict[str, Any] = Field(sa_column=Column('responses', JSONB, server_default=text("'[]'::jsonb")))
    title: str = Field(sa_column=Column('title', Text, default=r'Untitled Assessment'))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))

    chat: Optional['Chats'] = Relationship(back_populates='assessments')
    training: Optional['Trainings'] = Relationship(back_populates='assessments')
    questions: List['Questions'] = Relationship(back_populates='assessment')


class Feedback(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', onupdate='CASCADE', name='feedback_chat_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='feedback_training_id_fkey'),
        PrimaryKeyConstraint('id', name='feedback_pkey'),
        Index('idx_feedback_training_id', 'training_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    strengths: List[uuid.UUID] = Field(sa_column=Column('strengths', ARRAY(Text()), server_default=text("'{}'::text[]")))
    errors: List[uuid.UUID] = Field(sa_column=Column('errors', ARRAY(Text()), server_default=text("'{}'::text[]")))
    green_flags: List[uuid.UUID] = Field(sa_column=Column('green_flags', ARRAY(Text()), server_default=text("'{}'::text[]")))
    red_flags: List[uuid.UUID] = Field(sa_column=Column('red_flags', ARRAY(Text()), server_default=text("'{}'::text[]")))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))
    weaknesses: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('weaknesses', ARRAY(Text())))

    chat: Optional['Chats'] = Relationship(back_populates='feedback_')
    training: Optional['Trainings'] = Relationship(back_populates='feedback')


class InterviewScores(_Base, table=True):
    __tablename__ = 'interview_scores'
    __table_args__ = (
        CheckConstraint('assessment_thoughtfulness >= 1 AND assessment_thoughtfulness <= 5', name='interview_scores_assessment_thoughtfulness_check'),
        CheckConstraint('communication_rapport >= 1 AND communication_rapport <= 5', name='interview_scores_communication_rapport_check'),
        CheckConstraint('followup_skills >= 1 AND followup_skills <= 5', name='interview_scores_followup_skills_check'),
        CheckConstraint('interview_conduct >= 1 AND interview_conduct <= 5', name='interview_scores_interview_conduct_check'),
        CheckConstraint('overall_score >= 1 AND overall_score <= 100', name='interview_scores_overall_score_check'),
        CheckConstraint('professional_judgment >= 1 AND professional_judgment <= 5', name='interview_scores_professional_judgment_check'),
        CheckConstraint('question_quality >= 1 AND question_quality <= 5', name='interview_scores_question_quality_check'),
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', name='interview_scores_chat_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='interview_scores_training_id_fkey'),
        PrimaryKeyConstraint('id', name='interview_scores_pkey'),
        Index('idx_interview_scores_chat_id', 'chat_id'),
        Index('idx_interview_scores_created_at', 'created_at'),
        Index('idx_interview_scores_overall_score', 'overall_score'),
        Index('idx_interview_scores_training_id', 'training_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    question_quality: int = Field(sa_column=Column('question_quality', Integer))
    followup_skills: int = Field(sa_column=Column('followup_skills', Integer))
    assessment_thoughtfulness: int = Field(sa_column=Column('assessment_thoughtfulness', Integer))
    interview_conduct: int = Field(sa_column=Column('interview_conduct', Integer))
    communication_rapport: int = Field(sa_column=Column('communication_rapport', Integer))
    professional_judgment: int = Field(sa_column=Column('professional_judgment', Integer))
    overall_score: int = Field(sa_column=Column('overall_score', Integer))
    category_feedback: Dict[str, Any] = Field(default_factory=dict, sa_column=Column('category_feedback', JSONB))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    overall_feedback: Optional[str] = Field(default=None, sa_column=Column('overall_feedback', Text))
    strengths: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('strengths', ARRAY(Text()), server_default=text("'{}'::text[]")))
    improvement_areas: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('improvement_areas', ARRAY(Text()), server_default=text("'{}'::text[]")))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))

    chat: Optional['Chats'] = Relationship(back_populates='interview_scores')
    training: Optional['Trainings'] = Relationship(back_populates='interview_scores')


class Messages(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', onupdate='CASCADE', name='messages_chat_id_fkey'),
        ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='SET NULL', name='messages_persona_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='messages_training_id_fkey'),
        PrimaryKeyConstraint('id', name='messages_pkey'),
        Index('idx_messages_training_id', 'training_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('completed_at', DateTime(True)))
    completed: bool = Field(sa_column=Column('completed', Boolean, default=False))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    role: str = Field(sa_column=Column('role', Enum('user', 'assistant', name='message_role')))
    content: Optional[str] = Field(default=None, sa_column=Column('content', Text))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))
    error: Optional[str] = Field(default=None, sa_column=Column('error', Text))
    persona_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('persona_id', Uuid(as_uuid=True)))

    chat: Optional['Chats'] = Relationship(back_populates='messages')
    persona: Optional['Personas'] = Relationship(back_populates='messages')
    training: Optional['Trainings'] = Relationship(back_populates='messages')
    hints: List['Hints'] = Relationship(back_populates='message')


class OffboardingScores(_Base, table=True):
    __tablename__ = 'offboarding_scores'
    __table_args__ = (
        CheckConstraint('assessment_thoughtfulness >= 1 AND assessment_thoughtfulness <= 5', name='offboarding_scores_assessment_thoughtfulness_check'),
        CheckConstraint('communication_professionalism >= 1 AND communication_professionalism <= 5', name='offboarding_scores_communication_professionalism_check'),
        CheckConstraint('conflict_resolution >= 1 AND conflict_resolution <= 5', name='offboarding_scores_conflict_resolution_check'),
        CheckConstraint('empathy_emotional_intelligence >= 1 AND empathy_emotional_intelligence <= 5', name='offboarding_scores_empathy_emotional_intelligence_check'),
        CheckConstraint('overall_score >= 1 AND overall_score <= 100', name='offboarding_scores_overall_score_check'),
        CheckConstraint('transition_planning_logistics >= 1 AND transition_planning_logistics <= 5', name='offboarding_scores_transition_planning_logistics_check'),
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', name='offboarding_scores_chat_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='offboarding_scores_training_id_fkey'),
        PrimaryKeyConstraint('id', name='offboarding_scores_pkey'),
        Index('idx_offboarding_scores_chat_id', 'chat_id'),
        Index('idx_offboarding_scores_created_at', 'created_at'),
        Index('idx_offboarding_scores_overall_score', 'overall_score'),
        Index('idx_offboarding_scores_training_id', 'training_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    empathy_emotional_intelligence: int = Field(sa_column=Column('empathy_emotional_intelligence', Integer))
    communication_professionalism: int = Field(sa_column=Column('communication_professionalism', Integer))
    transition_planning_logistics: int = Field(sa_column=Column('transition_planning_logistics', Integer))
    conflict_resolution: int = Field(sa_column=Column('conflict_resolution', Integer))
    assessment_thoughtfulness: int = Field(sa_column=Column('assessment_thoughtfulness', Integer))
    overall_score: int = Field(sa_column=Column('overall_score', Integer))
    category_feedback: Dict[str, Any] = Field(default_factory=dict, sa_column=Column('category_feedback', JSONB))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    clarity_of_next_steps: int = Field(sa_column=Column('clarity_of_next_steps', Integer, default=1))
    overall_feedback: Optional[str] = Field(default=None, sa_column=Column('overall_feedback', Text))
    strengths: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('strengths', ARRAY(Text()), server_default=text("'{}'::text[]")))
    improvement_areas: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('improvement_areas', ARRAY(Text()), server_default=text("'{}'::text[]")))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))

    chat: Optional['Chats'] = Relationship(back_populates='offboarding_scores')
    training: Optional['Trainings'] = Relationship(back_populates='offboarding_scores')


class RubricGrades(_Base, table=True):
    __tablename__ = 'rubric_grades'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', name='rubric_grades_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='rubric_grades_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    score: int = Field(sa_column=Column('score', Integer))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    chat_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('chat_id', Uuid(as_uuid=True)))

    chat: Optional['Chats'] = Relationship(back_populates='rubric_grades')
    standard_grades: List['StandardGrades'] = Relationship(back_populates='rubric_grade')


class Hints(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE', name='hints_message_id_fkey'),
        PrimaryKeyConstraint('id', name='hints_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    message_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('message_id', Uuid(as_uuid=True)))
    contents: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('contents', ARRAY(Text())))

    message: Optional['Messages'] = Relationship(back_populates='hints')


class Questions(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['assessment_id'], ['assessments.id'], ondelete='CASCADE', name='questions_assessment_id_fkey'),
        PrimaryKeyConstraint('id', name='questions_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    stem: str = Field(sa_column=Column('stem', Text))
    question_type: str = Field(sa_column=Column('question_type', Enum('mcq', 'frq', name='question_type')))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    assessment_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('assessment_id', Uuid(as_uuid=True)))
    options: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('options', ARRAY(Text())))
    value: Optional[str] = Field(default=None, sa_column=Column('value', Text))

    assessment: Optional['Assessments'] = Relationship(back_populates='questions')


class StandardGrades(_Base, table=True):
    __tablename__ = 'standard_grades'
    __table_args__ = (
        ForeignKeyConstraint(['rubric_grade_id'], ['rubric_grades.id'], ondelete='CASCADE', name='standard_grades_rubric_grade_id_fkey'),
        ForeignKeyConstraint(['standard_id'], ['standards.id'], ondelete='CASCADE', name='standard_grades_standard_id_fkey'),
        PrimaryKeyConstraint('id', name='standard_grades_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    score: int = Field(sa_column=Column('score', Integer))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    standard_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('standard_id', Uuid(as_uuid=True)))
    rubric_grade_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('rubric_grade_id', Uuid(as_uuid=True)))

    rubric_grade: Optional['RubricGrades'] = Relationship(back_populates='standard_grades')
    standard: Optional['Standards'] = Relationship(back_populates='standard_grades')
