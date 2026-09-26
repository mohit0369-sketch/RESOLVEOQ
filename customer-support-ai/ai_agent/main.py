import os
from fastapi import FastAPI, HTTPException
import httpx

from agent import agent, get_policy
from schemas import AgentRequest, AgentResponse


BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
PORT = int(os.getenv("PORT", "8001"))


app = FastAPI(
    title="RESOLVE IQ — Decision Engine",
    description="AI Agent for complaint decisioning and customer-support response generation.",
    version="1.0.0",
)


@app.get("/")
def root():
    return {
        "message": "RESOLVE IQ — AI Agent",
        "status": "running",
        "version": "1.0.0",
        "documentation": "/docs",
        "endpoints": [
            "GET /health",
            "POST /agent/run",
            "GET /policy",
        ],
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "ai_agent",
        "llm_provider": agent.provider.name,
        "mock_mode": agent.provider.is_mock,
    }


@app.get("/policy")
def policy():
    return get_policy()


@app.post("/agent/run", response_model=AgentResponse)
def run_agent(request: AgentRequest):
    try:
        return agent.run(request)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI Agent processing failed: {exc}",
        ) from exc


@app.get("/agent/analyze/{complaint_id}", response_model=AgentResponse)
def analyze_and_run_agent(complaint_id: str):
    """
    Fetch complaint intelligence from Student 2
    and send the analyzed complaint to Student 3.
    """

    try:
        response = httpx.get(
            f"{BACKEND_URL}/intelligence/analyze",
            timeout=30.0,
        )
        response.raise_for_status()
        intelligence = response.json()

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach Student 2 Intelligence Engine: {exc}",
        ) from exc

    analyzed_complaints = intelligence.get(
        "analyzed_complaints",
        [],
    )

    complaint = next(
        (
            item
            for item in analyzed_complaints
            if item.get("complaint_id") == complaint_id
        ),
        None,
    )

    if complaint is None:
        raise HTTPException(
            status_code=404,
            detail=f"Complaint {complaint_id} was not found in Student 2 intelligence output.",
        )

    request = AgentRequest(
        complaint_id=complaint["complaint_id"],
        clean_text=complaint["clean_text"],
        issue_type=complaint["issue_type"],
        sentiment=complaint.get("sentiment"),
        severity=complaint.get("severity"),
        cluster=complaint.get("cluster"),
        customer_id=complaint.get("customer_id"),
        order_id=complaint.get("order_id"),
    )

    try:
        return agent.run(request)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI Agent processing failed: {exc}",
        ) from exc