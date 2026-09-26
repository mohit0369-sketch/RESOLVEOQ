"""End-to-end tests for the Student 2 pipeline (main.analyze_complaints).

Embedding-dependent tests are skipped (never silently passed) when the
Sentence-Transformers model is unavailable, so the suite stays honest in
offline CI environments.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from embeddings import EmbeddingError, create_embedding, create_embeddings, embedder_name, embedding_dim
from clustering import NOISE_LABEL, cluster_embeddings, clustering_backend, name_clusters
from main import (
    DEMO_COMPLAINTS,
    InvalidComplaintError,
    analyze_complaints,
    load_complaints,
    save_output,
    validate_complaints,
)

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "complaints.json"


def _embedding_available() -> bool:
    """True when a real embedding backend can be built in this environment."""
    try:
        create_embeddings(["probe text"])
        return True
    except EmbeddingError:
        return False


EMBEDDINGS_OK = _embedding_available()
needs_embeddings = pytest.mark.skipif(
    not EMBEDDINGS_OK,
    reason="No embedding backend available (sentence-transformers model could not be loaded); "
    "set EMBEDDING_BACKEND=hashing to exercise these tests offline.",
)


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------
def test_validate_rejects_none() -> None:
    with pytest.raises(InvalidComplaintError):
        validate_complaints(None)


def test_validate_rejects_a_bare_string() -> None:
    with pytest.raises(InvalidComplaintError):
        validate_complaints("not a list of complaints")


def test_validate_rejects_non_dict_entries() -> None:
    with pytest.raises(InvalidComplaintError):
        validate_complaints([{"text": "ok"}, "oops"])


def test_validate_accepts_a_single_dict() -> None:
    assert len(validate_complaints({"text": "hello"})) == 1


def test_validate_warns_on_missing_text() -> None:
    records = validate_complaints([{"complaint_id": "C1"}])
    assert "_validation_warnings" in records[0]


def test_validate_warns_on_null_text() -> None:
    records = validate_complaints([{"complaint_id": "C1", "text": None}])
    assert any("null" in w for w in records[0]["_validation_warnings"])


# --------------------------------------------------------------------------
# Embeddings
# --------------------------------------------------------------------------
@needs_embeddings
def test_create_embedding_returns_list_of_floats() -> None:
    vector = create_embedding("my package is broken")
    assert isinstance(vector, list)
    assert len(vector) == embedding_dim()
    assert all(isinstance(value, float) for value in vector)


@needs_embeddings
def test_create_embeddings_batch_shape_and_dtype() -> None:
    matrix = create_embeddings(["broken item", "late delivery", "refund please"])
    assert isinstance(matrix, np.ndarray)
    assert matrix.shape == (3, embedding_dim())
    assert matrix.dtype == np.float32


@needs_embeddings
def test_similar_texts_are_semantically_closer_than_unrelated() -> None:
    vectors = create_embeddings(
        [
            "My package is broken",
            "The product arrived damaged",
            "I cannot log into my account",
        ]
    )
    similar = float(np.dot(vectors[0], vectors[1]))
    unrelated = float(np.dot(vectors[0], vectors[2]))
    assert similar > unrelated


@needs_embeddings
def test_empty_batch_has_well_defined_shape() -> None:
    matrix = create_embeddings([])
    assert matrix.shape == (0, embedding_dim())


@needs_embeddings
def test_embedder_name_is_reported() -> None:
    assert embedder_name() in {"sentence-transformers", "hashing-bow"}


# --------------------------------------------------------------------------
# Clustering
# --------------------------------------------------------------------------
def test_cluster_embeddings_returns_labels_of_right_length() -> None:
    rng = np.random.default_rng(42)
    left = rng.normal(0, 0.05, size=(10, 8))
    right = rng.normal(1, 0.05, size=(10, 8))
    labels = cluster_embeddings(np.vstack([left, right]))
    assert len(labels) == 20
    assert labels.dtype.kind in {"i", "u"}
    assert clustering_backend() != "unknown"


def test_cluster_embeddings_handles_tiny_input() -> None:
    labels = cluster_embeddings(np.ones((2, 4), dtype=np.float64))
    assert len(labels) == 2


def test_cluster_embeddings_handles_empty_input() -> None:
    assert len(cluster_embeddings(np.zeros((0, 4), dtype=np.float64))) == 0


def test_separates_two_obvious_groups() -> None:
    rng = np.random.default_rng(7)
    group_a = rng.normal(0, 0.02, size=(12, 6))
    group_b = rng.normal(3, 0.02, size=(12, 6))
    labels = cluster_embeddings(np.vstack([group_a, group_b]))
    core = labels[labels != NOISE_LABEL]
    assert len(set(core.tolist())) >= 2


def test_name_clusters_uses_dominant_category() -> None:
    labels = [0, 0, 0, 1, 1]
    categories = ["Damaged Product"] * 3 + ["Refund"] * 2
    names = name_clusters(labels, categories)
    # Noise is always defined by the naming contract, in addition to real clusters.
    assert names[0] == "Damaged Products"
    assert names[1] == "Refund Problems"
    assert names[-1] == "Unclustered"


def test_name_clusters_defines_noise() -> None:
    names = name_clusters([-1, 0], ["Other", "Damaged Product"])
    assert names[-1] == "Unclustered"


def test_name_clusters_makes_duplicate_names_unique() -> None:
    labels = [0, 0, 1, 1]
    categories = ["Refund"] * 4
    names = name_clusters(labels, categories)
    assert names[0] != names[1]
    assert names[0] == "Refund Problems"
    assert names[1].startswith("Refund Problems")


def test_name_clusters_empty_input() -> None:
    assert name_clusters([], []) == {}


# --------------------------------------------------------------------------
# Full pipeline
# --------------------------------------------------------------------------
def test_pipeline_on_the_three_demo_complaints() -> None:
    result = analyze_complaints(DEMO_COMPLAINTS, include_embeddings=False)
    records = result["analyzed_complaints"]
    assert len(records) == 3

    first = records[0]
    assert first["clean_text"] == "my headphones arrived broken and i want my money back"
    assert first["issue_type"] in {"Damaged Product", "Refund"}
    assert first["sentiment"] == "Negative"
    assert first["severity"] == "High"
    assert isinstance(first["cluster"], str)

    assert set(result) == {
        "analyzed_complaints",
        "trends",
        "emerging_issues",
        "clusters",
        "metadata",
        "diagnostics",
    }


def test_pipeline_output_is_json_serialisable() -> None:
    result = analyze_complaints(DEMO_COMPLAINTS)
    dumped = json.dumps(result, allow_nan=False)
    assert json.loads(dumped)["metadata"]["processed_complaints"] == 3


def test_pipeline_handles_empty_input_without_raising() -> None:
    result = analyze_complaints([])
    assert result["analyzed_complaints"] == []
    assert result["trends"] == []
    assert result["emerging_issues"] == []
    assert result["metadata"]["total_complaints"] == 0


def test_pipeline_reports_missing_fields_instead_of_crashing() -> None:
    result = analyze_complaints([{"complaint_id": "C1"}, {"complaint_id": "C2", "text": None}])
    assert len(result["analyzed_complaints"]) == 2
    assert result["diagnostics"]["warnings"]
    assert all(record["issue_type"] == "Other" for record in result["analyzed_complaints"])


def test_pipeline_rejects_structurally_invalid_payload() -> None:
    with pytest.raises(InvalidComplaintError):
        analyze_complaints("just a string")


def test_pipeline_handles_invalid_dates_gracefully() -> None:
    result = analyze_complaints(
        [
            {"complaint_id": "C1", "text": "broken item", "created_at": "definitely-not-a-date"},
            {"complaint_id": "C2", "text": "late order", "created_at": "2026-09-10"},
        ]
    )
    assert len(result["analyzed_complaints"]) == 2


def test_pipeline_metadata_reports_backends() -> None:
    metadata = analyze_complaints(DEMO_COMPLAINTS, include_embeddings=False)["metadata"]
    assert metadata["sentiment_backend"] in {"vader", "fallback-lexicon"}
    assert metadata["processed_complaints"] == 3
    assert metadata["emerging_growth_threshold"] == 25.0


def test_fixture_has_enough_complaints_and_valid_shape() -> None:
    payload = load_complaints(str(DATA_FILE))
    assert isinstance(payload, list)
    assert 50 <= len(payload) <= 200
    required = {"complaint_id", "text", "customer_id", "order_id", "created_at"}
    for record in payload:
        assert required.issubset(record.keys())
        assert isinstance(record["text"], str) and record["text"]


@pytest.mark.skipif(not DATA_FILE.exists(), reason="data/complaints.json is not present")
@needs_embeddings
def test_full_dataset_runs_end_to_end() -> None:
    payload = load_complaints(str(DATA_FILE))
    result = analyze_complaints(payload)
    assert len(result["analyzed_complaints"]) == len(payload)
    assert result["trends"], "expected trend rows for a two-month dataset"
    json.dumps(result, allow_nan=False)
    assert all(len(record["embedding"]) == result["metadata"]["embedding_dim"] for record in result["analyzed_complaints"])


@pytest.mark.skipif(not DATA_FILE.exists(), reason="data/complaints.json is not present")
def test_dataset_saved_to_disk_round_trips(tmp_path: Path) -> None:
    payload = load_complaints(str(DATA_FILE))
    result = analyze_complaints(payload[:10], include_embeddings=False)
    destination = tmp_path / "out" / "intelligence.json"
    save_output(result, str(destination))
    reloaded = json.loads(destination.read_text(encoding="utf-8"))
    assert len(reloaded["analyzed_complaints"]) == 10


def test_load_complaints_reports_missing_file() -> None:
    with pytest.raises(FileNotFoundError):
        load_complaints("/tmp/does-not-exist-anywhere.json")


def test_load_complaints_rejects_malformed_json(tmp_path: Path) -> None:
    bad = tmp_path / "bad.json"
    bad.write_text("{not valid json", encoding="utf-8")
    with pytest.raises(ValueError):
        load_complaints(str(bad))


def test_load_complaints_rejects_non_list_json(tmp_path: Path) -> None:
    wrong = tmp_path / "wrong.json"
    wrong.write_text('{"text": "hello"}', encoding="utf-8")
    with pytest.raises(ValueError):
        load_complaints(str(wrong))
