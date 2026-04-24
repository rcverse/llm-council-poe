"""Runtime settings resolution and persistence for configurable council settings."""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .config import (
    CHAIRMAN_MODEL,
    COUNCIL_MODELS,
    DEFAULT_LLM_PROVIDER,
    OPENROUTER_API_KEY,
    OPENROUTER_API_URL,
    POE_API_URL,
    PROVIDER_OPENROUTER,
    PROVIDER_POE,
)

SUPPORTED_PROVIDERS = {PROVIDER_OPENROUTER, PROVIDER_POE}
SETTINGS_PATH = Path("data/settings.json")

# Secret values are intentionally not persisted.
_secret_overrides: Dict[str, Optional[str]] = {
    "llm_api_key": None,
}


def _settings_template() -> Dict[str, Any]:
    return {
        "llm_provider": DEFAULT_LLM_PROVIDER,
        "llm_api_url": OPENROUTER_API_URL,
        "council_models": list(COUNCIL_MODELS),
        "chairman_model": CHAIRMAN_MODEL,
        "has_api_key": False,
    }


def _read_settings_file() -> Dict[str, Any]:
    if not SETTINGS_PATH.exists():
        return {}

    try:
        with SETTINGS_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data
    except Exception:
        pass

    return {}


def _write_settings_file(settings: Dict[str, Any]) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with SETTINGS_PATH.open("w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)


def _normalize_provider(provider: Optional[str]) -> str:
    normalized = (provider or "").strip().lower()
    if normalized not in SUPPORTED_PROVIDERS:
        return DEFAULT_LLM_PROVIDER
    return normalized


def _normalize_models(models: Any) -> List[str]:
    if not isinstance(models, list):
        return list(COUNCIL_MODELS)

    normalized = [str(model).strip() for model in models if str(model).strip()]
    return normalized or list(COUNCIL_MODELS)


def _provider_default_url(provider: str) -> str:
    if provider == PROVIDER_POE:
        return POE_API_URL
    return OPENROUTER_API_URL


def _env_api_key(provider: str) -> Optional[str]:
    import os

    generic_key = (os.getenv("LLM_API_KEY") or "").strip()
    if generic_key:
        return generic_key

    if provider == PROVIDER_POE:
        poe_key = (os.getenv("POE_API_KEY") or "").strip()
        return poe_key or None

    openrouter_key = (OPENROUTER_API_KEY or "").strip()
    return openrouter_key or None


def _env_api_url(provider: str) -> str:
    import os

    generic_url = (os.getenv("LLM_API_URL") or "").strip()
    if generic_url:
        return generic_url

    if provider == PROVIDER_POE:
        poe_url = (os.getenv("POE_API_URL") or "").strip()
        return poe_url or POE_API_URL

    openrouter_url = (os.getenv("OPENROUTER_API_URL") or "").strip()
    return openrouter_url or OPENROUTER_API_URL


def get_effective_settings() -> Dict[str, Any]:
    """Return effective runtime settings resolved from persisted values and env fallbacks."""
    persisted = _read_settings_file()

    provider = _normalize_provider(persisted.get("llm_provider"))
    llm_api_url = str(persisted.get("llm_api_url") or "").strip() or _env_api_url(provider)
    council_models = _normalize_models(persisted.get("council_models"))
    chairman_model = str(persisted.get("chairman_model") or "").strip() or CHAIRMAN_MODEL

    api_key = _secret_overrides.get("llm_api_key") or _env_api_key(provider)
    has_api_key = bool(api_key and str(api_key).strip())

    settings = _settings_template()
    settings.update(
        {
            "llm_provider": provider,
            "llm_api_url": llm_api_url,
            "council_models": council_models,
            "chairman_model": chairman_model,
            "has_api_key": has_api_key,
        }
    )
    return settings


def get_public_settings() -> Dict[str, Any]:
    """Return effective settings safe for API responses."""
    return get_effective_settings()


def get_runtime_provider_settings() -> Tuple[str, Optional[str], str]:
    """Return provider settings including resolved API key for internal runtime use."""
    settings = get_effective_settings()
    provider = settings["llm_provider"]
    api_key = _secret_overrides.get("llm_api_key") or _env_api_key(provider)
    return provider, api_key, settings["llm_api_url"]


def update_settings(updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update mutable runtime settings.

    Non-secret settings are persisted to disk. Secret overrides remain in-memory only.
    """
    persisted = _read_settings_file()
    new_persisted = dict(persisted)

    if "llm_provider" in updates and updates["llm_provider"] is not None:
        raw_provider = str(updates["llm_provider"]).strip().lower()
        if raw_provider not in SUPPORTED_PROVIDERS:
            raise ValueError("Unsupported provider")
        new_persisted["llm_provider"] = raw_provider

    if "llm_api_url" in updates and updates["llm_api_url"] is not None:
        url = str(updates["llm_api_url"]).strip()
        if url:
            new_persisted["llm_api_url"] = url
        else:
            new_persisted.pop("llm_api_url", None)

    if "council_models" in updates and updates["council_models"] is not None:
        models = _normalize_models(updates["council_models"])
        if not models:
            raise ValueError("council_models must contain at least one model")
        new_persisted["council_models"] = models

    if "chairman_model" in updates and updates["chairman_model"] is not None:
        chairman_model = str(updates["chairman_model"]).strip()
        if not chairman_model:
            raise ValueError("chairman_model cannot be empty")
        new_persisted["chairman_model"] = chairman_model

    if "llm_api_key" in updates and updates["llm_api_key"] is not None:
        api_key = str(updates["llm_api_key"]).strip()
        _secret_overrides["llm_api_key"] = api_key or None

    _write_settings_file(new_persisted)
    return get_public_settings()
