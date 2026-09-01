"""
Module 2: Embedding Generator
===============================

WHAT THIS MODULE DOES
----------------------
Converts text (symptom descriptions, guide fault titles) into numeric
vectors ("embeddings") using a pretrained sentence-embedding model. Texts
with similar MEANING produce vectors that are close together in space --
even if they share zero exact words (e.g. "pressure keeps spiking" and
"airway pressure above expected range" would embed close together).

WHY WE NEED IT
--------------
Simple keyword/substring matching (like `.str.contains()`, or even TF-IDF
word-counting) only catches literal word overlap. Real-world symptom
reports are inconsistent -- different staff describe the same fault
differently. Embeddings let us search by MEANING, which is the whole
foundation of the "semantic similarity search" in your requirements.

WHAT GOES IN
------------
A string, or a list of strings (retrieval_text values from
data_loader.py or guide_loader.py).

WHAT COMES OUT
--------------
A numpy array of shape (num_texts, 384) -- each row is one text's
embedding vector. 384 is a property of this specific model
(all-MiniLM-L6-v2); different models produce different-length vectors.

Vectors are L2-NORMALIZED before being returned. This is deliberate --
see the note in `embed_texts()` for why.

HOW IT CONNECTS
-----------------
    data_loader.py    ---> retrieval_text column ---\
    guide_loader.py   ---> retrieval_text column ---->--- [THIS MODULE] ---> Module 3 (FAISS index)
    new user query    ---> build_query_retrieval_text() -/

IMPORTANT SETUP NOTE
----------------------
This module requires packages that need real internet access to install
and to download the model weights the first time:
    pip install sentence-transformers --break-system-packages

Run this in your own environment (local machine / Google Colab), not in
a fully offline sandbox.
"""

from sentence_transformers import SentenceTransformer
import numpy as np


# Loading the model is slow (downloads ~90MB the first time, then loads
# it into memory every time). We load it ONCE per program run and reuse
# it, instead of reloading inside every function call.
_MODEL_NAME = "all-MiniLM-L6-v2"
_model = None


def get_model() -> SentenceTransformer:
    """
    Load the embedding model once, and reuse it on every subsequent call.

    This pattern (a module-level variable that starts as None, gets set
    once) is a simple form of caching -- it avoids the several-second
    cost of reloading the model every time you want to embed something.
    """
    global _model
    if _model is None:
        _model = SentenceTransformer(_MODEL_NAME)
    return _model


def embed_texts(texts: list[str]) -> np.ndarray:
    """
    Convert a list of strings into their embedding vectors.

    Returns a numpy array of shape (len(texts), 384).

    WHY NORMALIZE THE VECTORS?
    Cosine similarity measures the ANGLE between two vectors, ignoring
    their length/magnitude. FAISS's fastest index type (IndexFlatIP)
    computes raw dot products, which are NOT the same as cosine similarity
    UNLESS every vector has length 1 (i.e. is "normalized"). By
    normalizing here, once, at the source, every dot product computed
    later in Module 3 automatically equals a cosine similarity score --
    no extra math needed at search time, and no risk of forgetting to
    normalize in one place but not another.
    """
    model = get_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return np.array(embeddings, dtype="float32")
    # dtype float32 (not the numpy default float64) because FAISS
    # requires float32 arrays specifically.


def embed_single_text(text: str) -> np.ndarray:
    """
    Convenience wrapper for embedding exactly one string (e.g. a new
    incoming query at diagnosis time), returned as a 1D array of length
    384 rather than a (1, 384) 2D array -- slightly easier to work with
    when you're not batch-processing a whole DataFrame.
    """
    return embed_texts([text])[0]
