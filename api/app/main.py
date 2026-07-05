from fastapi import FastAPI

from app.routers import analytics, auth, uploads

app = FastAPI(title="Sales Analytics API", version="1.0.0")

app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(analytics.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
