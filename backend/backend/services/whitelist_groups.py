"""
Whitelist Groups — تقسيم القائمة البيضاء (78 عملة) إلى 5 مجموعات ذكية.
"""

WHITELIST_GROUPS = {
    "leaders": {
        "name": "🔵 القادة",
        "name_ar": "القادة",
        "description": "العملات القيادية الأعلى سيولة وتأثيراً في السوق",
        "color": "#3b82f6",
        "symbols": [
            "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT",
            "BTC/USDC", "ETH/USDC", "ETH/BTC"
        ]
    },
    "layer1": {
        "name": "🟢 الطبقة الأولى",
        "name_ar": "الطبقة الأولى",
        "description": "بلوكتشينات الجيل القادم عالية الأداء",
        "color": "#22c55e",
        "symbols": [
            "ADA/USDT", "AVAX/USDT", "DOT/USDT", "NEAR/USDT",
            "ATOM/USDT", "ICP/USDT", "SUI/USDT", "TON/USDT",
            "FTM/USDT", "HBAR/USDT", "TIA/USDT", "SEI/USDT",
            "ADA/USDC", "AVAX/USDC", "DOT/USDC", "NEAR/USDC",
            "ATOM/USDC", "ADA/BTC", "AVAX/BTC", "DOT/BTC",
            "NEAR/BTC", "FTM/BTC", "ICP/BTC", "ATOM/BTC",
            "AVAX/ETH", "DOT/ETH"
        ]
    },
    "defi_layer2": {
        "name": "🟡 DeFi والطبقة الثانية",
        "name_ar": "ديفاي والطبقة الثانية",
        "description": "بروتوكولات التمويل اللامركزي وحلول التوسع",
        "color": "#eab308",
        "symbols": [
            "ARB/USDT", "OP/USDT", "LINK/USDT", "GRT/USDT",
            "STX/USDT", "RENDER/USDT", "WLD/USDT", "PYTH/USDT",
            "ARB/USDC", "OP/USDC", "LINK/USDC", "GRT/USDC",
            "LINK/BTC", "GRT/BTC", "LINK/ETH"
        ]
    },
    "classic": {
        "name": "⚪ الكلاسيكيات",
        "name_ar": "الكلاسيكيات",
        "description": "العملات الكلاسيكية الموثوقة ذات التاريخ الطويل",
        "color": "#94a3b8",
        "symbols": [
            "XRP/USDT", "LTC/USDT", "BCH/USDT", "XMR/USDT",
            "XLM/USDT", "ETC/USDT", "DOGE/USDT", "TRX/USDT",
            "VET/USDT", "FIL/USDT", "THETA/USDT",
            "XRP/USDC", "LTC/USDC", "BCH/USDC", "FIL/USDC",
            "XRP/BTC", "TRX/BTC", "DOGE/BTC", "BCH/BTC",
            "XMR/BTC", "XLM/BTC", "LTC/BTC",
            "ETC/BTC", "FIL/BTC", "VET/BTC", "THETA/BTC",
            "HBAR/BTC", "XRP/ETH"
        ]
    },
}

GROUP_ORDER = ["leaders", "layer1", "defi_layer2", "classic"]


def get_group_list() -> list:
    result = []
    for gid in GROUP_ORDER:
        if gid not in WHITELIST_GROUPS:
            continue
        g = WHITELIST_GROUPS[gid]
        result.append({
            "id": gid,
            "name": g["name"],
            "name_ar": g["name_ar"],
            "description": g["description"],
            "color": g["color"],
            "symbol_count": len(g["symbols"]),
            "symbols": g["symbols"]
        })
    return result


def get_symbols_for_groups(group_ids: list) -> list:
    if not group_ids or group_ids == ["all"] or "all" in group_ids:
        all_syms = []
        for gid in GROUP_ORDER:
            if gid in WHITELIST_GROUPS:
                all_syms.extend(WHITELIST_GROUPS[gid]["symbols"])
        return list(dict.fromkeys(all_syms))

    result = []
    for gid in group_ids:
        if gid in WHITELIST_GROUPS:
            result.extend(WHITELIST_GROUPS[gid]["symbols"])
    return list(dict.fromkeys(result))


def classify_symbol(symbol: str) -> str:
    for gid in GROUP_ORDER:
        if symbol in WHITELIST_GROUPS.get(gid, {}).get("symbols", []):
            return gid
    return "classic"
