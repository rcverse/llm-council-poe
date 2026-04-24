"""Provider-agnostic API client for making LLM requests."""

import asyncio
from typing import List, Dict, Any, Optional, Tuple

import httpx

from .runtime_settings import SUPPORTED_PROVIDERS, get_runtime_provider_settings


def _resolve_provider_settings() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Resolve active provider and credentials."""
    provider, api_key, api_url = get_runtime_provider_settings()

    if not api_key:
        print(f"Error: Missing API key for provider '{provider}'.")
        return provider, None, api_url

    if not api_url:
        print(f"Error: Missing API URL for provider '{provider}'.")
        return provider, api_key, None

    if provider not in SUPPORTED_PROVIDERS:
        print(
            f"Error: Unsupported LLM_PROVIDER '{provider}'. "
            f"Supported providers: {sorted(SUPPORTED_PROVIDERS)}"
        )
        return None, None, None

    return provider, api_key, api_url


def _build_request(
    model: str,
    messages: List[Dict[str, str]],
    api_key: str,
) -> Tuple[Dict[str, str], Dict[str, Any]]:
    """Build OpenAI-compatible request payload."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
    }
    return headers, payload


def _parse_response(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse OpenAI-compatible response safely."""
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        return None

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        return None

    message = first_choice.get("message")
    if not isinstance(message, dict):
        return None

    return {
        "content": message.get("content", ""),
        "reasoning_details": message.get("reasoning_details"),
    }


async def query_model(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0
) -> Optional[Dict[str, Any]]:
    """
    Query a single model via configured provider.

    Args:
        model: Model identifier (OpenAI-compatible format)
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds

    Returns:
        Response dict with 'content' and optional 'reasoning_details', or None if failed
    """
    provider, api_key, api_url = _resolve_provider_settings()
    if not provider or not api_key or not api_url:
        return None

    headers, payload = _build_request(model, messages, api_key)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                api_url,
                headers=headers,
                json=payload
            )
            response.raise_for_status()

            data = response.json()
            parsed = _parse_response(data)
            if parsed is None:
                print("Error querying model: invalid response format")
                return None
            return parsed

    except httpx.HTTPStatusError:
        print("Error querying model: provider request failed")
        return None
    except Exception:
        print("Error querying model: provider request failed")
        return None


async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, str]]
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel.

    Args:
        models: List of model identifiers
        messages: List of message dicts to send to each model

    Returns:
        Dict mapping model identifier to response dict (or None if failed)
    """
    # Create tasks for all models
    tasks = [query_model(model, messages) for model in models]

    # Wait for all to complete
    responses = await asyncio.gather(*tasks)

    # Map models to their responses
    return {model: response for model, response in zip(models, responses)}
