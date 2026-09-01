"""
Module 3: Vector Store (FAISS Index)
======================================

WHAT THIS MODULE DOES
-----------------------
Stores a large collection of embedding vectors (from Module 2) in a
structure that can very quickly answer: "which of these stored vectors
are closest to this new query vector?"

WHY WE NEED IT
---------------
Without FAISS, finding the top-5 most similar records means computing
the similarity between your query and EVERY historical record, one by
one, in a loop. That's fine for 922 rows, but FAISS is built to do this
efficiently even at millions of rows, using optimized C++ under the
hood. We use it here mainly for correctness and habit -- so the same
code scales if your dataset grows.

WHAT GOES IN
------------
A numpy array of embeddings, shape (num_records, 384) -- the output of
Module 2's embed_texts().

WHAT COMES OUT
--------------
- A FAISS index object (used for searching)
- Given a query vector: the top-k most similar record POSITIONS
  (integers) and their similarity scores.

CRITICAL DETAIL: FAISS only stores vectors -- it has NO idea what a
"record" or "symptom" is. It returns plain integer positions (0, 1, 2,
...) corresponding to the ORDER you added vectors in. It is YOUR
responsibility to keep a separate mapping from position -> actual record
(equipment_id, symptom, root_cause, etc). This module handles that
mapping by requiring the source DataFrame to have a clean 0-based index
(via .reset_index(drop=True)) that lines up exactly with embedding order.

HOW IT CONNECTS
-----------------
    Module 2 (embeddings)  ---> [THIS MODULE: build_index()]  ---> stored index
    New query embedding     ---> [THIS MODULE: search()]       ---> top-k positions + scores
                                                                 ---> Module 4 (Retriever) looks up
                                                                      those positions in the original
                                                                      DataFrame to get full records

SETUP NOTE: requires `pip install faiss-cpu --break-system-packages`
in an environment with internet access.
"""

import faiss
import numpy as np


def build_index(embeddings: np.ndarray) -> faiss.Index:
    """
    Build a FAISS index from a matrix of embeddings.

    We use IndexFlatIP ("Flat" = brute-force exact search, no
    approximation; "IP" = Inner Product). Because our embeddings are
    L2-normalized (done in Module 2), inner product between any two
    vectors IS their cosine similarity -- so this index effectively
    performs exact cosine-similarity search.

    "Flat"/exact (rather than an approximate index type) is the right
    choice here because your dataset (922 incidents + 29 guide chunks)
    is small. Approximate indices only start to matter at 100k+ vectors,
    trading a little accuracy for a lot of speed -- not a trade-off you
    need to make yet.
    """
    num_dimensions = embeddings.shape[1]
    index = faiss.IndexFlatIP(num_dimensions)
    index.add(embeddings)
    return index


def search(index: faiss.Index, query_vector: np.ndarray, k: int = 5):
    """
    Find the top-k most similar vectors in the index to one query vector.

    Returns:
        scores: numpy array of shape (k,) -- cosine similarity scores,
                highest first (since embeddings are normalized, these
                range from -1 to 1; in practice symptom text similarities
                usually land between 0 and 1).
        positions: numpy array of shape (k,) -- the integer positions
                   of the matching vectors, in the SAME order they were
                   added in build_index(). Use these positions to look
                   up the actual record in your original DataFrame,
                   e.g. `incidents_df.iloc[positions[0]]`.
    """
    # FAISS expects a 2D array (batch of queries), even for a single query.
    query_vector_2d = query_vector.reshape(1, -1).astype("float32")

    scores, positions = index.search(query_vector_2d, k)

    # Both come back as 2D arrays (one row per query); we only sent one
    # query, so we return just that first row.
    return scores[0], positions[0]


def save_index(index: faiss.Index, file_path: str) -> None:
    """
    Save a built index to disk, so you don't have to re-embed and
    rebuild it every time you run the program.
    """
    faiss.write_index(index, file_path)


def load_index(file_path: str) -> faiss.Index:
    """Load a previously saved index from disk."""
    return faiss.read_index(file_path)
