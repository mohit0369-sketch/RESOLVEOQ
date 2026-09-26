# Student 1 — Backend + Database

FastAPI backend that stores customers, orders, and complaints, and exposes
the APIs the rest of the team (Students 2–4) build on top of.

## Quick start (SQLite, zero setup)

```bash
pip install -r requirements.txt
python seed_data.py          # creates tables + fake data
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000 — you should see `{"message": "Backend is working"}`.

Interactive API docs: http://127.0.0.1:8000/docs

## Switching to real PostgreSQL

1. Create a database, e.g. `support_ai`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Install `pgvector` extension in Postgres if you want real vector search later
   (the `embeddings` table is a placeholder until then).
4. Run the same commands above — SQLAlchemy will connect to Postgres instead.

## API summary

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/customers` | list customers |
| GET | `/customers/{customer_id}` | get one customer |
| POST | `/customers` | create a customer |
| GET | `/orders` | list orders (optional `?customer_id=`) |
| GET | `/orders/{order_id}` | get one order |
| POST | `/orders` | create an order |
| GET | `/complaints` | list complaints (optional `?status=`) — **used by Student 2** |
| GET | `/complaints/{complaint_id}` | get one complaint |
| POST | `/complaints` | create a complaint — **used by Student 4's frontend** |
| PUT | `/complaints/{complaint_id}` | update complaint status |

## Shared contract

`contracts/data_formats.json` defines the exact field names for
`order_id`, `status`, `amount`, `item`, etc. Students 3 and 4 depend on
these field names staying stable — don't rename them without telling
the team.

## What's still a placeholder

- `cases`, `resolutions`, `knowledge_docs`, and `embeddings` tables exist
  in the schema (`app/models.py`) but don't have routes yet — add them
  when Student 3's agent needs to write case/resolution data.
- `Embedding.vector` is stored as text for now; swap to `pgvector`'s
  `Vector` type once you're on real Postgres with the extension enabled.
