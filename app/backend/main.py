import importlib
import logging
import os
import pkgutil
import traceback
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse


def _bootstrap_dotenv() -> None:
    """Load app/backend/.env then app/.env so local OPENAI_API_KEY works (systemd env still wins if already set)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    here = Path(__file__).resolve().parent
    for path in (here / ".env", here.parent / ".env"):
        if path.is_file():
            load_dotenv(path, override=False)


_bootstrap_dotenv()

from core.config import settings
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter

# MODULE_IMPORTS_START
from services.database import initialize_database, close_database
from services.platform_dev_campaign import ensure_platform_dev_campaign
from services.auth import initialize_admin_user
# MODULE_IMPORTS_END


def _parse_csv_env(name: str) -> list[str]:
    raw = os.environ.get(name, "")
    return [item.strip() for item in raw.split(",") if item.strip()]


def _infer_dolli_cors_channel() -> str:
    """staging | prod | dev — used only to fill CORS when env leaves allow_origins empty."""
    explicit = (os.environ.get("DOLLI_CORS_CHANNEL") or os.environ.get("DEPLOY_CHANNEL") or "").lower()
    if explicit in ("staging", "stage", "stg"):
        return "staging"
    if explicit in ("prod", "production", "live"):
        return "prod"

    env = (os.environ.get("ENVIRONMENT") or os.environ.get("APP_ENV") or "").lower()
    if "stag" in env:
        return "staging"
    if env in ("prod", "production", "live"):
        return "prod"

    for key in ("FRONTEND_URL", "VITE_FRONTEND_URL", "BACKEND_PUBLIC_URL", "PYTHON_BACKEND_URL"):
        val = (os.environ.get(key) or "").lower()
        if "staging.dolli" in val or "api-staging" in val:
            return "staging"
        if "api.dolli.space" in val and "staging" not in val:
            return "prod"

    return "dev"


def _dolli_cors_fallback_origins(channel: str) -> list[str]:
    """Per-channel defaults so staging API does not accept prod Origin and vice versa."""
    if channel == "staging":
        # Include http:// so login works if the SPA is opened without TLS (nginx should redirect to https).
        return ["https://staging.dolli.space", "http://staging.dolli.space"]
    if channel == "prod":
        return [
            "https://dolli.space",
            "https://www.dolli.space",
            "http://dolli.space",
            "http://www.dolli.space",
        ]
    return [
        "https://dolli.space",
        "https://www.dolli.space",
        "https://staging.dolli.space",
    ]


_LOCAL_DEV_ORIGINS: tuple[str, ...] = (
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)


def _merge_origins_unique(base: list[str], extras: list[str]) -> list[str]:
    seen = set(base)
    out = list(base)
    for item in extras:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _build_allowed_origins() -> list[str]:
    explicit_origins = _parse_csv_env("ALLOWED_ORIGINS")
    if explicit_origins:
        # Operator-defined list only — no automatic mixing of staging/prod.
        return explicit_origins

    origins: list[str] = []

    for candidate in (
        os.environ.get("FRONTEND_URL", ""),
        os.environ.get("VITE_FRONTEND_URL", ""),
    ):
        if candidate and candidate not in origins:
            origins.append(candidate.rstrip("/"))

    for domain in _parse_csv_env("ALLOWED_DOMAINS"):
        parsed = urlparse(domain if "://" in domain else f"https://{domain}")
        if parsed.scheme and parsed.netloc:
            https_origin = f"https://{parsed.netloc}"
            http_origin = f"http://{parsed.netloc}"
            if https_origin not in origins:
                origins.append(https_origin)
            if http_origin not in origins:
                origins.append(http_origin)

    if os.environ.get("ENVIRONMENT", "dev").lower() == "dev":
        origins = _merge_origins_unique(origins, list(_LOCAL_DEV_ORIGINS))

    if not origins:
        channel = _infer_dolli_cors_channel()
        origins = _merge_origins_unique(origins, _dolli_cors_fallback_origins(channel))
        if channel == "dev":
            origins = _merge_origins_unique(origins, list(_LOCAL_DEV_ORIGINS))

    return origins


def setup_logging():
    """Configure the logging system."""
    if os.environ.get("IS_LAMBDA") == "true":
        return

    # Create the logs directory
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    # Generate log filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = f"{log_dir}/app_{timestamp}.log"

    # Configure log format
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # Configure the root logger
    logging.basicConfig(
        level=logging.DEBUG,
        format=log_format,
        handlers=[
            # File handler
            logging.FileHandler(log_file, encoding="utf-8"),
            # Console handler
            logging.StreamHandler(),
        ],
    )

    # Set log levels for specific modules
    logging.getLogger("uvicorn").setLevel(logging.DEBUG)
    logging.getLogger("fastapi").setLevel(logging.DEBUG)

    # Log configuration details
    logger = logging.getLogger(__name__)
    logger.info("=== Logging system initialized ===")
    logger.info(f"Log file: {log_file}")
    logger.info("Log level: INFO")
    logger.info(f"Timestamp: {timestamp}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger(__name__)
    logger.info("=== Application startup initiated ===")

    # MODULE_STARTUP_START
    await initialize_database()
    await ensure_platform_dev_campaign()
    await initialize_admin_user()
    # MODULE_STARTUP_END

    logger.info("=== Application startup completed successfully ===")
    yield
    # MODULE_SHUTDOWN_START
    await close_database()
    # MODULE_SHUTDOWN_END


app = FastAPI(
    title="FastAPI Modular Template",
    description="A best-practice FastAPI template with modular architecture",
    version="1.0.0",
    lifespan=lifespan,
)


# MODULE_MIDDLEWARE_START
allowed_origins = _build_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
# MODULE_MIDDLEWARE_END


# Auto-discover and include all routers from the local `routers` package
def include_routers_from_package(app: FastAPI, package_name: str = "routers") -> None:
    """Discover and include all APIRouter objects from a package.

    This scans the given package (and subpackages) for module-level variables that
    are instances of FastAPI's APIRouter. It supports "router", "admin_router" names.
    """

    logger = logging.getLogger(__name__)

    try:
        pkg = importlib.import_module(package_name)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.debug("Routers package '%s' not loaded: %s", package_name, exc)
        return

    discovered: int = 0
    for _finder, module_name, is_pkg in pkgutil.walk_packages(pkg.__path__, pkg.__name__ + "."):
        # Only import leaf modules; subpackages will be walked automatically
        if is_pkg:
            continue
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Failed to import module '%s': %s", module_name, exc)
            continue

        # Check for router variable names: router and admin_router
        for attr_name in ("router", "admin_router"):
            if not hasattr(module, attr_name):
                continue

            attr = getattr(module, attr_name)

            if isinstance(attr, APIRouter):
                app.include_router(attr)
                discovered += 1
                logger.info("Included router: %s.%s", module_name, attr_name)
            elif isinstance(attr, (list, tuple)):
                for idx, item in enumerate(attr):
                    if isinstance(item, APIRouter):
                        app.include_router(item)
                        discovered += 1
                        logger.info("Included router from list: %s.%s[%d]", module_name, attr_name, idx)

    if discovered == 0:
        logger.debug("No routers discovered in package '%s'", package_name)


# Setup logging before router discovery
setup_logging()
include_routers_from_package(app, "routers")


# Add exception handler for all exceptions except HTTPException
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all exceptions except HTTPException

    - Dev environment: Return full stack trace and exception details
    - Prod environment: Return only "Internal server error"
    """
    # Re-raise HTTPException to let FastAPI handle it normally
    if isinstance(exc, HTTPException):
        raise exc

    logger = logging.getLogger(__name__)
    error_message = str(exc)
    error_type = type(exc).__name__

    # Log full error details regardless of environment
    logger.error(f"Exception: {error_type}: {error_message}\n{traceback.format_exc()}")

    # Determine if we're in dev environment
    is_dev = os.getenv("ENVIRONMENT", "prod").lower() == "dev"

    if is_dev:
        # Dev environment: return full stack trace and exception details
        error_detail = f"{error_type}: {error_message}\n{traceback.format_exc()}"
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": error_detail})
    else:
        # Prod environment: return only generic error message
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "Internal Server Error"}
        )


@app.get("/")
def root():
    return {"message": "FastAPI Modular Template is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


def run_in_debug_mode(app: FastAPI):
    """Run the FastAPI app in debug mode with proper asyncio handling.

    This function handles the special case of running in a debugger (PyCharm, VS Code, etc.)
    where asyncio is patched, causing conflicts with uvicorn's asyncio_run.

    It loads environment variables from ../.env and uses asyncio.run() directly
    to avoid uvicorn's asyncio_run conflicts.

    Args:
        app: The FastAPI application instance
    """
    import asyncio
    from pathlib import Path

    import uvicorn
    from dotenv import load_dotenv

    # Load environment variables from ../.env in debug mode
    # If `LOCAL_DEBUG=true` is set, then MetaGPT's `ProjectBuilder.build()` will generate the `.env` file
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=True)
        logger = logging.getLogger(__name__)
        logger.info(f"Loaded environment variables from {env_path}")

    # In debug mode, use asyncio.run() directly to avoid uvicorn's asyncio_run conflicts
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=int(settings.port),
        log_level="info",
    )
    server = uvicorn.Server(config)
    asyncio.run(server.serve())


if __name__ == "__main__":
    import sys

    import uvicorn

    # Detect if running in debugger (PyCharm, VS Code, etc.)
    # Debuggers patch asyncio which conflicts with uvicorn's asyncio_run
    is_debugging = "pydevd" in sys.modules or (hasattr(sys, "gettrace") and sys.gettrace() is not None)

    if is_debugging:
        run_in_debug_mode(app)
    else:
        # Enable reload in normal mode
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=int(settings.port),
            reload_excludes=["**/*.py"],
        )
