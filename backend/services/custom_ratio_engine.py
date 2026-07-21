"""
services/custom_ratio_engine.py

Parses and safely evaluates user-authored custom ratio formulas (e.g. the
"Graham Number" = (EPS * 22.5 * Book Value) ^ 0.5) built in the Custom Ratios
page's Formula Builder.

Formulas are plain text containing literal variable labels (exactly as shown
in the Variable Library picker, e.g. "EPS (TTM)", "P/E Ratio") mixed with
numbers and arithmetic operators/parentheses. This module:
  1. Tokenizes a formula by matching known variable labels (longest first, so
     "EPS (TTM)" isn't partially swallowed by a shorter overlapping label).
  2. Resolves each matched variable to a live numeric value using the same
     aggregated FinEdge company profile the company page already fetches
     (see routers/finedge.py::_build_company_profile) — no separate FinEdge
     endpoint is hit just for this.
  3. Evaluates the resulting arithmetic expression through a restricted AST
     walker (no `eval`/`exec`) so a formula can never execute arbitrary code.
"""

import ast
import math
import operator
import re
from dataclasses import dataclass
from typing import Any, Optional


class FormulaError(ValueError):
    """Raised for any formula the user needs to fix — message is safe to show as-is."""


# ── Variable catalog ──────────────────────────────────────────────────────────
# Mirrors frontend/src/lib/data/screener.ts `variables` exactly (id + label).
# Each id maps to a resolver over the dict returned by
# routers.finedge._build_company_profile(). A resolver returning None means
# "not derivable from current data sources" — the evaluator reports that
# plainly rather than inventing a number.

def _ratios(p: dict) -> dict:
    return p.get("ratios") or {}


VARIABLE_CATALOG: list[dict[str, str]] = [
    {"id": "marketCap", "label": "Market Cap"},
    {"id": "pe", "label": "P/E Ratio"},
    {"id": "pb", "label": "P/B Ratio"},
    {"id": "ps", "label": "P/S Ratio"},
    {"id": "evEbitda", "label": "EV/EBITDA"},
    {"id": "evSales", "label": "EV/Sales"},
    {"id": "faceValue", "label": "Face Value"},
    {"id": "eps", "label": "EPS (TTM)"},
    {"id": "bookValue", "label": "Book Value Per Share"},
    {"id": "priceToBV", "label": "Price to Book Value"},
    {"id": "roe", "label": "ROE"},
    {"id": "roce", "label": "ROCE"},
    {"id": "roa", "label": "ROA"},
    {"id": "netProfitMargin", "label": "Net Profit Margin"},
    {"id": "ebitdaMargin", "label": "EBITDA Margin"},
    {"id": "grossMargin", "label": "Gross Profit Margin"},
    {"id": "operatingMargin", "label": "Operating Margin"},
    {"id": "taxRate", "label": "Effective Tax Rate"},
    {"id": "debtToEquity", "label": "Debt to Equity"},
    {"id": "currentRatio", "label": "Current Ratio"},
    {"id": "quickRatio", "label": "Quick Ratio"},
    {"id": "interestCoverage", "label": "Interest Coverage"},
    {"id": "debtToEbitda", "label": "Debt / EBITDA"},
    {"id": "totalDebt", "label": "Total Debt"},
    {"id": "cashAndEquivalents", "label": "Cash & Equivalents"},
    {"id": "netDebt", "label": "Net Debt"},
    {"id": "salesGrowth1Y", "label": "Sales Growth (1Y)"},
    {"id": "salesGrowth3Y", "label": "Sales Growth (3Y CAGR)"},
    {"id": "salesGrowth5Y", "label": "Sales Growth (5Y CAGR)"},
    {"id": "profitGrowth1Y", "label": "Profit Growth (1Y)"},
    {"id": "profitGrowth3Y", "label": "Profit Growth (3Y CAGR)"},
    {"id": "profitGrowth5Y", "label": "Profit Growth (5Y CAGR)"},
    {"id": "epsGrowth", "label": "EPS Growth (3Y CAGR)"},
    {"id": "quarterlyProfitGrowth", "label": "Quarterly Profit Growth (YoY)"},
    {"id": "quarterlySalesGrowth", "label": "Quarterly Sales Growth (YoY)"},
    {"id": "ebitdaGrowth1Y", "label": "EBITDA Growth (1Y)"},
    {"id": "promoterPledge", "label": "Promoter Pledge %"},
    {"id": "promoterHoldingChange", "label": "Promoter Holding Change (6M)"},
    {"id": "payoutRatio", "label": "Payout Ratio"},
    {"id": "retainedEarningsGrowth", "label": "Retained Earnings Growth"},
    {"id": "dividendYield", "label": "Dividend Yield"},
    {"id": "dividendPerShare", "label": "Dividend Per Share"},
    {"id": "dividendGrowth5Y", "label": "Dividend Growth (5Y CAGR)"},
    {"id": "consecutiveDividendYears", "label": "Consecutive Dividend Years"},
    {"id": "cmp", "label": "CMP"},
    {"id": "high52w", "label": "52-Week High"},
    {"id": "low52w", "label": "52-Week Low"},
    {"id": "fromHigh52w", "label": "From 52W High %"},
    {"id": "fromLow52w", "label": "From 52W Low %"},
    {"id": "volumeAvg", "label": "Avg Volume (20D)"},
    {"id": "volumeRatio", "label": "Volume Ratio"},
    {"id": "beta", "label": "Beta (1Y)"},
    {"id": "rsi14", "label": "RSI (14)"},
    {"id": "sma50", "label": "SMA 50"},
    {"id": "sma200", "label": "SMA 200"},
    {"id": "priceVsSma50", "label": "CMP vs SMA 50 %"},
    {"id": "priceVsSma200", "label": "CMP vs SMA 200 %"},
    {"id": "revenue", "label": "Revenue (TTM)"},
    {"id": "netProfit", "label": "Net Profit (TTM)"},
    {"id": "totalAssets", "label": "Total Assets"},
    {"id": "netWorth", "label": "Net Worth"},
    {"id": "enterpriseValue", "label": "Enterprise Value"},
    {"id": "assetTurnover", "label": "Asset Turnover"},
    {"id": "inventoryTurnover", "label": "Inventory Turnover"},
    {"id": "debtorDays", "label": "Debtor Days"},
    {"id": "inventoryDays", "label": "Inventory Days"},
    {"id": "payableDays", "label": "Payable Days"},
    {"id": "cashConversionCycle", "label": "Cash Conversion Cycle"},
    {"id": "workingCapitalDays", "label": "Working Capital Days"},
    {"id": "capexToSales", "label": "Capex / Sales %"},
    {"id": "freeCashFlow", "label": "Free Cash Flow"},
    {"id": "promoterHolding", "label": "Promoter Holding"},
    {"id": "fiiHolding", "label": "FII Holding"},
    {"id": "diiHolding", "label": "DII Holding"},
    {"id": "publicHolding", "label": "Public Holding"},
    {"id": "fiiHoldingChange", "label": "FII Holding Change (6M)"},
    {"id": "diiHoldingChange", "label": "DII Holding Change (6M)"},
]

_LABEL_BY_ID = {v["id"]: v["label"] for v in VARIABLE_CATALOG}
# Longest label first so "EPS (TTM)" is matched whole before any shorter overlap.
_CATALOG_BY_LABEL_LEN_DESC = sorted(VARIABLE_CATALOG, key=lambda v: -len(v["label"]))


def _resolve_variable(var_id: str, profile: dict) -> Optional[float]:
    p, r = profile, _ratios(profile)

    def num(v: Any) -> Optional[float]:
        if v is None:
            return None
        try:
            f = float(v)
        except (TypeError, ValueError):
            return None
        return f

    price, high52w, low52w = num(p.get("price")), num(p.get("high52w")), num(p.get("low52w"))
    market_cap, sales, opm = num(p.get("marketCap")), num(r.get("sales")), num(r.get("opm"))
    debt, pfcf = num(r.get("debt")), num(r.get("priceToFreeCashFlow"))
    pe_eff = num(r.get("industryPE")) or num(p.get("pe"))

    simple = {
        "marketCap": market_cap,
        "pe": num(p.get("pe")),
        "pb": num(r.get("priceToBookValue")),
        "ps": num(r.get("priceToSales")),
        "evEbitda": num(r.get("evEbitda")),
        "faceValue": num(p.get("faceValue")),
        "eps": num(p.get("eps")),
        "bookValue": num(p.get("bookValue")),
        "priceToBV": num(r.get("priceToBookValue")),
        "roe": num(p.get("roe")),
        "roce": num(p.get("roce")),
        "roa": num(r.get("returnOnAssets")),
        "netProfitMargin": num(p.get("netProfitMargin")),
        "operatingMargin": opm,
        "debtToEquity": num(p.get("debtToEquity")),
        "currentRatio": num(r.get("currentRatio")),
        "interestCoverage": num(r.get("interestCoverageRatio")),
        "totalDebt": debt,
        "salesGrowth1Y": num(r.get("salesGrowth")),
        "profitGrowth1Y": num(r.get("profitGrowth")),
        "quarterlyProfitGrowth": num(r.get("yoyQuarterlyProfitGrowth")),
        "quarterlySalesGrowth": num(r.get("yoyQuarterlySalesGrowth")),
        "promoterPledge": num(r.get("pledgedPercentage")),
        "promoterHoldingChange": num(r.get("changeInPromoterHolding")),
        "dividendYield": num(p.get("dividendYield")),
        "cmp": price,
        "high52w": high52w,
        "low52w": low52w,
        "revenue": sales,
        "netProfit": num(r.get("profitAfterTax")),
        "enterpriseValue": num(r.get("enterpriseValue")),
        "cashConversionCycle": num(r.get("cashCycle")),
        "promoterHolding": num(p.get("promoterHolding")),
        "fiiHolding": num(p.get("fiiHolding")),
        "diiHolding": num(p.get("diiHolding")),
        "publicHolding": num(p.get("publicHolding")),
    }
    if var_id in simple:
        return round(simple[var_id], 4) if simple[var_id] is not None else None

    if var_id == "evSales" and market_cap is not None and debt is not None and sales:
        return round((market_cap + debt) / sales, 4)
    if var_id == "debtToEbitda" and debt is not None and sales is not None and opm is not None:
        ebitda = sales * opm / 100
        return round(debt / ebitda, 4) if ebitda else None
    if var_id == "fromHigh52w" and price is not None and high52w:
        return round((price - high52w) / high52w * 100, 4)
    if var_id == "fromLow52w" and price is not None and low52w:
        return round((price - low52w) / low52w * 100, 4)
    if var_id == "volumeAvg":
        return num(p.get("volume"))
    if var_id == "freeCashFlow" and market_cap is not None and pfcf:
        return round(market_cap / pfcf, 4)

    return None


# ── Safe arithmetic evaluator (AST walker — no eval/exec) ────────────────────

_BINOPS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod,
}
_UNARYOPS = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_FUNCS = {
    "sqrt": math.sqrt, "abs": abs, "min": min, "max": max,
    "round": round, "log": math.log, "log10": math.log10,
}
_TOKEN_RE = re.compile(r"^__v(\d+)__$")


def _eval_node(node: ast.AST, values: dict[str, float]) -> float:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body, values)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise FormulaError("Formula may only contain numbers, variables and operators.")
        return float(node.value)
    if isinstance(node, ast.BinOp) and type(node.op) in _BINOPS:
        left, right = _eval_node(node.left, values), _eval_node(node.right, values)
        try:
            return _BINOPS[type(node.op)](left, right)
        except ZeroDivisionError:
            raise FormulaError("Formula divides by zero for this company's data.")
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARYOPS:
        return _UNARYOPS[type(node.op)](_eval_node(node.operand, values))
    if isinstance(node, ast.Name):
        if node.id in values:
            return values[node.id]
        raise FormulaError(f"Unrecognized variable or text in formula: '{node.id}'.")
    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id in _FUNCS and not node.keywords:
            args = [_eval_node(a, values) for a in node.args]
            try:
                return float(_FUNCS[node.func.id](*args))
            except (ValueError, TypeError):
                raise FormulaError(f"Invalid arguments to {node.func.id}(...).")
        raise FormulaError("Only sqrt, abs, min, max, round, log, log10 functions are allowed.")
    raise FormulaError("Formula contains an expression that isn't supported.")


@dataclass
class TokenizedFormula:
    expr: str
    token_to_var_id: dict[str, str]


def tokenize_formula(formula: str) -> TokenizedFormula:
    if not formula or not formula.strip():
        raise FormulaError("Formula is empty.")

    working = formula
    token_to_var_id: dict[str, str] = {}
    for var in _CATALOG_BY_LABEL_LEN_DESC:
        label = var["label"]
        pattern = re.compile(re.escape(label), re.IGNORECASE)
        if pattern.search(working):
            token = f"__v{len(token_to_var_id)}__"
            token_to_var_id[token] = var["id"]
            working = pattern.sub(token, working)

    working = working.replace("^", "**")
    return TokenizedFormula(expr=working, token_to_var_id=token_to_var_id)


def validate_formula_syntax(formula: str) -> list[str]:
    """Checks the formula parses and every referenced identifier is either a
    known variable or an allowed function — without needing live company
    data. Returns the list of variable labels used. Raises FormulaError."""
    tokenized = tokenize_formula(formula)
    try:
        tree = ast.parse(tokenized.expr, mode="eval")
    except SyntaxError:
        raise FormulaError("Formula has invalid syntax — check parentheses and operators.")

    dummy_values = {tok: 1.0 for tok in tokenized.token_to_var_id}
    _eval_node(tree, dummy_values)  # raises FormulaError on unknown names/calls
    return [_LABEL_BY_ID[vid] for vid in tokenized.token_to_var_id.values()]


async def evaluate_formula(formula: str, symbol: str, rid: str) -> dict:
    """Tokenizes, resolves each variable against the live FinEdge-backed
    company profile, and safely evaluates the arithmetic. Returns a dict with
    either a numeric `value` or a clear reason it couldn't be computed."""
    from routers.finedge import _build_company_profile  # local import avoids a circular import at module load

    sym = symbol.strip().upper()
    tokenized = tokenize_formula(formula)

    try:
        tree = ast.parse(tokenized.expr, mode="eval")
    except SyntaxError:
        raise FormulaError("Formula has invalid syntax — check parentheses and operators.")

    profile = await _build_company_profile(sym, {}, rid)

    resolved: dict[str, float] = {}
    missing: list[str] = []
    for token, var_id in tokenized.token_to_var_id.items():
        value = _resolve_variable(var_id, profile)
        if value is None:
            missing.append(_LABEL_BY_ID[var_id])
        else:
            resolved[token] = value

    resolved_labels = {
        _LABEL_BY_ID[var_id]: resolved[tok]
        for tok, var_id in tokenized.token_to_var_id.items()
        if tok in resolved
    }

    if missing:
        return {
            "success": False,
            "symbol": sym,
            "missingVariables": missing,
            "resolvedVariables": resolved_labels,
            "message": f"No live data available for: {', '.join(missing)}.",
        }

    value = _eval_node(tree, resolved)
    return {
        "success": True,
        "symbol": sym,
        "value": round(value, 4),
        "resolvedVariables": resolved_labels,
    }
