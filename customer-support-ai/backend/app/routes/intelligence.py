from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models

import sys
from pathlib import Path

STUDENT2_PATH = Path(__file__).resolve().parents[3] / "student2_intelligence" / "student2-intelligence"

if str(STUDENT2_PATH) not in sys.path:
    sys.path.insert(0, str(STUDENT2_PATH))

from main import analyze_complaints


router = APIRouter(prefix="/intelligence", tags=["intelligence"])


@router.post("/analyze")
def analyze_complaints_endpoint(complaints: list[dict]):
    return analyze_complaints(complaints)
