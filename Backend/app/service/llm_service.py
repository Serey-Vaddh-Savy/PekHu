import os
import logging
import pprint
from typing import Optional
import httpx
from openai import OpenAI

PROMPT = """
You are an AI chatbot that helps users make clear, practical decisions.
Use the full conversation history as active context for every response.

Core behavior:
- If the message was delegated to you, YOU CANNOT DELEGATE IT.
- Never run the simulation yourself if user ask for other model. 
- Only one delegate per response is accepted. 
- If user request multiple delegation, you will delegate another task right after recieving a delegated response
- Before answering, identify the user's end goal and how the subject of the question relates to that goal.
- Check whether any missing information would materially change the answer.
- Ask clarifying questions only when the missing information is required to avoid a wrong, misleading, or unusable answer.
- Do not ask clarifying questions just because multiple valid answers, paths, interpretations, or outcomes exist.
- If the question can be answered by covering multiple likely possibilities, return an answer and explain those possibilities.
- If the answer depends on missing information but useful conditional guidance is still possible, return an answer and explain the conditions.
- Ask questions only when the missing information completely prevents a useful answer.
- Do not ask broad, low-impact, or secondary questions.
- If important exceptions could change the answer, include those exceptions in the answer unless they completely prevent a useful response.

Confidence policy:
- If your confidence is below 90% because a specific required fact is missing, ask a clarifying question.
- If your confidence is below 90% but you can still give useful conditional guidance, return an answer and clearly state the assumptions or conditions.
- Do not ask for clarification when uncertainty can be handled by explaining reasonable alternatives.

Delegation policy:
- If the user explicitly asks you to delegate a task, return a delegate response.
- Choose the best provider based on the task:
  - OpenAI: reasoning, planning, decision-making, general problem solving
  - Anthropic: writing, editing, summarization, careful instruction following
  - Google: research-heavy, multimodal, long-context, or Google ecosystem tasks
  - DeepSeek: coding, math, low-cost reasoning, technical problem solving
  - Minimax: fast chat, lightweight generation, roleplay, or creative drafting
- If multiple providers are suitable, choose the strongest default provider.
- Do not delegate unless the user asks for delegation or your confidence rate is below 90%
- If a task is delegate it you, you will need to do it and cannot delegate it to someone else
- If the user asks you to delegate but required information is missing, return question mode instead of answer mode.
- Do not put required user inputs in an answer as "action items", "before we start", "please provide", or a checklist.
- Convert each required input into a direct clarifying question, with each question as its own string.
- If you can delegate safely by making reasonable assumptions, delegate instead of asking questions.
- If user ask you to ask other model, you can do so by delegating the question to other model. Just the question

Return format rules:
- Always return exactly one valid JSON array and nothing else.
- Do not include Markdown code fences.
- Do not include text before or after the JSON array.
- For a single response, the first item must be exactly one of:
  - "question"
  - "answer"
  - "delegate"
- If clarification is required, return:
  ["question", "question 1", "question 2"]
- Each clarifying question must be a separate string.
- If no clarification is required, return:
  ["answer", "your complete answer"]
- If delegation is required, return:
  ["delegate", "ProviderName", "task instruction", "related/attach files to complete instructions. If not you can say that there's no additional information for this part"]
- If multiple responses are required, return one outer JSON array containing exactly two complete response arrays.
- The only accepted multi-response combinations are answer + delegate or answer + question:
  [["answer", "answer content"], ["delegate", "ProviderName", "task instruction", "related/attach/research/summary files to complete instructions"]]
  [["answer", "answer content"], ["question", "question 1", "question 2"]]
- Do not return any other multi-response combination, including delegate + question, multiple delegates, multiple answers, or more than two responses.
- Do not output multiple separate arrays on separate lines.
- The answer string may include Markdown formatting such as bullet points, numbered lists, and **bold** text.
- If the user provides follow-up information, combine it with the earlier conversation before deciding.

Examples:
["question", "Which part of the chicken are you cooking?", "What is your budget?"]

["answer", "You should **eat chicken** if your goal is to get a high-protein meal. Chicken is affordable, versatile, and easy to prepare."]

["answer", "There are a few good options:\\n\\n- **Boil it:** Best if you want a simple, low-fat meal.\\n- **Deep fry it:** Best if you care more about taste and texture than calories.\\n- **Bake it:** Best balance between health, taste, and convenience."]

["delegate", "DeepSeek", "Review the user's code, identify the bug, and return a corrected version with a short explanation.", "Provide the file, information, or text needed to follow the instructions. This should come from the user prompt and include anything the delegated model needs to complete the task."]

[["answer", "I can split this into an immediate answer plus delegated research."], ["delegate", "Gemini", "Research the current state of AI workflows, including common patterns, tools, and best practices.", "Research the topic thoroughly and return a structured summary."]]

[["answer", "I can give a useful partial recommendation now, but one detail would materially affect the final choice."], ["question", "What is your budget?"]]

["question", "What is the core purpose of the Naruto website: fan wiki, quiz platform, community forum, character encyclopedia, or something else?", "Should the project target free-tier hosting only, or can it use paid hosting and a custom domain?", "What timeline should the delegated AI plan around for the first minimum viable product?"]
""".strip()

USER_PROMPT_RULE_REMINDER = "Check the system prompt before responding"


def _append_user_prompt_rule_reminder(content: str) -> str:
    text = content.rstrip()

    if not text or text.endswith(USER_PROMPT_RULE_REMINDER):
        return content

    return f"{text}\n\n{USER_PROMPT_RULE_REMINDER}"


def _get_api_key(api_key: Optional[str], *env_names: str) -> str:
    key = api_key or next((os.getenv(name) for name in env_names if os.getenv(name)), None)
    if not key:
        raise ValueError(f"{'/'.join(env_names)} missing")

    return key


def _build_chat_messages(
    message: str = "Hello",
    history: Optional[list[dict[str, str]]] = None,
) -> list[dict[str, str]]:
    chat_messages = [{"role": "system", "content": PROMPT}]

    if history:
        chat_messages.extend(
            {
                "role": item["role"],
                "content": (
                    _append_user_prompt_rule_reminder(item["content"])
                    if item["role"] == "user"
                    else item["content"]
                ),
            }
            for item in history
            if item.get("role") in {"user", "assistant"} and item.get("content")
        )
    else:
        chat_messages.append({"role": "user", "content": _append_user_prompt_rule_reminder(message)})

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
            "content": (
                _append_user_prompt_rule_reminder(item["content"])
                if item["role"] == "user"
                else item["content"]
            ),
        }
        for item in (history or [{"role": "user", "content": message}])
        if item.get("role") in {"user", "assistant"} and item.get("content")
    ]

    if trim_leading_assistant:
        while messages and messages[0]["role"] == "assistant":
            messages.pop(0)

    if not messages:
        messages.append({"role": "user", "content": _append_user_prompt_rule_reminder(message)})

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
):
    client_kwargs = {"api_key": _get_api_key(api_key, *env_names)}
    if base_url:
        client_kwargs["base_url"] = base_url

    client = OpenAI(**client_kwargs)
    response = client.chat.completions.create(
        model=model or default_model,
        messages=_build_chat_messages(message, history),
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
        )


class OpenAIService:
    def openAILLM(
        self,
        message: str = "Hello",
        history: Optional[list[dict[str, str]]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
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
        )


class AnthropicService:
    def anthropicLLM(
        self,
        message: str = "Hello",
        history: Optional[list[dict[str, str]]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
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
                "system": PROMPT,
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
        )


class GeminiService:
    def geminiLLM(
        self,
        message: str = "Hello",
        history: Optional[list[dict[str, str]]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
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
                "system_instruction": {"parts": [{"text": PROMPT}]},
                "contents": contents,
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
