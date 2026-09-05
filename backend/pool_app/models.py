from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Table, Float, DateTime, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

try:
    from .database import Base
except ImportError:
    from database import Base

# Table de liaison plusieurs-à-plusieurs : un pooler a plusieurs joueurs, un joueur appartient à un pooler.
pooler_player_association = Table(
    'pooler_player',
    Base.metadata,
    Column('pooler_id', Integer, ForeignKey('poolers.id', ondelete="CASCADE"), primary_key=True),
    Column('player_id', Integer, ForeignKey('players.id', ondelete="CASCADE"), primary_key=True)
)

class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    team = Column(String)
    position = Column(String)
    points = Column(Integer, default=0)
    is_drafted = Column(Boolean, default=False)
    current_team = Column(String, nullable=True)
    current_position = Column(String, nullable=True)
    poolers = relationship("Pooler", secondary=pooler_player_association, back_populates="players")
    season_stats = relationship("PlayerSeasonStat", back_populates="player", cascade="all, delete-orphan")


class PlayerSeasonStat(Base):
    __tablename__ = "player_season_stats"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True)
    season = Column(String, nullable=False, index=True)
    team = Column(String, nullable=True)
    position = Column(String, nullable=True)
    games_played = Column(Integer, default=0)
    goals = Column(Integer, default=0)
    assists = Column(Integer, default=0)
    points = Column(Integer, default=0)
    plus_minus = Column(Float, default=0.0)
    shots = Column(Integer, default=0)
    hits = Column(Integer, default=0)
    blocks = Column(Integer, default=0)
    pim = Column(Integer, default=0)
    save_percentage = Column(Float, nullable=True)
    source = Column(String, default="imported")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)

    player = relationship("Player", back_populates="season_stats")

    __table_args__ = (
        UniqueConstraint("player_id", "season", name="uq_player_season"),
    )


class Pooler(Base):
    __tablename__ = "poolers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False)
    draft_order = Column(Integer, unique=True, nullable=True)

    players = relationship("Player", secondary=pooler_player_association, back_populates="poolers")


class PoolSeason(Base):
    __tablename__ = "pool_seasons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    status = Column(String, default="draft")
    draft_order = Column(JSON, default=list, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
