from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models
from database import Base, engine
from routes_citizen_report import router as citizen_report_router
from routes_dashboard import router as dashboard_router
from routes_test import router as test_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(citizen_report_router)
app.include_router(dashboard_router)
app.include_router(test_router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def read_root():
    return {"status": "ok"}
