import logging
import json
import re
import os
from typing import Dict, Any, Optional
from .nocode_strategy import NoCodeStrategy
from backend.config import get_groq_client, get_openai_client

logger = logging.getLogger(__name__)

DEFAULT_RULES = {
    "entry_rules": {
        "rsi_condition": "below",
        "rsi_value": 35,
        "macd_condition": "cross_up",
        "ema_condition": "above",
        "ema_period": 200,
        "bb_condition": "none",
        "volume_filter": False
    },
    "exit_rules": {
        "rsi_condition": "above",
        "rsi_value": 70,
        "tp_pct": 3.0,
        "sl_pct": 1.5,
        "macd_condition": "cross_down",
        "bb_condition": "none"
    }
}

class AIPromptStrategy(NoCodeStrategy):
    """
    استراتيجية الذكاء الاصطناعي (AI Prompt Strategy).
    تأخذ وصف المستخدم باللغة الطبيعية (عربي أو إنجليزي)، وتحوله لقواعد فنية صارمة عبر LLM
    ثم تنفذها بكفاءة وسرعة فائقة باستخدام محرك NoCodeStrategy.
    """

    def __init__(self, params: Dict[str, Any] = None):
        params = params or {}
        self.prompt = params.get('ai_prompt', params.get('prompt', ''))
        
        # إذا كانت القواعد محللة مسبقاً، نستخدمها مباشرة
        parsed_rules = params.get('parsed_rules')
        if not parsed_rules and 'rules' in params:
            parsed_rules = params['rules']

        if not parsed_rules and self.prompt:
            # التحليل المتزامن الفوري كخيار احتياطي
            parsed_rules = AIPromptStrategy.parse_prompt_sync(self.prompt)
        
        params['rules'] = parsed_rules or DEFAULT_RULES
        super().__init__(params=params)
        self.name = "AIPromptStrategy"

    @staticmethod
    async def parse_prompt_async(prompt: str) -> Dict[str, Any]:
        """
        تحويل النص الطبيعي إلى JSON Rules باستخدام Groq أو OpenRouter.
        """
        if not prompt or not prompt.strip():
            return DEFAULT_RULES

        system_instruction = (
            "You are an expert quantitative trading rule extractor. "
            "Convert the user's natural language trading strategy description into a strict JSON rules object.\n"
            "Supported fields and allowable values:\n"
            "entry_rules:\n"
            "  - rsi_condition: 'below' | 'above' | 'none'\n"
            "  - rsi_value: number (default 30)\n"
            "  - macd_condition: 'cross_up' | 'above_signal' | 'none'\n"
            "  - ema_condition: 'above' | 'below' | 'none'\n"
            "  - ema_period: integer (e.g. 20, 50, 100, 200)\n"
            "  - bb_condition: 'touch_lower' | 'touch_upper' | 'none'\n"
            "  - volume_filter: boolean\n"
            "exit_rules:\n"
            "  - tp_pct: number (take profit percentage e.g. 3.0)\n"
            "  - sl_pct: number (stop loss percentage e.g. 1.5)\n"
            "  - rsi_condition: 'above' | 'below' | 'none'\n"
            "  - rsi_value: number (default 70)\n"
            "  - macd_condition: 'cross_down' | 'none'\n"
            "  - bb_condition: 'touch_upper' | 'none'\n\n"
            "Output ONLY valid JSON without markdown fences, explanation, or commentary."
        )

        user_content = f"User Strategy Description:\n\"{prompt}\"\n\nJSON:"

        # 1. التجربة عبر Groq (فائق السرعة)
        groq_models = [
            os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "llama3-70b-8192",
            "llama-3.3-70b-versatile"
        ]
        client = None
        try:
            client = get_groq_client()
        except Exception as ge:
            logger.warning(f"Could not get Groq client: {ge}")

        if client:
            for model_name in groq_models:
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": system_instruction},
                            {"role": "user", "content": user_content}
                        ],
                        temperature=0.1,
                        max_tokens=600,
                    )
                    raw = response.choices[0].message.content.strip()
                    parsed = AIPromptStrategy._clean_and_parse_json(raw)
                    if parsed and ("entry_rules" in parsed or "exit_rules" in parsed):
                        return parsed
                except Exception as e:
                    logger.warning(f"Groq model {model_name} failed: {e}")

        # 2. التجربة عبر OpenRouter كبديل
        openrouter_models = [
            "openai/gpt-4o-mini",
            "meta-llama/llama-3.1-8b-instruct",
            "google/gemini-2.0-flash-001",
            "anthropic/claude-3-haiku"
        ]
        or_client = None
        try:
            or_client = get_openai_client()
        except Exception as oe:
            logger.warning(f"Could not get OpenRouter client: {oe}")

        if or_client:
            for or_model in openrouter_models:
                try:
                    response = or_client.chat.completions.create(
                        model=or_model,
                        messages=[
                            {"role": "system", "content": system_instruction},
                            {"role": "user", "content": user_content}
                        ],
                        temperature=0.1,
                        max_tokens=600,
                    )
                    raw = response.choices[0].message.content.strip()
                    parsed = AIPromptStrategy._clean_and_parse_json(raw)
                    if parsed and ("entry_rules" in parsed or "exit_rules" in parsed):
                        return parsed
                except Exception as e2:
                    logger.warning(f"OpenRouter model {or_model} failed: {e2}")

        logger.info("Using default rules as safe fallback")
        return DEFAULT_RULES

    @staticmethod
    def parse_prompt_sync(prompt: str) -> Dict[str, Any]:
        """نسخة متزامنة من المحلل"""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # في حال وجود event loop يعمل، نستخدم القواعد الافتراضية أو ننشئ مهمة
                return DEFAULT_RULES
            return loop.run_until_complete(AIPromptStrategy.parse_prompt_async(prompt))
        except Exception:
            return DEFAULT_RULES

    @staticmethod
    def _clean_and_parse_json(raw_text: str) -> Dict[str, Any]:
        """تنظيف النص واستخراج الـ JSON"""
        cleaned = re.sub(r"^```(?:json)?", "", raw_text, flags=re.MULTILINE)
        cleaned = re.sub(r"```$", "", cleaned, flags=re.MULTILINE).strip()
        try:
            data = json.loads(cleaned)
            if "entry_rules" in data or "exit_rules" in data:
                return data
            # إذا كان الناتج بدون nesting
            return {
                "entry_rules": data.get("entry", data),
                "exit_rules": data.get("exit", {})
            }
        except Exception as err:
            logger.warning(f"Failed to parse cleaned JSON: {err}. Raw: {raw_text[:100]}")
            return DEFAULT_RULES
