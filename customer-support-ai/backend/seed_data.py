"""
Populates the database with fake customers, orders, and complaints so
Student 1 (and everyone downstream) can develop/test without waiting
on real data.

Run with:  python seed_data.py
"""
from datetime import datetime, timedelta

from app.database import Base, engine, SessionLocal
from app import models

Base.metadata.create_all(bind=engine)

db = SessionLocal()

customers = [
    {"customer_id": "U101", "name": "Rahul", "email": "rahul@example.com", "phone": "9876543210"},
    {"customer_id": "U102", "name": "Priya", "email": "priya@example.com", "phone": "9876500011"},
    {"customer_id": "U103", "name": "Amit", "email": "amit@example.com", "phone": "9876500022"},
]

orders = [
    {"order_id": "O501", "customer_id": "U101", "item": "Headphones", "amount": 1499, "status": "delivered"},
    {"order_id": "O502", "customer_id": "U102", "item": "Keyboard", "amount": 899, "status": "shipped"},
    {"order_id": "O503", "customer_id": "U103", "item": "Mouse", "amount": 499, "status": "placed"},
]

complaints = [
    {
        "complaint_id": "C001",
        "customer_id": "U101",
        "order_id": "O501",
        "text": "My headphones arrived damaged",
        "timestamp": datetime.utcnow() - timedelta(days=1),
        "status": "open",
    },
    {
        "complaint_id": "C002",
        "customer_id": "U102",
        "order_id": "O502",
        "text": "My order is late",
        "timestamp": datetime.utcnow() - timedelta(hours=5),
        "status": "open",
    },
]


def seed():
    for c in customers:
        if not db.get(models.Customer, c["customer_id"]):
            db.add(models.Customer(**c))

    for o in orders:
        if not db.get(models.Order, o["order_id"]):
            db.add(models.Order(**o))

    db.commit()  # commit customers/orders first so complaints' foreign keys resolve

    for comp in complaints:
        if not db.get(models.Complaint, comp["complaint_id"]):
            db.add(models.Complaint(**comp))

    db.commit()
    print(f"Seeded {len(customers)} customers, {len(orders)} orders, {len(complaints)} complaints.")


if __name__ == "__main__":
    seed()
    db.close()
