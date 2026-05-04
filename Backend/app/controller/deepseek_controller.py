from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
import httpx
from pydantic import BaseModel
from app.service.llm_service import (
    AnthropicService,
    DeepSeekService,
    GeminiService,
    MinimaxService,
    OpenAIService,
)

router = APIRouter(prefix="/DeepSeek", tags=["DeepSeek"])


def get_deepseek_service() -> DeepSeekService:
    return DeepSeekService()


def get_deepseek_dependency(
    service: DeepSeekService = Depends(get_deepseek_service),
) -> DeepSeekService:
    return service


@router.get("/test")
def test(service: DeepSeekService = Depends(get_deepseek_service)):
    # Keep the existing GET-based test endpoint returning a sample reply
    return service.deepSeekLLM()
    


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


@router.post("/test")
def test_post(payload: ChatRequest, service: DeepSeekService = Depends(get_deepseek_service)):
    history = [message.dict() for message in payload.history or []]
    provider = (payload.provider or "DeepSeek").lower()

    try:
        if provider == "openai":
            return OpenAIService().openAILLM(
                payload.message,
                history=history,
                provider=payload.provider,
                model=payload.model,
                api_key=payload.apiKey,
            )

        if provider == "anthropic":
            return AnthropicService().anthropicLLM(
                payload.message,
                history=history,
                provider=payload.provider,
                model=payload.model,
                api_key=payload.apiKey,
            )

        if provider in {"google", "gemini"}:
            return GeminiService().geminiLLM(
                payload.message,
                history=history,
                provider=payload.provider,
                model=payload.model,
                api_key=payload.apiKey,
            )

        if provider == "minimax":
            return MinimaxService().minimaxLLM(
                payload.message,
                history=history,
                provider=payload.provider,
                model=payload.model,
                api_key=payload.apiKey,
            )

        return service.deepSeekLLM(
            payload.message,
            history=history,
            provider=payload.provider,
            model=payload.model,
            api_key=payload.apiKey,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except httpx.HTTPStatusError as error:
        raise HTTPException(
            status_code=error.response.status_code,
            detail=error.response.text,
        ) from error
