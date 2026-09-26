import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/complaints", tags=["complaints"])


def _new_complaint_id() -> str:
    return f"C{uuid.uuid4().hex[:8].upper()}"


@router.post("", response_model=schemas.ComplaintOut)
def create_complaint(complaint: schemas.ComplaintCreate, db: Session = Depends(get_db)):
    if not db.get(models.Customer, complaint.customer_id):
        raise HTTPException(status_code=400, detail="customer_id does not exist")
    if complaint.order_id and not db.get(models.Order, complaint.order_id):
        raise HTTPException(status_code=400, detail="order_id does not exist")

    db_complaint = models.Complaint(
        complaint_id=_new_complaint_id(),
        customer_id=complaint.customer_id,
        order_id=complaint.order_id,
        text=complaint.text,
        timestamp=complaint.timestamp or datetime.utcnow(),
        status="open",
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint


@router.get("", response_model=list[schemas.ComplaintOut])
def list_complaints(status: str | None = None, db: Session = Depends(get_db)):
    """Student 2's Intelligence Engine calls this to pull complaints for
    classification, sentiment, severity, embeddings, clustering, trends."""
    query = db.query(models.Complaint)
    if status:
        query = query.filter(models.Complaint.status == status)
    return query.all()


@router.get("/{complaint_id}", response_model=schemas.ComplaintOut)
def get_complaint(complaint_id: str, db: Session = Depends(get_db)):
    complaint = db.get(models.Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint


@router.put("/{complaint_id}", response_model=schemas.ComplaintOut)
def update_complaint(complaint_id: str, update: schemas.ComplaintUpdate, db: Session = Depends(get_db)):
    complaint = db.get(models.Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    complaint.status = update.status
    db.commit()
    db.refresh(complaint)
    return complaint
