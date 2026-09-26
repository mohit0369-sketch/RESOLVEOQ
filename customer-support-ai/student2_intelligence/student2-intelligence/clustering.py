"""Semantic clustering and cluster naming for the Student 2 Intelligence Engine.

Algorithm choice
----------------
HDBSCAN is the primary algorithm because the number of complaint themes is not
known in advance and real complaint data always contains outliers ("noise") that
must not be forced into a cluster.

Fallback chain (attempted in order, each failure is logged):

1. the standalone ``hdbscan`` package,
2. ``sklearn.cluster.HDBSCAN`` (scikit-learn >= 1.3 ships an equivalent),
3. ``sklearn.cluster.AgglomerativeClustering`` with cosine distance — always
   available, so :func:`cluster_embeddings` never hard-fails.

Noise (label ``-1``) is represented safely as :data:`NOISE_NAME`, never as a
crash or as "Cluster 0".

Naming
------
Cluster ids are meaningless to users, so :func:`name_clusters` names each cluster
after its **dominant complaint category**, using the fixed, auditable mapping in
:data:`CLUSTER_DISPLAY_NAMES`. Names are never assigned randomly; deterministic
tie-breaking follows :data:`classification.CATEGORY_PRIORITY`, and duplicate names
get a numeric suffix.
"""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np

from classification import CATEGORY_PRIORITY, DEFAULT_ISSUE_TYPE

__all__ = [
    "NOISE_LABEL",
    "NOISE_NAME",
    "CLUSTER_DISPLAY_NAMES",
    "cluster_embeddings",
    "describe_clusters",
    "name_clusters",
    "clustering_backend",
]

logger = logging.getLogger(__name__)

#: HDBSCAN's conventional label for unclustered / outlier points.
NOISE_LABEL = -1

#: User-facing name for noise points.
NOISE_NAME = "Unclustered"

#: Deterministic category -> user-facing cluster name mapping (contract-safe).
CLUSTER_DISPLAY_NAMES: Dict[str, str] = {
    "Damaged Product": "Damaged Products",
    "Late Delivery": "Late Delivery",
    "Refund": "Refund Problems",
    "Payment Problem": "Payment Problems",
    "Wrong Product": "Wrong Products",
    "Missing Product": "Missing Products",
    "Account Problem": "Account Problems",
    DEFAULT_ISSUE_TYPE: "General Inquiries",
}

_PRIORITY_INDEX = {c: i for i, c in enumerate(CATEGORY_PRIORITY)}
_CLUSTER_SEED = 42

# Records which strategy actually produced the last result, for diagnostics.
_LAST_BACKEND: str = "unknown"


def clustering_backend() -> str:
    """Return the name of the clustering strategy used most recently."""
    return _LAST_BACKEND


def _normalise_rows(embeddings: np.ndarray) -> np.ndarray:
    """L2-normalise rows so cosine and euclidean distance agree."""
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return embeddings / norms


def _try_hdbscan(X: np.ndarray, min_cluster_size: int, min_samples: int) -> Optional[np.ndarray]:
    """Run HDBSCAN via the standalone package or scikit-learn. ``None`` on failure."""
    hdbscan_cls = None
    try:  # preferred: standalone hdbscan
        import hdbscan as _hdbscan  # type: ignore

        hdbscan_cls = _hdbscan.HDBSCAN
        source = "hdbscan"
    except Exception:
        try:  # fallback: scikit-learn >= 1.3
            from sklearn.cluster import HDBSCAN as _SkHDBSCAN  # type: ignore

            hdbscan_cls = _SkHDBSCAN
            source = "sklearn-hdbscan"
        except Exception as exc:
            logger.info("HDBSCAN is not available (%s); will use the clustering fallback.", exc)
            return None

    try:
        model = hdbscan_cls(
            min_cluster_size=max(2, int(min_cluster_size)),
            min_samples=max(1, int(min_samples)),
            metric="euclidean",
        )
        labels = np.asarray(model.fit_predict(X), dtype=int)
    except Exception as exc:
        logger.warning("HDBSCAN (%s) failed: %s", source, exc)
        return None

    global _LAST_BACKEND
    _LAST_BACKEND = source
    return labels


def _agglomerative_fallback(X: np.ndarray) -> np.ndarray:
    """Deterministic fallback: AgglomerativeClustering with cosine distance."""
    from sklearn.cluster import AgglomerativeClustering

    n_samples = X.shape[0]
    n_clusters = int(round((n_samples / 2) ** 0.5))
    n_clusters = max(2, min(n_clusters, max(2, n_samples // 2)))
    if n_clusters >= n_samples:
        n_clusters = max(1, n_samples - 1)

    global _LAST_BACKEND
    try:
        labels = AgglomerativeClustering(
            n_clusters=n_clusters, metric="cosine", linkage="average"
        ).fit_predict(X)
        _LAST_BACKEND = "agglomerative"
        return np.asarray(labels, dtype=int)
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Agglomerative clustering failed (%s); placing all points in one cluster.", exc)
        _LAST_BACKEND = "single-cluster"
        return np.zeros(n_samples, dtype=int)


def cluster_embeddings(
    embeddings: np.ndarray,
    min_cluster_size: int = 3,
    min_samples: int = 1,
) -> np.ndarray:
    """Cluster complaint embeddings and return integer labels.

    Args:
        embeddings: ``(n_samples, dim)`` array (list-like accepted).
        min_cluster_size: HDBSCAN minimum cluster size (default 3, tuned for a
            50-100 complaint hackathon dataset).
        min_samples: HDBSCAN ``min_samples`` (1 keeps single-linkage behaviour,
            which works well for short complaints).

    Returns:
        ``np.ndarray`` of length ``n_samples`` with integer labels. ``-1`` means
        noise/outlier. Small inputs (< 3 items) are returned as one cluster so
        that downstream code always has a usable label.
    """
    X = np.asarray(embeddings, dtype=np.float64)
    if X.ndim != 2:
        logger.warning("cluster_embeddings received a non-2D array of shape %s; returning no labels.", X.shape)
        return np.zeros(0, dtype=int)

    n_samples = X.shape[0]
    if n_samples == 0:
        return np.zeros(0, dtype=int)
    if n_samples < 3:
        global _LAST_BACKEND
        _LAST_BACKEND = "too-few-samples"
        return np.zeros(n_samples, dtype=int)

    X_norm = _normalise_rows(X)
    labels = _try_hdbscan(X_norm, min_cluster_size, min_samples)

    if labels is None:
        return _agglomerative_fallback(X_norm)

    distinct = set(labels.tolist())
    non_noise = {label for label in distinct if label != NOISE_LABEL}
    if len(non_noise) == 0:
        logger.warning(
            "HDBSCAN labelled all %d complaints as noise; using the agglomerative fallback.", n_samples
        )
        return _agglomerative_fallback(X_norm)

    return labels


def name_clusters(
    labels: Sequence[int],
    categories: Sequence[str],
) -> Dict[int, str]:
    """Turn numeric cluster ids into meaningful, deterministic names.

    Naming rule: a cluster is named after its **dominant complaint category**
    (majority vote), mapped through :data:`CLUSTER_DISPLAY_NAMES`. Ties are broken
    by :data:`classification.CATEGORY_PRIORITY`. Two different clusters that share
    a dominant category get a ``(2)``, ``(3)``... suffix so the names stay unique.

    Args:
        labels: Cluster labels aligned with ``categories`` (``-1`` = noise).
        categories: The classified ``issue_type`` of each complaint.

    Returns:
        Mapping ``cluster_id -> cluster_name``. Noise is always
        :data:`NOISE_NAME`. ``{}`` for empty input.

    Examples:
        >>> name_clusters([0, 0, 0, 1], ["Damaged Product"] * 3 + ["Refund"])
        {0: 'Damaged Products', 1: 'Refund Problems'}
    """
    label_list = list(labels)
    category_list = list(categories)
    if not label_list:
        return {}

    buckets: Dict[int, Counter] = defaultdict(Counter)
    for label, category in zip(label_list, category_list):
        label_int = int(label)
        if label_int == NOISE_LABEL:
            continue
        buckets[label_int][category or DEFAULT_ISSUE_TYPE] += 1

    names: Dict[int, str] = {NOISE_LABEL: NOISE_NAME}
    used_names: Counter = Counter()

    for cluster_id in sorted(buckets):
        counter = buckets[cluster_id]
        best_category = max(
            counter.items(),
            key=lambda item: (item[1], -_PRIORITY_INDEX.get(item[0], len(_PRIORITY_INDEX))),
        )[0]
        base_name = CLUSTER_DISPLAY_NAMES.get(best_category, best_category)
        used_names[base_name] += 1
        suffix = "" if used_names[base_name] == 1 else f" ({used_names[base_name]})"
        names[cluster_id] = f"{base_name}{suffix}"

    return names


def describe_clusters(
    labels: Sequence[int],
    names: Dict[int, str],
) -> List[Dict[str, Any]]:
    """Summarise clusters for logging, the demo output and Student 4 tooltips.

    Args:
        labels: Cluster labels aligned with the analyzed complaints.
        names: Mapping produced by :func:`name_clusters`.

    Returns:
        List of ``{"cluster_id", "cluster_name", "size"}`` dicts, largest first.
    """
    sizes: Counter = Counter(int(label) for label in labels)
    described: List[Dict[str, Any]] = [
        {
            "cluster_id": cluster_id,
            "cluster_name": names.get(cluster_id, NOISE_NAME if cluster_id == NOISE_LABEL else f"Cluster {cluster_id}"),
            "size": size,
        }
        for cluster_id, size in sizes.items()
    ]
    described.sort(key=lambda item: (-item["size"], item["cluster_id"]))
    return described


def label_names_for_records(
    labels: Sequence[int], names: Dict[int, str]
) -> List[str]:
    """Map every label to its name, used when building the output records."""
    return [names.get(int(label), NOISE_NAME) for label in labels]
