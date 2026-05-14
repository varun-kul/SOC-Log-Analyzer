from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    log_files = relationship("LogFile", back_populates="owner")


class LogFile(Base):
    __tablename__ = "log_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    log_type = Column(String, default="zscaler")
    status = Column(String, default="uploaded")  # uploaded | processing | done | error
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="log_files")
    analysis = relationship("Analysis", back_populates="log_file", uselist=False)


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    log_file_id = Column(Integer, ForeignKey("log_files.id"), unique=True)
    summary = Column(Text)           # High-level AI summary
    timeline = Column(Text)          # JSON string: list of timeline events
    anomalies = Column(Text)         # JSON string: list of anomaly objects
    total_entries = Column(Integer, default=0)
    anomaly_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    log_file = relationship("LogFile", back_populates="analysis")