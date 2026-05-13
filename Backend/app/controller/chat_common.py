from typing import Literal, Optional

from pydantic import BaseModel

from app.service.llm_service import (
    AnthropicService,
    DeepSeekService,
    GeminiService,
    MinimaxService,
    OpenAIService,
)


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[list[ChatHistoryMessage]] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    apiKey: Optional[str] = None
    useInputCaching: Optional[bool] = False


def _model_to_dict(model: BaseModel) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()

    return model.dict()


def get_history(payload: ChatRequest) -> list[dict[str, str]]:
    return [_model_to_dict(message) for message in payload.history or []]


def run_provider_chat(
    payload: ChatRequest,
    *,
    prompt: str,
    default_service: Optional[DeepSeekService] = None,
):
    history = get_history(payload)
    provider = (payload.provider or "DeepSeek").lower()

    if provider == "openai":
        return OpenAIService().openAILLM(
            payload.message,
            history=history,
            provider=payload.provider,
            model=payload.model,
            api_key=payload.apiKey,
            prompt=prompt,
        )

    if provider == "anthropic":
        return AnthropicService().anthropicLLM(
            payload.message,
            history=history,
            provider=payload.provider,
            model=payload.model,
            api_key=payload.apiKey,
            prompt=prompt,
        )

    if provider in {"google", "gemini"}:
        return GeminiService().geminiLLM(
            payload.message,
            history=history,
            provider=payload.provider,
            model=payload.model,
            api_key=payload.apiKey,
            prompt=prompt,
        )

    if provider == "minimax":
        return MinimaxService().minimaxLLM(
            payload.message,
            history=history,
            provider=payload.provider,
            model=payload.model,
            api_key=payload.apiKey,
            prompt=prompt,
        )

    service = default_service or DeepSeekService()
    return service.deepSeekLLM(
        payload.message,
        history=history,
        provider=payload.provider,
        model=payload.model,
        api_key=payload.apiKey,
        prompt=prompt,
    )
