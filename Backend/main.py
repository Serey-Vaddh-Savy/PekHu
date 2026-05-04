import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# load .env FIRST
load_dotenv()

# import your controller
from app.controller.deepseek_controller import router as deepseek_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backend")

app = FastAPI()

# CORS - allow frontend during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

app.include_router(deepseek_router)
