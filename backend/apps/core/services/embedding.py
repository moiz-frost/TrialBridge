import hashlib
import math
from typing import List

import requests
from django.conf import settings


def _normalized_hash_vector(text: str, dimensions: int) -> List[float]:
    tokens = text.lower().split()
    if not tokens:
        return [0.0] * dimensions

    vec = [0.0] * dimensions
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:2], "big") % dimensions
        sign = -1.0 if digest[2] % 2 else 1.0
        vec[idx] += sign

    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def generate_embedding(text: str) -> List[float]:
    dimensions = settings.HF_EMBEDDING_DIMENSIONS
    endpoint = settings.HF_EMBEDDING_ENDPOINT
    token = settings.HF_API_TOKEN

    if endpoint and token:
        try:
            response = requests.post(
                endpoint,
                headers={"Authorization": f"Bearer {token}"},
                json={"inputs": text},
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, list) and payload and isinstance(payload[0], (int, float)):
                vector = payload
            elif isinstance(payload, list) and payload and isinstance(payload[0], list):
                vector = payload[0]
            else:
                vector = _normalized_hash_vector(text, dimensions)
        except Exception:
            vector = _normalized_hash_vector(text, dimensions)
    else:
        vector = _normalized_hash_vector(text, dimensions)

    if len(vector) < dimensions:
        vector = vector + [0.0] * (dimensions - len(vector))
    return vector[:dimensions]
