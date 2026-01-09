from fastapi import FastAPI

app = FastAPI(title="DS-ProSolution API", version="0.1.0")


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/version")
async def version():
    return {"version": "0.1.0"}
