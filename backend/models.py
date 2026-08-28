from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Text,
)

from database import Base


class CitizenRequest(Base):
    __tablename__ = "citizen_request"

    id = Column(Integer, primary_key=True, autoincrement=True)
    raw_text = Column(Text)
    language_detected = Column(Text)
    issue_category = Column(Text)
    severity = Column(Text)
    location_raw = Column(Text)
    district = Column(Text)
    block = Column(Text)
    village = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)
    confidence = Column(Float)
    is_synthetic = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class CitizenRequestRaw(Base):
    __tablename__ = "citizen_request_raw"

    id = Column(Integer, primary_key=True, autoincrement=True)
    original_text = Column(Text)
    linked_request_id = Column(Integer, ForeignKey("citizen_request.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Gazetteer(Base):
    __tablename__ = "gazetteer"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text)
    admin_level = Column(Text)
    district = Column(Text)
    block = Column(Text)
    population = Column(Integer)
    latitude = Column(Float)
    longitude = Column(Float)


class DemandCluster(Base):
    __tablename__ = "demand_cluster"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_category = Column(Text)
    centroid_lat = Column(Float)
    centroid_lon = Column(Float)
    report_count = Column(Integer)
    unique_reporters = Column(Integer)
    population_affected = Column(Integer)


class PriorityScore(Base):
    __tablename__ = "priority_score"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cluster_id = Column(Integer, ForeignKey("demand_cluster.id"))
    priority_score = Column(Float)
    breakdown = Column(Text)
    runner_up_cluster_id = Column(Integer, nullable=True)
    computed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
