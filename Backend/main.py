import logging
from fastapi import FastAPI

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backend")

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    logger.info("Starting FastAPI app")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down FastAPI app")

@app.get("/")
def root():
    logger.info("Handled GET /")
    return {"message": "API is running"}
