"""Configuration for the LLM Council."""

import os
from dotenv import load_dotenv

load_dotenv()

# Provider selection (supported: "openrouter", "poe")
PROVIDER_OPENROUTER = "openrouter"
PROVIDER_POE = "poe"
DEFAULT_LLM_PROVIDER = PROVIDER_OPENROUTER
LLM_PROVIDER = os.getenv("LLM_PROVIDER", DEFAULT_LLM_PROVIDER)

# Backward-compatible OpenRouter-specific API key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Generic API key with provider-specific fallbacks
LLM_API_KEY = os.getenv("LLM_API_KEY")
if not LLM_API_KEY:
    if LLM_PROVIDER == PROVIDER_POE:
        LLM_API_KEY = os.getenv("POE_API_KEY")
    else:
        LLM_API_KEY = OPENROUTER_API_KEY

# ---------------------------------------------------------------------------
# SOTA council models per provider
#
# Default council (OpenRouter identifiers):
#   - openai/gpt-5.5          → OpenAI flagship (broad knowledge, strong reasoning)
#   - anthropic/claude-sonnet-4-6 → Anthropic council member (fast, highly capable)
#   - google/gemini-3-pro-preview → Google flagship (multimodal, large context)
#   - x-ai/grok-4             → xAI frontier model (up-to-date knowledge)
#
# Chairman (synthesizer) – anthropic/claude-opus-4-6:
#   Opus-class models consistently excel at following complex multi-step
#   instructions, synthesizing diverse perspectives, and producing coherent
#   long-form text — exactly what the chairman role demands. Opus 4.6 is
#   the most capable available Anthropic model, making it the best choice
#   to act as the final arbiter of the council.
# ---------------------------------------------------------------------------

# Default council and chairman for OpenRouter
_OPENROUTER_COUNCIL_MODELS = [
    "openai/gpt-5.5",
    "anthropic/claude-sonnet-4-6",
    "google/gemini-3-pro-preview",
    "x-ai/grok-4",
]
_OPENROUTER_CHAIRMAN_MODEL = "anthropic/claude-opus-4-6"

# Default council and chairman for Poe
# Poe uses shorter model identifiers without the provider prefix.
# GPT models are capitalised; Anthropic and Google models are lowercase.
_POE_COUNCIL_MODELS = [
    "GPT-5.5",
    "claude-sonnet-4-6",
    "gemini-3-pro-preview",
    "grok-4",
]
_POE_CHAIRMAN_MODEL = "claude-opus-4-6"

# Active defaults (resolved at import time from env LLM_PROVIDER)
COUNCIL_MODELS = (
    _POE_COUNCIL_MODELS if LLM_PROVIDER == PROVIDER_POE else _OPENROUTER_COUNCIL_MODELS
)
CHAIRMAN_MODEL = (
    _POE_CHAIRMAN_MODEL if LLM_PROVIDER == PROVIDER_POE else _OPENROUTER_CHAIRMAN_MODEL
)

# ---------------------------------------------------------------------------
# Provider ↔ model name mapping
#
# Used to auto-translate model identifiers when the user switches providers
# in the settings UI.  Add entries here whenever new SOTA models are added.
# ---------------------------------------------------------------------------

# OpenRouter identifier → Poe identifier
OPENROUTER_TO_POE: dict[str, str] = {
    # OpenAI
    "openai/gpt-5.5": "GPT-5.5",
    "openai/gpt-5.1": "GPT-5.1",
    "openai/gpt-4.1": "GPT-4.1",
    "openai/gpt-4o": "GPT-4o",
    "openai/gpt-4o-mini": "GPT-4o-mini",
    "openai/o3": "o3",
    "openai/o3-mini": "o3-mini",
    "openai/o1": "o1",
    # Anthropic
    "anthropic/claude-opus-4-6": "claude-opus-4-6",
    "anthropic/claude-sonnet-4-6": "claude-sonnet-4-6",
    "anthropic/claude-opus-4-5": "claude-opus-4-5",
    "anthropic/claude-sonnet-4-5": "claude-sonnet-4-5",
    "anthropic/claude-sonnet-4.5": "claude-sonnet-4.5",
    "anthropic/claude-3-7-sonnet": "claude-3-7-sonnet",
    "anthropic/claude-3-5-sonnet": "claude-3-5-sonnet",
    "anthropic/claude-3-opus": "claude-3-opus",
    # Google
    "google/gemini-3-pro-preview": "gemini-3-pro-preview",
    "google/gemini-2.5-pro": "gemini-2.5-pro",
    "google/gemini-2.5-flash": "gemini-2.5-flash",
    "google/gemini-2-flash": "gemini-2-flash",
    # xAI
    "x-ai/grok-4": "grok-4",
    "x-ai/grok-3": "grok-3",
    "x-ai/grok-3-mini": "grok-3-mini",
}

# Poe identifier → OpenRouter identifier (reverse mapping)
POE_TO_OPENROUTER: dict[str, str] = {v: k for k, v in OPENROUTER_TO_POE.items()}

# Provider-keyed defaults (used by runtime_settings when provider changes)
PROVIDER_DEFAULT_MODELS: dict[str, dict] = {
    PROVIDER_OPENROUTER: {
        "council_models": list(_OPENROUTER_COUNCIL_MODELS),
        "chairman_model": _OPENROUTER_CHAIRMAN_MODEL,
    },
    PROVIDER_POE: {
        "council_models": list(_POE_COUNCIL_MODELS),
        "chairman_model": _POE_CHAIRMAN_MODEL,
    },
}

# ---------------------------------------------------------------------------
# File-capable model whitelist
#
# Models on this list natively accept image and PDF file inputs through the
# OpenAI-compatible multimodal content part API.  File attachment is only
# offered in the UI when ALL active council + chairman models are whitelisted.
#
# Matching is prefix-based (case-insensitive on the model identifier).
# ---------------------------------------------------------------------------

# Prefixes for OpenRouter identifiers
OPENROUTER_FILE_CAPABLE_PREFIXES = (
    "openai/gpt-4",
    "openai/gpt-5",
    "openai/o1",
    "openai/o3",
    "anthropic/claude-3",
    "anthropic/claude-opus-4",
    "anthropic/claude-sonnet-4",
    "anthropic/claude-haiku-4",
    "google/gemini-",
    "x-ai/grok-3",
    "x-ai/grok-4",
)

# Prefixes for Poe identifiers
POE_FILE_CAPABLE_PREFIXES = (
    "GPT-4",
    "GPT-5",
    "o1",
    "o3",
    "claude-3",
    "claude-opus-4",
    "claude-sonnet-4",
    "claude-haiku-4",
    "gemini-",
    "Gemini-",
    "grok-3",
    "grok-4",
)

# OpenAI-compatible API endpoints
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
POE_API_URL = "https://api.poe.com/v1/chat/completions"

# Generic API URL with provider-specific default fallback
LLM_API_URL = os.getenv("LLM_API_URL")
if not LLM_API_URL:
    if LLM_PROVIDER == PROVIDER_POE:
        LLM_API_URL = os.getenv("POE_API_URL", POE_API_URL)
    else:
        LLM_API_URL = os.getenv("OPENROUTER_API_URL", OPENROUTER_API_URL)

# Data directory for conversation storage
DATA_DIR = "data/conversations"
