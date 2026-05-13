import os
import logging
import pprint
from typing import Optional
import httpx
from openai import OpenAI


def _get_api_key(api_key: Optional[str], *env_names: str) -> str:
    key = api_key or next((os.getenv(name) for name in env_names if os.getenv(name)), None)
    if not key:
        raise ValueError(f"{'/'.join(env_names)} missing")

    return key


def _build_chat_messages(
    message: str = "Hello",
    history: Optional[list[dict[str, str]]] = None,
    *,
    prompt: str,
) -> list[dict[str, str]]:
    chat_messages = [{"role": "system", "content": prompt}]

    if history:
        chat_messages.extend(
            {
                "role": item["role"],
                "content": item["content"],
            }
            for item in history
            if item.get("role") in {"user", "assistant"} and item.get("content")
        )
    else:
        chat_messages.append({"role": "user", "content": message})

    return chat_messages


def _conversation_messages(
    message: str = "Hello",
    history: Optional[list[dict[str, str]]] = None,
    *,
    trim_leading_assistant: bool = False,
) -> list[dict[str, str]]:
    messages = [
        {
            "role": item["role"],
            "content": item["content"],
        }
        for item in (history or [{"role": "user", "content": message}])
        if item.get("role") in {"user", "assistant"} and item.get("content")
    ]

    if trim_leading_assistant:
        while messages and messages[0]["role"] == "assistant":
            messages.pop(0)

    if not messages:
        messages.append({"role": "user", "content": message})

    return messages


def _log_response(provider: str, response):
    try:
        serial = None
        if isinstance(response, dict):
            serial = response
        elif hasattr(response, "to_dict"):
            try:
                serial = response.to_dict()
            except Exception:
                serial = None
        elif hasattr(response, "__dict__"):
            try:
                serial = vars(response)
            except Exception:
                serial = None

        if serial is not None:
            logging.getLogger("backend").info("%s full response:\n%s", provider, pprint.pformat(serial))
        else:
            logging.getLogger("backend").info("%s full response (repr):\n%s", provider, repr(response))
    except Exception:
        logging.getLogger("backend").exception("Failed to log %s response", provider)


def _extract_openai_reply(response):
    try:
        if isinstance(response, dict):
            choices = response.get("choices", [])
            if choices and isinstance(choices[0], dict):
                msg = choices[0].get("message", {})
                content = msg.get("content")
                if content is not None:
                    return {"reply": content}

        choices = getattr(response, "choices", None)
        if choices:
            first = choices[0]
            message_obj = getattr(first, "message", None) or (
                first.get("message") if isinstance(first, dict) else None
            )
            content = getattr(message_obj, "content", None) or (
                message_obj.get("content") if isinstance(message_obj, dict) else None
            )
            if content is not None:
                return {"reply": content}

        return {"reply": str(response)}
    except Exception:
        return {"reply": str(response)}


def _gemini_google_search_tool(model: str) -> dict:
    if model.startswith("gemini-1.5"):
        return {
            "google_search_retrieval": {
                "dynamic_retrieval_config": {
                    "mode": "MODE_DYNAMIC",
                    "dynamic_threshold": 0.3,
                }
            }
        }

    return {"google_search": {}}


def _openai_compatible_chat(
    *,
    provider_name: str,
    default_model: str,
    env_names: tuple[str, ...],
    base_url: Optional[str] = None,
    message: str = "Hello",
    history: Optional[list[dict[str, str]]] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    prompt: str,
):
    client_kwargs = {"api_key": _get_api_key(api_key, *env_names)}
    if base_url:
        client_kwargs["base_url"] = base_url

    client = OpenAI(**client_kwargs)
    response = client.chat.completions.create(
        model=model or default_model,
        messages=_build_chat_messages(message, history, prompt=prompt),
        stream=False,
    )
    _log_response(provider_name, response)

    return _extract_openai_reply(response)


class DeepSeekService:
    def deepSeekLLM(
        self,
        message: str = "Hello",
        history: Optional[list[dict[str, str]]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        *,
        prompt: str,
    ):
        return _openai_compatible_chat(
            provider_name=provider or "DeepSeek",
            default_model="deepseek-chat",
            env_names=("DEEPSEEK_API_KEY", "DEEEPSEEK_API_KEY", "API_KEY"),
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
            message=message,
            history=history,
            model=model,
            api_key=api_key,
            prompt=prompt,
        )


class OpenAIService:
    def openAILLM(
        self,
        message: str = "Hello",
        history: Optional[list[dict[str, str]]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        *,
        prompt: str,
    ):
        return _openai_compatible_chat(
            provider_name=provider or "OpenAI",
            default_model="gpt-4o-mini",
            env_names=("OPENAI_API_KEY", "API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL"),
            message=message,
            history=history,
            model=model,
            api_key=api_key,
            prompt=prompt,
        )


class AnthropicService:
    def anthropicLLM(
        self,
        message: str = "Hello",
        history: Optional[list[dict[str, str]]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        *,
        prompt: str,
    ):
        key = _get_api_key(api_key, "ANTHROPIC_API_KEY", "API_KEY")
        messages = _conversation_messages(message, history, trim_leading_assistant=True)

        response = httpx.post(
            os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1/messages"),
            headers={
                "x-api-key": key,
                "anthropic-version": os.getenv("ANTHROPIC_VERSION", "2023-06-01"),
                "content-type": "application/json",
            },
            json={
                "model": model or "claude-3-5-haiku-latest",
                "max_tokens": 2048,
                "system": prompt,
                "messages": messages,
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        _log_response(provider or "Anthropic", data)

        content = data.get("content", [])
        text = "".join(part.get("text", "") for part in content if part.get("type") == "text")

        return {"reply": text or str(data)}


class MinimaxService:
    def minimaxLLM(
        self,
        message: str = "Hello",
        history: Optional[list[dict[str, str]]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        *,
        prompt: str,
    ):
        return _openai_compatible_chat(
            provider_name=provider or "Minimax",
            default_model="abab6.5-chat",
            env_names=("MINIMAX_API_KEY", "API_KEY"),
            base_url=os.getenv("MINIMAX_BASE_URL", "https://api.minimax.io/v1"),
            message=message,
            history=history,
            model=model,
            api_key=api_key,
            prompt=prompt,
        )


class GeminiService:
    def geminiLLM(
        self,
        message: str = "Hello",
        history: Optional[list[dict[str, str]]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        *,
        prompt: str,
    ):
        key = _get_api_key(api_key, "GEMINI_API_KEY", "GOOGLE_API_KEY", "API_KEY")
        selected_model = model or "gemini-1.5-flash"
        messages = _conversation_messages(message, history, trim_leading_assistant=True)
        contents = [
            {
                "role": "model" if item["role"] == "assistant" else "user",
                "parts": [{"text": item["content"]}],
            }
            for item in messages
        ]

        url = (
            os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
            + f"/models/{selected_model}:generateContent"
        )
        response = httpx.post(
            url,
            params={"key": key},
            json={
                "system_instruction": {"parts": [{"text": prompt}]},
                "contents": contents,
                "tools": [_gemini_google_search_tool(selected_model)],
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        _log_response(provider or "Google", data)

        candidates = data.get("candidates", [])
        parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
        text = "".join(part.get("text", "") for part in parts)

        return {"reply": text or str(data)}
