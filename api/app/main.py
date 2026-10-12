"""Aplicacion FastAPI de BOLSA (backend del MEM)."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes import router
from .config import get_settings
from .container import Container
from .errors import DataSourceError, ModelError


def create_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    settings = get_settings()

    app = FastAPI(title="BOLSA API", version="0.1.0", description="Backend del mercado mayorista (MEM) en miniatura.")
    app.state.container = Container(settings)

    origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()] or ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    @app.exception_handler(ModelError)
    async def _model_error(_: Request, exc: ModelError) -> JSONResponse:
        return JSONResponse(status_code=502, content={"error": exc.message, "code": exc.code})

    @app.exception_handler(DataSourceError)
    async def _data_error(_: Request, exc: DataSourceError) -> JSONResponse:
        return JSONResponse(status_code=502, content={"error": str(exc), "code": "datasource-error"})

    return app


app = create_app()
