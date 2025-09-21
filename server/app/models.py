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

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True))
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

    trainings: List['Trainings'] = Relationship(back_populates='user')
    logs: List['Logs'] = Relationship(back_populates='user')


class Fields(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='fields_pkey'),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    field_type: str = Field(sa_column=Column('field_type', Enum('persona', 'document', 'numerical', 'categorical', 'text', name='field_type')))
    hidden: bool = Field(sa_column=Column('hidden', Boolean, default=False))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))

    groups: List['Groups'] = Relationship(back_populates='level_field')
    groups_: List['Groups'] = Relationship(back_populates='name_field')
    groups1: List['Groups'] = Relationship(back_populates='personality_field')
    groups2: List['Groups'] = Relationship(back_populates='position_field')
    groups3: List['Groups'] = Relationship(back_populates='voice_field')
    parameters: List['Parameters'] = Relationship(back_populates='field')


class Groups(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='groups_pkey'),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    field_ids: List[uuid.UUID] = Field(sa_column=Column('field_ids', ARRAY(Uuid(as_uuid=True)), server_default=text("'{}'::uuid[]")))
    name: Optional[str] = Field(default=None, sa_column=Column('name', Text))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))


class Rubrics(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='rubrics_pkey'),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    total_points: Optional[int] = Field(default=None, sa_column=Column('total_points', Integer, default=100))
    standard_length: Optional[int] = Field(default=None, sa_column=Column('standard_length', Integer, default=5))

    standards: List['Standards'] = Relationship(back_populates='rubric')
    scenarios: List['Scenarios'] = Relationship(back_populates='rubric')


class Groups(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['level_field_id'], ['fields.id'], ondelete='SET NULL', onupdate='CASCADE', name='groups_level_field_id_fkey'),
        ForeignKeyConstraint(['name_field_id'], ['fields.id'], ondelete='SET NULL', onupdate='CASCADE', name='groups_name_field_id_fkey'),
        ForeignKeyConstraint(['personality_field_id'], ['fields.id'], ondelete='SET NULL', onupdate='CASCADE', name='groups_personality_field_id_fkey'),
        ForeignKeyConstraint(['position_field_id'], ['fields.id'], ondelete='SET NULL', onupdate='CASCADE', name='groups_position_field_id_fkey'),
        ForeignKeyConstraint(['voice_field_id'], ['fields.id'], ondelete='SET NULL', onupdate='CASCADE', name='groups_voice_field_id_fkey'),
        PrimaryKeyConstraint('id', name='groups_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    name: Optional[str] = Field(default=None, sa_column=Column('name', Text))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    name_field_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('name_field_id', Uuid(as_uuid=True)))
    level_field_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('level_field_id', Uuid(as_uuid=True)))
    voice_field_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('voice_field_id', Uuid(as_uuid=True)))
    position_field_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('position_field_id', Uuid(as_uuid=True)))
    personality_field_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('personality_field_id', Uuid(as_uuid=True)))

    level_field: Optional['Fields'] = Relationship(back_populates='groups')
    name_field: Optional['Fields'] = Relationship(back_populates='groups_')
    personality_field: Optional['Fields'] = Relationship(back_populates='groups1')
    position_field: Optional['Fields'] = Relationship(back_populates='groups2')
    voice_field: Optional['Fields'] = Relationship(back_populates='groups3')


class Parameters(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='CASCADE', name='parameters_field_id_fkey'),
        PrimaryKeyConstraint('id', name='parameters_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    field_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('field_id', Uuid(as_uuid=True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    value: Optional[str] = Field(default=None, sa_column=Column('value', Text))

    field: Optional['Fields'] = Relationship(back_populates='parameters')


class Profiles(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['id'], ['auth.users.id'], ondelete='CASCADE', onupdate='CASCADE', name='profiles_id_fkey'),
        PrimaryKeyConstraint('id', name='profiles_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    active: Optional[bool] = Field(default=None, sa_column=Column('active', Boolean, default=False))
    last_active: Optional[datetime] = Field(default=None, sa_column=Column('last_active', DateTime(True)))
    role: Optional[str] = Field(default=None, sa_column=Column('role', Enum('employee', 'admin', 'superadmin', name='user_role'), default=r'employee'))

    attempts: List['Attempts'] = Relationship(back_populates='profile')
    documents: List['Documents'] = Relationship(back_populates='profile')
    personas: List['Personas'] = Relationship(back_populates='profile')
    user_feedback: List['UserFeedback'] = Relationship(back_populates='user')
    user_insights: List['UserInsights'] = Relationship(back_populates='user')
    chats: List['Chats'] = Relationship(back_populates='profile')


class Standards(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='standards_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='standards_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    rubric_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('rubric_id', Uuid(as_uuid=True)))
    items: Optional[List[str]] = Field(default=None, sa_column=Column('items', ARRAY(Text())))

    rubric: Optional['Rubrics'] = Relationship(back_populates='standards')
    standard_grades: List['StandardGrades'] = Relationship(back_populates='standard')


class Trainings(_Base, table=True):
    __table_args__ = (
        CheckConstraint("training_type = ANY (ARRAY['standard'::text, 'required'::text, 'custom'::text])", name='trainings_training_type_check'),
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], name='trainings_user_id_fkey'),
        PrimaryKeyConstraint('id', name='trainings_pkey'),
        Index('idx_trainings_created_at', 'created_at')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    title: str = Field(sa_column=Column('title', Text))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    practice: bool = Field(sa_column=Column('practice', Boolean, default=False))
    show_documents: bool = Field(sa_column=Column('show_documents', Boolean, default=False))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    active: Optional[bool] = Field(default=None, sa_column=Column('active', Boolean, default=False))
    what_to_do: Optional[List[str]] = Field(default=None, sa_column=Column('what_to_do', ARRAY(Text())))
    what_not_to_do: Optional[List[str]] = Field(default=None, sa_column=Column('what_not_to_do', ARRAY(Text())))
    training_type: Optional[str] = Field(default=None, sa_column=Column('training_type', Text, default=r'standard'))
    user_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('user_id', Uuid(as_uuid=True)))

    user: Optional['Users'] = Relationship(back_populates='trainings')
    attempts: List['Attempts'] = Relationship(back_populates='training')
    logs: List['Logs'] = Relationship(back_populates='training')
    scenarios: List['Scenarios'] = Relationship(back_populates='training')
    chats: List['Chats'] = Relationship(back_populates='training')
    assessments: List['Assessments'] = Relationship(back_populates='training')
    feedback: List['Feedback'] = Relationship(back_populates='training')
    messages: List['Messages'] = Relationship(back_populates='training')


class Attempts(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='attempts_profile_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], ondelete='CASCADE', name='attempts_training_id_fkey'),
        PrimaryKeyConstraint('id', name='attempts_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
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

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    content: Optional[str] = Field(default=None, sa_column=Column('content', Text))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))
    title: Optional[str] = Field(default=None, sa_column=Column('title', Text))

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

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    level: str = Field(sa_column=Column('level', Enum('info', 'error', 'warn', 'debug', name='log_level')))
    message: str = Field(sa_column=Column('message', Text))
    user_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('user_id', Uuid(as_uuid=True)))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))

    training: Optional['Trainings'] = Relationship(back_populates='logs')
    user: Optional['Users'] = Relationship(back_populates='logs')


class Personas(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='SET NULL', name='personas_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='personas_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    active: bool = Field(sa_column=Column('active', Boolean, default=True))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    system_prompt: Optional[str] = Field(default=None, sa_column=Column('system_prompt', Text))
    temperature: Optional[float] = Field(default=None, sa_column=Column('temperature', Double(53), default=0.0))
    voice: Optional[str] = Field(default=None, sa_column=Column('voice', Text))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))
    realtime_prompt: Optional[str] = Field(default=None, sa_column=Column('realtime_prompt', Text))
    level: Optional[str] = Field(default=None, sa_column=Column('level', Enum('junior', 'mid', 'senior', 'executive', name='level')))
    position: Optional[str] = Field(default=None, sa_column=Column('position', Text))

    profile: Optional['Profiles'] = Relationship(back_populates='personas')
    messages: List['Messages'] = Relationship(back_populates='persona')


class Scenarios(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='SET NULL', name='scenarios_rubric_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], ondelete='CASCADE', name='scenarios_training_id_fkey'),
        PrimaryKeyConstraint('id', name='scenarios_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    title: str = Field(sa_column=Column('title', Text))
    objectives: List[str] = Field(sa_column=Column('objectives', ARRAY(Text()), server_default=text("'{}'::text[]")))
    parameter_ids: List[uuid.UUID] = Field(sa_column=Column('parameter_ids', ARRAY(Uuid(as_uuid=True)), server_default=text("'{}'::uuid[]")))
    document_ids: List[uuid.UUID] = Field(sa_column=Column('document_ids', ARRAY(Uuid(as_uuid=True)), server_default=text("'{}'::uuid[]")))
    prompts: Dict[str, Any] = Field(default_factory=dict, sa_column=Column('prompts', JSONB))
    prompt_mapping: Dict[str, Any] = Field(default_factory=dict, sa_column=Column('prompt_mapping', JSONB))
    group_ids: List[uuid.UUID] = Field(sa_column=Column('group_ids', ARRAY(Uuid(as_uuid=True)), server_default=text("'{}'::uuid[]")))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))
    rubric_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('rubric_id', Uuid(as_uuid=True)))
    field_ids: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('field_ids', ARRAY(Uuid(as_uuid=True))))
    problem_statement: Optional[str] = Field(default=None, sa_column=Column('problem_statement', Text, comment='description of the problem'))
    parent_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('parent_id', Uuid, comment='parent scenario id'))

    rubric: Optional['Rubrics'] = Relationship(back_populates='scenarios')
    training: Optional['Trainings'] = Relationship(back_populates='scenarios')
    chats: List['Chats'] = Relationship(back_populates='scenario')


class UserFeedback(_Base, table=True):
    __tablename__ = 'user_feedback'
    __table_args__ = (
        ForeignKeyConstraint(['user_id'], ['profiles.id'], name='user_feedback_user_id_fkey'),
        PrimaryKeyConstraint('id', name='user_feedback_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    feedback_text: str = Field(sa_column=Column('feedback_text', Text, server_default=text("''::text")))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    user_id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('user_id', Uuid(as_uuid=True)))

    user: Optional['Profiles'] = Relationship(back_populates='user_feedback')


class UserInsights(_Base, table=True):
    __tablename__ = 'user_insights'
    __table_args__ = (
        ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE', name='user_insights_user_id_fkey'),
        PrimaryKeyConstraint('id', name='user_insights_pkey'),
        Index('idx_user_insights_generated_at', 'generated_at'),
        Index('idx_user_insights_user_id', 'user_id')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    user_id: uuid.UUID = Field(sa_column=Column('user_id', Uuid(as_uuid=True)))
    strengths_blurb: str = Field(sa_column=Column('strengths_blurb', Text))
    improvements_blurb: str = Field(sa_column=Column('improvements_blurb', Text))
    based_on_conversations: int = Field(sa_column=Column('based_on_conversations', Integer, default=0))
    based_on_rubric_grades: int = Field(sa_column=Column('based_on_rubric_grades', Integer, default=0))
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('generated_at', DateTime(True)))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))

    user: Optional['Profiles'] = Relationship(back_populates='user_insights')


class Chats(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['attempt_id'], ['attempts.id'], ondelete='CASCADE', name='chats_attempt_id_fkey'),
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='chats_profile_id_fkey'),
        ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], name='chats_scenario_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='chats_training_id_fkey'),
        PrimaryKeyConstraint('id', name='chats_pkey'),
        Index('idx_chats_training_id', 'training_id')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    title: str = Field(sa_column=Column('title', Text))
    completed: bool = Field(sa_column=Column('completed', Boolean, default=False))
    voice: str = Field(sa_column=Column('voice', Text, default=r'alloy', comment='for openAI'))
    persona_ids: List[uuid.UUID] = Field(sa_column=Column('persona_ids', ARRAY(Uuid(as_uuid=True)), server_default=text("'{}'::uuid[]")))
    persona_mapping: Dict[str, Any] = Field(default_factory=dict, sa_column=Column('persona_mapping', JSONB))
    prompts: Dict[str, Any] = Field(default_factory=dict, sa_column=Column('prompts', JSONB))
    max_turns: Dict[str, Any] = Field(default_factory=dict, sa_column=Column('max_turns', JSONB))
    require_users: bool = Field(sa_column=Column('require_users', Boolean, default=True))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))
    trace_id: Optional[str] = Field(default=None, sa_column=Column('trace_id', Text, comment='for openAI traces'))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))
    attempt_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('attempt_id', Uuid(as_uuid=True)))
    parameter_ids: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('parameter_ids', ARRAY(Uuid(as_uuid=True))))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text, comment='description of chat, i.e, scenario'))
    scenario_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('scenario_id', Uuid(as_uuid=True)))
    idle_timeout: Optional[int] = Field(default=None, sa_column=Column('idle_timeout', Integer, default=30))

    attempt: Optional['Attempts'] = Relationship(back_populates='chats')
    profile: Optional['Profiles'] = Relationship(back_populates='chats')
    scenario: Optional['Scenarios'] = Relationship(back_populates='chats')
    training: Optional['Trainings'] = Relationship(back_populates='chats')
    assessments: List['Assessments'] = Relationship(back_populates='chat')
    feedback: List['Feedback'] = Relationship(back_populates='chat')
    messages: List['Messages'] = Relationship(back_populates='chat')
    rubric_grades: List['RubricGrades'] = Relationship(back_populates='chat')


class Assessments(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', name='assessments_chat_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='assessments_training_id_fkey'),
        PrimaryKeyConstraint('id', name='assessments_pkey'),
        Index('idx_assessments_chat_id', 'chat_id'),
        Index('idx_assessments_training_id', 'training_id')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    chat_id: uuid.UUID = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
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

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    strengths: List[str] = Field(sa_column=Column('strengths', ARRAY(Text()), server_default=text("'{}'::text[]")))
    errors: List[str] = Field(sa_column=Column('errors', ARRAY(Text()), server_default=text("'{}'::text[]")))
    chat_id: uuid.UUID = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))

    chat: Optional['Chats'] = Relationship(back_populates='feedback')
    training: Optional['Trainings'] = Relationship(back_populates='feedback')


class Messages(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', onupdate='CASCADE', name='messages_chat_id_fkey'),
        ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='SET NULL', name='messages_persona_id_fkey'),
        ForeignKeyConstraint(['training_id'], ['trainings.id'], name='messages_training_id_fkey'),
        PrimaryKeyConstraint('id', name='messages_pkey'),
        Index('idx_messages_training_id', 'training_id')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('completed_at', DateTime(True)))
    completed: bool = Field(sa_column=Column('completed', Boolean, default=False))
    chat_id: uuid.UUID = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    role: str = Field(sa_column=Column('role', Enum('user', 'assistant', name='message_role')))
    word_timestamps: List[uuid.UUID] = Field(sa_column=Column('word_timestamps', ARRAY(JSONB(astext_type=Text())), server_default=text("'{}'::jsonb[]")))
    content: Optional[str] = Field(default=None, sa_column=Column('content', Text))
    training_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('training_id', Uuid(as_uuid=True)))
    error: Optional[str] = Field(default=None, sa_column=Column('error', Text))
    persona_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('persona_id', Uuid(as_uuid=True)))
    interruption_ms: Optional[int] = Field(default=None, sa_column=Column('interruption_ms', Integer, comment='when message was interrupted'))

    chat: Optional['Chats'] = Relationship(back_populates='messages')
    persona: Optional['Personas'] = Relationship(back_populates='messages')
    training: Optional['Trainings'] = Relationship(back_populates='messages')
    hints: List['Hints'] = Relationship(back_populates='message')


class RubricGrades(_Base, table=True):
    __tablename__ = 'rubric_grades'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', name='rubric_grades_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='rubric_grades_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    score: int = Field(sa_column=Column('score', Integer))
    strengths: List[str] = Field(sa_column=Column('strengths', ARRAY(Text()), server_default=text("'{}'::text[]")))
    improvements: List[str] = Field(sa_column=Column('improvements', ARRAY(Text()), server_default=text("'{}'::text[]")))
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

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    difficulty: str = Field(sa_column=Column('difficulty', Text, default=r'high'))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    message_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('message_id', Uuid(as_uuid=True)))
    contents: Optional[List[str]] = Field(default=None, sa_column=Column('contents', ARRAY(Text())))

    message: Optional['Messages'] = Relationship(back_populates='hints')


class Questions(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['assessment_id'], ['assessments.id'], ondelete='CASCADE', name='questions_assessment_id_fkey'),
        PrimaryKeyConstraint('id', name='questions_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    stem: str = Field(sa_column=Column('stem', Text))
    question_type: str = Field(sa_column=Column('question_type', Enum('mcq', 'frq', name='question_type')))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    assessment_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('assessment_id', Uuid(as_uuid=True)))
    options: Optional[List[str]] = Field(default=None, sa_column=Column('options', ARRAY(Text())))
    value: Optional[str] = Field(default=None, sa_column=Column('value', Text))
    default_question: Optional[bool] = Field(default=None, sa_column=Column('default_question', Boolean, default=False, comment='if a default question'))

    assessment: Optional['Assessments'] = Relationship(back_populates='questions')


class StandardGrades(_Base, table=True):
    __tablename__ = 'standard_grades'
    __table_args__ = (
        ForeignKeyConstraint(['rubric_grade_id'], ['rubric_grades.id'], ondelete='CASCADE', name='standard_grades_rubric_grade_id_fkey'),
        ForeignKeyConstraint(['standard_id'], ['standards.id'], ondelete='CASCADE', name='standard_grades_standard_id_fkey'),
        PrimaryKeyConstraint('id', name='standard_grades_pkey')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    name: str = Field(sa_column=Column('name', Text))
    score: int = Field(sa_column=Column('score', Integer))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))
    standard_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('standard_id', Uuid(as_uuid=True)))
    rubric_grade_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('rubric_grade_id', Uuid(as_uuid=True)))

    rubric_grade: Optional['RubricGrades'] = Relationship(back_populates='standard_grades')
    standard: Optional['Standards'] = Relationship(back_populates='standard_grades')
