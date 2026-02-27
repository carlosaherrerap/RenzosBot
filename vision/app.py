from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import base64
import os
import requests
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import tensorflow as tf

app = FastAPI()
BACKEND = os.environ.get("BACKEND_URL", "http://localhost:3001")
products = []
names = []
ids = []
vectorizer = TfidfVectorizer()
matrix = None
image_ids = []
image_names = []
image_vecs = None
feature_model = None

def get_feature_model():
    global feature_model
    if feature_model is None:
        base = tf.keras.applications.MobileNetV2(include_top=False, pooling="avg", input_shape=(224,224,3))
        feature_model = base
    return feature_model

def embed_image(b64: str):
    raw = base64.b64decode(b64)
    arr = tf.io.decode_image(raw, channels=3, expand_animations=False)
    img = tf.image.resize(arr, (224,224))
    img = tf.cast(img, tf.float32) / 255.0
    img = tf.expand_dims(img, 0)
    model = get_feature_model()
    vec = model(img).numpy().astype(np.float32)[0]
    n = np.linalg.norm(vec) + 1e-8
    return vec / n

def refresh_index():
    global products, names, ids, matrix, vectorizer
    try:
        r = requests.get(f"{BACKEND}/products", timeout=5)
        products = r.json()
        names = [p["name"] for p in products]
        ids = [p["id"] for p in products] if products and "id" in products[0] else [str(i) for i in range(len(products))]
        if names:
            matrix = vectorizer.fit_transform(names)
        else:
            matrix = None
    except:
        products, names, ids, matrix = [], [], [], None

refresh_index()

class SimilarRequest(BaseModel):
    query: str
    top_k: int = 4

class Item(BaseModel):
    id: str
    name: str
    score: float

class SimilarResponse(BaseModel):
    items: List[Item]

class SimilarImageRequest(BaseModel):
    image_base64: str
    top_k: int = 4

class IndexImageItem(BaseModel):
    id: str
    name: str
    image_base64: str

class IndexImageRequest(BaseModel):
    items: List[IndexImageItem]

@app.post("/index-images")
def index_images(req: IndexImageRequest):
    global image_ids, image_names, image_vecs
    image_ids = []
    image_names = []
    vecs = []
    for it in req.items:
        v = embed_image(it.image_base64)
        image_ids.append(it.id)
        image_names.append(it.name)
        vecs.append(v)
    image_vecs = np.stack(vecs) if vecs else None
    return {"count": len(image_ids)}

@app.post("/index-images-from-backend")
def index_images_from_backend():
    global image_ids, image_names, image_vecs
    try:
        r = requests.get(f"{BACKEND}/products", timeout=5)
        prods = r.json()
    except:
        return {"count": 0}
    image_ids = []
    image_names = []
    vecs = []
    for p in prods:
        url = p.get("imageUrl")
        if not url:
            continue
        try:
            img = requests.get(url, timeout=5).content
            b64 = base64.b64encode(img).decode("ascii")
            v = embed_image(b64)
            image_ids.append(p.get("id", p.get("name", "unknown")))
            image_names.append(p.get("name", ""))
            vecs.append(v)
        except:
            continue
    image_vecs = np.stack(vecs) if vecs else None
    return {"count": len(image_ids)}

@app.post("/similar-image", response_model=SimilarResponse)
def similar_image(req: SimilarImageRequest):
    if image_vecs is None or len(image_ids) == 0:
        return {"items": []}
    q = embed_image(req.image_base64)
    sims = (image_vecs @ q)
    idxs = np.argsort(sims)[::-1][: req.top_k]
    out = []
    for i in idxs:
        out.append({"id": image_ids[i], "name": image_names[i], "score": float(sims[i])})
    return {"items": out}

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/refresh")
def refresh():
    refresh_index()
    return {"count": len(names)}

@app.post("/similar", response_model=SimilarResponse)
def similar(req: SimilarRequest):
    if not matrix or not names:
        refresh_index()
    if not matrix or not names:
        return {"items": []}
    qv = vectorizer.transform([req.query])
    sims = cosine_similarity(qv, matrix)[0]
    idxs = sims.argsort()[::-1][: req.top_k]
    out = []
    for i in idxs:
        out.append({"id": ids[i], "name": names[i], "score": float(sims[i])})
    return {"items": out}
