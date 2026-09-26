"""Sentence embeddings for the Student 2 Intelligence Engine.

The embedding model is the *only* place in the project where a vectoriser lives.
Every other module (clustering, trends, main) talks to this module's functions
and never to a model object, so the backend can be swapped in one place.

Backend selection (highest priority first):

1. ``EMBEDDING_BACKEND=sentence-transformers`` (or a direct ``backend=`` argument)
   -> force ``sentence-transformers`` with ``all-MiniLM-L6-v2`` (384 dims).
2. ``auto`` (default) -> try ``sentence-transformers``; if the package or the
   model weights cannot be loaded (offline CI, no cache), log a WARNING and fall
   back to the deterministic hashing embedder so the pipeline still runs.
3. ``hashing`` -> force the deterministic fallback (fast, offline, no downloads).

The model is loaded once and cached process-wide (thread-safe), and always used
in batch mode, so a 100-complaint dataset triggers a single model call.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import threading
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

__all__ = [
    "EmbeddingError",
    "DEFAULT_MODEL_NAME",
    "create_embedding",
    "create_embeddings",
    "embedding_dim",
    "embedder_name",
    "get_embedder",
    "reset_embedder",
]

logger = logging.getLogger(__name__)

DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"
HASHING_DIM = 256
ENV_BACKEND_VAR = "EMBEDDING_BACKEND"
ENV_MODEL_VAR = "EMBEDDING_MODEL"

_TOKEN_RE = re.compile(r"[a-z0-9']+")


class EmbeddingError(RuntimeError):
    """Raised when no embedding backend can be created or encoding fails."""


class _HashingEmbedder:
    """Deterministic, dependency-free fallback embedder.

    Tokens and bigrams are hashed into a fixed-dimension vector with a stable
    (MD5-based) hash — stable across processes and machines, unlike Python's
    built-in ``hash()``. Vectors are L2-normalised, so cosine similarity behaves
    the same way as with the transformer backend: texts that share vocabulary
    (e.g. all "waiting for my order" complaints) end up close together.
    """

    name = "hashing-bow"

    def __init__(self, dim: int = HASHING_DIM) -> None:
        self.dim = int(dim)

    def _index(self, token: str) -> int:
        digest = hashlib.md5(token.encode("utf-8")).hexdigest()
        return int(digest[:8], 16) % self.dim

    def encode(self, texts: Sequence[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for row, text in enumerate(texts):
            tokens = _TOKEN_RE.findall((text or "").lower())
            if not tokens:
                continue
            for token in tokens:
                out[row, self._index(token)] += 1.0
            for first, second in zip(tokens, tokens[1:]):
                out[row, self._index(f"{first}_{second}")] += 0.5
            norm = float(np.linalg.norm(out[row]))
            if norm > 0:
                out[row] /= norm
        return out


class _SentenceTransformerEmbedder:
    """Thin wrapper around ``sentence_transformers.SentenceTransformer``."""

    name = "sentence-transformers"

    def __init__(self, model_name: str = DEFAULT_MODEL_NAME) -> None:
        from sentence_transformers import SentenceTransformer  # local import: optional dependency

        self.model_name = model_name
        self._model = SentenceTransformer(model_name)
        # `get_sentence_embedding_dimension` was renamed upstream; support both.
        getter = getattr(self._model, "get_embedding_dimension", None) or self._model.get_sentence_embedding_dimension
        self.dim = int(getter())

    def encode(self, texts: Sequence[str]) -> np.ndarray:
        vectors = self._model.encode(
            list(texts),
            batch_size=32,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return np.asarray(vectors, dtype=np.float32)


_EMBEDDER: Optional[Any] = None
_EMBEDDER_KEY: Optional[tuple[str, str]] = None
_LOCK = threading.Lock()


def _resolve_backend(backend: Optional[str]) -> str:
    requested = (backend or os.getenv(ENV_BACKEND_VAR, "auto")).strip().lower()
    aliases: Dict[str, str] = {
        "": "auto",
        "auto": "auto",
        "sentence-transformers": "sentence-transformers",
        "sentence_transformers": "sentence-transformers",
        "st": "sentence-transformers",
        "hashing": "hashing",
        "hash": "hashing",
        "hashing-bow": "hashing",
    }
    if requested not in aliases:
        logger.warning("Unknown embedding backend %r; falling back to 'auto'.", requested)
        return "auto"
    return aliases[requested]


def get_embedder(
    backend: Optional[str] = None,
    model_name: Optional[str] = None,
) -> Any:
    """Return the cached embedder, loading the model at most once per backend.

    Args:
        backend: ``"auto"`` (default), ``"sentence-transformers"`` or ``"hashing"``.
            Falls back to the ``EMBEDDING_BACKEND`` environment variable.
        model_name: Sentence-Transformers model id. Defaults to
            ``EMBEDDING_MODEL`` env var or :data:`DEFAULT_MODEL_NAME`.

    Returns:
        An object exposing ``name``, ``dim`` and ``encode(texts) -> np.ndarray``.

    Raises:
        EmbeddingError: If a backend was explicitly requested and cannot be built.
    """
    resolved = _resolve_backend(backend)
    resolved_model = model_name or os.getenv(ENV_MODEL_VAR, DEFAULT_MODEL_NAME)
    key = (resolved, resolved_model)

    global _EMBEDDER, _EMBEDDER_KEY
    if _EMBEDDER is not None and _EMBEDDER_KEY == key:
        return _EMBEDDER

    with _LOCK:
        if _EMBEDDER is not None and _EMBEDDER_KEY == key:
            return _EMBEDDER

        if resolved == "hashing":
            embedder: Any = _HashingEmbedder()
            logger.info("Embedding backend forced to '%s' (dim=%d).", embedder.name, embedder.dim)
        else:
            try:
                embedder = _SentenceTransformerEmbedder(resolved_model)
                logger.info(
                    "Loaded Sentence-Transformers model '%s' (dim=%d).",
                    resolved_model, embedder.dim,
                )
            except Exception as exc:
                if resolved == "sentence-transformers":
                    raise EmbeddingError(
                        f"Could not load Sentence-Transformers model '{resolved_model}': {exc}. "
                        "Install 'sentence-transformers', pre-download the model, or set "
                        f"{ENV_BACKEND_VAR}=hashing to use the offline fallback backend."
                    ) from exc
                logger.warning(
                    "Sentence-Transformers unavailable (%s). Falling back to the deterministic "
                    "hashing backend — semantic quality is reduced but the pipeline still runs.", exc,
                )
                embedder = _HashingEmbedder()

        _EMBEDDER = embedder
        _EMBEDDER_KEY = key
        return _EMBEDDER


def reset_embedder() -> None:
    """Drop the cached embedder (used by tests and long-running workers)."""
    global _EMBEDDER, _EMBEDDER_KEY
    with _LOCK:
        _EMBEDDER = None
        _EMBEDDER_KEY = None


def embedder_name(backend: Optional[str] = None) -> str:
    """Return the name of the embedding backend currently in use."""
    return str(get_embedder(backend).name)


def embedding_dim(backend: Optional[str] = None) -> int:
    """Return the embedding vector size for the active backend."""
    return int(get_embedder(backend).dim)


def create_embeddings(
    texts: Sequence[Any],
    backend: Optional[str] = None,
    model_name: Optional[str] = None,
) -> np.ndarray:
    """Batch-encode complaint texts into a ``(n_texts, dim)`` float32 matrix.

    Args:
        texts: Iterable of complaint strings. ``None`` entries are treated as ``""``.
        backend: Optional explicit backend override (see :func:`get_embedder`).
        model_name: Optional Sentence-Transformers model override.

    Returns:
        ``np.ndarray`` of shape ``(len(texts), embedding_dim())``, dtype float32,
        rows L2-normalised.

    Raises:
        EmbeddingError: If the backend cannot be built or encoding fails, or if
            the backend returns a malformed array.
    """
    text_list: List[str] = [t if isinstance(t, str) else ("" if t is None else str(t)) for t in texts]

    if not text_list:
        # Shape must still be well defined for downstream code.
        try:
            dim = embedding_dim(backend)
        except EmbeddingError:
            dim = HASHING_DIM
        return np.zeros((0, dim), dtype=np.float32)

    embedder = get_embedder(backend, model_name)
    try:
        vectors = embedder.encode(text_list)
    except Exception as exc:
        raise EmbeddingError(f"Embedding generation failed: {exc}") from exc

    array = np.asarray(vectors, dtype=np.float32)
    if array.ndim != 2 or array.shape[0] != len(text_list):
        raise EmbeddingError(
            f"Embedding backend '{embedder.name}' returned an unexpected shape {array.shape}; "
            f"expected ({len(text_list)}, dim)."
        )
    return array


def create_embedding(text: Any, backend: Optional[str] = None) -> List[float]:
    """Encode a single complaint text and return a JSON-friendly list of floats.

    Args:
        text: Complaint text (``None`` -> empty string).
        backend: Optional explicit backend override.

    Returns:
        A list of Python floats of length :func:`embedding_dim`.

    Examples:
        >>> vec = create_embedding("my package is broken")
        >>> len(vec) > 0
        True
    """
    return [float(value) for value in create_embeddings([text], backend=backend)[0]]
