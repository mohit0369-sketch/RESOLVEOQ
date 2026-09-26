from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ---------- Customer ----------
class CustomerBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class CustomerCreate(CustomerBase):
    customer_id: str


class CustomerOut(CustomerBase):
    customer_id: str

    class Config:
        from_attributes = True


# ---------- Order ----------
class OrderBase(BaseModel):
    customer_id: str
    item: str
    amount: float
    status: str = "placed"


class OrderCreate(OrderBase):
    order_id: str


class OrderOut(OrderBase):
    order_id: str
    order_date: datetime

    class Config:
        from_attributes = True


# ---------- Complaint ----------
class ComplaintCreate(BaseModel):
    customer_id: str
    order_id: Optional[str] = None
    text: str
    timestamp: Optional[datetime] = None


class ComplaintUpdate(BaseModel):
    status: str


class ComplaintOut(BaseModel):
    complaint_id: str
    customer_id: str
    order_id: Optional[str] = None
    text: str
    timestamp: datetime
    status: str

    class Config:
        from_attributes = True
