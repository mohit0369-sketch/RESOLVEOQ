from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from .database import Base


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    orders = relationship("Order", back_populates="customer")
    complaints = relationship("Complaint", back_populates="customer")


class Order(Base):
    __tablename__ = "orders"

    order_id = Column(String, primary_key=True, index=True)
    customer_id = Column(String, ForeignKey("customers.customer_id"), nullable=False)
    item = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, nullable=False, default="placed")
    order_date = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="orders")
    complaints = relationship("Complaint", back_populates="order")


class Complaint(Base):
    __tablename__ = "complaints"

    complaint_id = Column(String, primary_key=True, index=True)
    customer_id = Column(String, ForeignKey("customers.customer_id"), nullable=False)
    order_id = Column(String, ForeignKey("orders.order_id"), nullable=True)
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, nullable=False, default="open")

    customer = relationship("Customer", back_populates="complaints")
    order = relationship("Order", back_populates="complaints")
    case = relationship("Case", back_populates="complaint", uselist=False)


class Case(Base):
    __tablename__ = "cases"

    case_id = Column(String, primary_key=True, index=True)
    complaint_id = Column(
        String,
        ForeignKey("complaints.complaint_id"),
        nullable=False,
        unique=True
    )
    status = Column(String, nullable=False, default="investigating")
    assigned_to = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="case")
    resolution = relationship("Resolution", back_populates="case", uselist=False)


class Resolution(Base):
    __tablename__ = "resolutions"

    resolution_id = Column(String, primary_key=True, index=True)
    case_id = Column(
        String,
        ForeignKey("cases.case_id"),
        nullable=False,
        unique=True
    )
    issue_type = Column(String, nullable=True)
    recommendation = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    escalation = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="resolution")


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"

    doc_id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)


class Embedding(Base):
    """
    Placeholder table for pgvector embeddings.

    On real Postgres + pgvector, change `vector` to the Vector(1536)
    type from the pgvector.sqlalchemy package.

    Kept as Text here so the model also works on plain SQLite
    during local development.
    """
    __tablename__ = "embeddings"

    embedding_id = Column(String, primary_key=True, index=True)
    doc_id = Column(
        String,
        ForeignKey("knowledge_docs.doc_id"),
        nullable=True
    )
    complaint_id = Column(
        String,
        ForeignKey("complaints.complaint_id"),
        nullable=True
    )
    vector = Column(Text, nullable=True)


class User(Base):
    """
    Authentication user.

    Passwords are never stored directly.
    Only the securely hashed password is stored.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)