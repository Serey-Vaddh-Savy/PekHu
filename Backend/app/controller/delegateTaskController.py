from fastapi import APIRouter, Depends, HTTPException
import httpx

from app.controller.chat_common import ChatRequest, run_provider_chat
from app.service.llm_service import DeepSeekService


DELEGATE_TASK_PROMPT = """
You are a delegated AI worker inside a larger chat workflow.
Use the conversation history and the user's latest message as the full task context.

Behavior:
- Complete the assigned task directly.
- Follow the user's instructions and attached context closely.
- Do not delegate to another model.
- Do not use the headmaster JSON protocol.
- Do not return ["answer", ...], ["question", ...], or ["delegate", ...] arrays.
- Return normal plain text or Markdown that is useful to the user.
- If essential information is missing, ask concise clarifying questions in normal text.
- If you can proceed with reasonable assumptions, state those assumptions briefly and continue.
- For summaries, return concise plain text unless the user asks for a different structure.
""".strip()


router = APIRouter(prefix="/DelegateTask", tags=["DelegateTask"])


def get_deepseek_service() -> DeepSeekService:
    return DeepSeekService()


def _run_delegate_task_chat(payload: ChatRequest, service: DeepSeekService):
    try:
        return run_provider_chat(payload, prompt=DELEGATE_TASK_PROMPT, default_service=service)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except httpx.HTTPStatusError as error:
        raise HTTPException(
            status_code=error.response.status_code,
            detail=error.response.text,
        ) from error


@router.get("/test")
def test(service: DeepSeekService = Depends(get_deepseek_service)):
    payload = ChatRequest(message="Hello")
    return _run_delegate_task_chat(payload, service)


@router.post("/chat")
def chat(payload: ChatRequest, service: DeepSeekService = Depends(get_deepseek_service)):
    return _run_delegate_task_chat(payload, service)
