from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=schemas.OrderOut)
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    if not db.get(models.Customer, order.customer_id):
        raise HTTPException(status_code=400, detail="customer_id does not exist")
    existing = db.get(models.Order, order.order_id)
    if existing:
        raise HTTPException(status_code=400, detail="order_id already exists")
    db_order = models.Order(**order.model_dump())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


@router.get("", response_model=list[schemas.OrderOut])
def list_orders(customer_id: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Order)
    if customer_id:
        query = query.filter(models.Order.customer_id == customer_id)
    return query.all()


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db)):
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
