"""Applies one SQL file from backend/migrations/ against DATABASE_URL.

    python scripts/apply_migration.py 003_rag_and_research_chat.sql

Every migration in this project is written to be idempotent (create ... if not
exists / drop trigger if exists), so re-running one is safe and is the normal
way to bring a database that's already partly migrated up to date.

Statements are split on top-level semicolons and executed one at a time
because asyncpg refuses multi-statement strings when they contain parameters
or DDL that opens its own implicit transaction — and because a failure then
names the exact statement that broke instead of the whole file.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from core.database import engine

MIGRATIONS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "migrations"
)


def split_statements(sql: str) -> list[str]:
    """Split on semicolons that are not inside a comment, string literal or $$ block.

    All three exclusions are load-bearing against the migrations in this repo:
      -- comments      the prose headers contain both semicolons and
                       apostrophes ("doesn't"), either of which would derail a
                       naive splitter — so comments are dropped FIRST.
      '...' literals   default values and check constraints contain them.
      $$ ... $$        migration 001 defines set_updated_at() as a plpgsql
                       function whose BODY contains semicolons.
    """
    stripped: list[str] = []
    in_single = False
    in_dollar = False
    i = 0
    while i < len(sql):
        if not in_single and not in_dollar and sql.startswith("--", i):
            newline = sql.find("\n", i)
            i = len(sql) if newline == -1 else newline
            continue
        if not in_single and sql.startswith("$$", i):
            in_dollar = not in_dollar
            stripped.append("$$")
            i += 2
            continue
        ch = sql[i]
        if not in_dollar and ch == "'":
            in_single = not in_single
        stripped.append(ch)
        i += 1

    statements: list[str] = []
    buf: list[str] = []
    in_single = False
    in_dollar = False
    text_no_comments = "".join(stripped)
    i = 0
    while i < len(text_no_comments):
        if not in_single and text_no_comments.startswith("$$", i):
            in_dollar = not in_dollar
            buf.append("$$")
            i += 2
            continue
        ch = text_no_comments[i]
        if not in_dollar and ch == "'":
            in_single = not in_single
        if ch == ";" and not in_single and not in_dollar:
            statements.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    statements.append("".join(buf))

    return [s.strip() for s in statements if s.strip()]


async def main(filename: str) -> None:
    path = os.path.join(MIGRATIONS_DIR, filename)
    if not os.path.exists(path):
        raise SystemExit(f"No such migration: {path}")

    with open(path, "r", encoding="utf-8") as handle:
        sql = handle.read()

    statements = split_statements(sql)
    print(f"Applying {filename} — {len(statements)} statement(s)")

    async with engine.begin() as conn:
        for index, statement in enumerate(statements, start=1):
            head = " ".join(statement.split())[:90]
            print(f"  [{index}/{len(statements)}] {head}")
            await conn.execute(text(statement))

    await engine.dispose()
    print("Done.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python scripts/apply_migration.py <file.sql>")
    asyncio.run(main(sys.argv[1]))
