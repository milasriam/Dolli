#!/usr/bin/env python3
"""
Idempotent pack of demo campaigns for staging / QA (Dolli scenario lab).

Inserts rows only if none exist with titles starting with DEMO_TITLE_PREFIX.
Requires DATABASE_URL in the environment. Run from repo root:

  cd app/backend && export DATABASE_URL=... && python ../../scripts/seed_demo_campaigns.py

Or from server after deploy (venv + DATABASE_URL from env file).
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent / "app" / "backend"
sys.path.insert(0, str(_BACKEND))
os.chdir(_BACKEND)

from models.campaigns import Campaigns  # noqa: E402
from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

DEMO_TITLE_PREFIX = "[DEMO] Scenario Lab | "
SEED_USER_ID = "system-seed-user"


def _normalize_async_database_url(raw_url: str) -> str:
    url = make_url(raw_url.strip())
    dn = url.drivername or ""
    if "+aiosqlite" in dn or "+asyncpg" in dn or "+aiomysql" in dn:
        return str(url)
    if dn == "sqlite":
        return str(url.set(drivername="sqlite+aiosqlite"))
    if dn in ("postgresql", "postgres"):
        return str(url.set(drivername="postgresql+asyncpg"))
    if dn in ("mysql",):
        return str(url.set(drivername="mysql+aiomysql"))
    if dn in ("mariadb",):
        return str(url.set(drivername="mariadb+aiomysql"))
    return raw_url.strip()


def _rows() -> list[dict]:
    """Rich scenario set: early-wave / featured style, drafts, completed, NSFW, media variants."""
    T = DEMO_TITLE_PREFIX
    u = SEED_USER_ID

    def dt(y, m, d, h=12, mi=0):
        return datetime(y, m, d, h, mi, 0, tzinfo=timezone.utc)

    return [
        {
            "user_id": u,
            "title": T + "Early wave — rooftop micro-farm for schools",
            "description": "Pilot from the first cohort: edible gardens on three school roofs, STEM curriculum, and weekly harvest for cafeterias.",
            "category": "education",
            "goal_amount": 4800,
            "raised_amount": 3920,
            "donor_count": 612,
            "share_count": 890,
            "click_count": 4100,
            "image_url": "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "high",
            "featured": True,
            "impact_statement": "Funds one week of soil & seedlings for one classroom bed",
            "is_nsfw": False,
            "created_at": dt(2026, 3, 10, 9, 30),
        },
        {
            "user_id": u,
            "title": T + "Early wave — night bus for unhoused neighbors",
            "description": "Featured early partner scenario: safe rides, warm meals, and hygiene kits on a fixed nightly route.",
            "category": "community",
            "goal_amount": 12000,
            "raised_amount": 8400,
            "donor_count": 1204,
            "share_count": 2100,
            "click_count": 9800,
            "image_url": "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80",
            "gif_url": None,
            "video_url": "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
            "status": "active",
            "urgency_level": "high",
            "featured": True,
            "impact_statement": "Covers fuel and one meal for one rider for one night",
            "is_nsfw": False,
            "created_at": dt(2026, 3, 12, 18, 0),
        },
        {
            "user_id": u,
            "title": T + "Draft — makerspace for teens (not published)",
            "description": "Scenario: organizer still editing copy, goal, and media before launch.",
            "category": "innovation",
            "goal_amount": 6500,
            "raised_amount": 0,
            "donor_count": 0,
            "share_count": 0,
            "click_count": 12,
            "image_url": "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "draft",
            "urgency_level": "medium",
            "featured": False,
            "impact_statement": "Will buy one soldering station + safety kit",
            "is_nsfw": False,
            "created_at": dt(2026, 4, 2, 14, 15),
        },
        {
            "user_id": u,
            "title": T + "Completed — community fridge season 1",
            "description": "Scenario: successful close; archive-style story for UI testing.",
            "category": "food",
            "goal_amount": 2500,
            "raised_amount": 2680,
            "donor_count": 441,
            "share_count": 600,
            "click_count": 3200,
            "image_url": "https://images.unsplash.com/photo-1593113598338-c2881a88f6b0?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "completed",
            "urgency_level": "low",
            "featured": False,
            "impact_statement": "Stocked the public fridge for a full winter",
            "is_nsfw": False,
            "created_at": dt(2026, 2, 1, 11, 0),
        },
        {
            "user_id": u,
            "title": T + "Zero traction — river cleanup weekend",
            "description": "Scenario: live campaign with almost no engagement (empty social proof).",
            "category": "environment",
            "goal_amount": 800,
            "raised_amount": 35,
            "donor_count": 3,
            "share_count": 2,
            "click_count": 48,
            "image_url": "https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "medium",
            "featured": False,
            "impact_statement": "Buys gloves and bags for one volunteer shift",
            "is_nsfw": False,
            "created_at": dt(2026, 4, 5, 8, 0),
        },
        {
            "user_id": u,
            "title": T + "GIF-first — adoptable senior dogs spotlight",
            "description": "Scenario: hero motion via GIF; tests motion-heavy cards.",
            "category": "animals",
            "goal_amount": 2200,
            "raised_amount": 980,
            "donor_count": 210,
            "share_count": 340,
            "click_count": 1500,
            "image_url": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200&q=80",
            "gif_url": "https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif",
            "video_url": None,
            "status": "active",
            "urgency_level": "high",
            "featured": True,
            "impact_statement": "Covers meds and food for one senior dog for a month",
            "is_nsfw": False,
            "created_at": dt(2026, 3, 22, 16, 45),
        },
        {
            "user_id": u,
            "title": T + "Housing — legal aid retainers for eviction defense",
            "description": "Scenario: justice + housing crossover; sober tone, medium urgency.",
            "category": "justice",
            "goal_amount": 15000,
            "raised_amount": 6200,
            "donor_count": 88,
            "share_count": 120,
            "click_count": 890,
            "image_url": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "medium",
            "featured": False,
            "impact_statement": "Funds one hour of paralegal time",
            "is_nsfw": False,
            "created_at": dt(2026, 3, 28, 10, 0),
        },
        {
            "user_id": u,
            "title": T + "Disaster — satellite phones for volunteer mesh",
            "description": "Scenario: disaster relief with high goal and strong momentum.",
            "category": "disaster",
            "goal_amount": 40000,
            "raised_amount": 28500,
            "donor_count": 903,
            "share_count": 4500,
            "click_count": 12000,
            "image_url": "https://images.unsplash.com/photo-1611273426858-450d8e36c897?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "high",
            "featured": True,
            "impact_statement": "Pays for one rugged handset + month of airtime",
            "is_nsfw": False,
            "created_at": dt(2026, 3, 15, 7, 0),
        },
        {
            "user_id": u,
            "title": T + "Arts — touring youth brass band (regional)",
            "description": "Scenario: arts & culture; moderate stats; tests gradient/category chip.",
            "category": "arts",
            "goal_amount": 9000,
            "raised_amount": 4100,
            "donor_count": 156,
            "share_count": 280,
            "click_count": 1100,
            "image_url": "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "low",
            "featured": False,
            "impact_statement": "Sponsors one school workshop + sheet music pack",
            "is_nsfw": False,
            "created_at": dt(2026, 3, 30, 15, 20),
        },
        {
            "user_id": u,
            "title": T + "Sports — adaptive sled hockey league fees",
            "description": "Scenario: sports category; family-friendly visuals.",
            "category": "sports",
            "goal_amount": 3200,
            "raised_amount": 3050,
            "donor_count": 402,
            "share_count": 510,
            "click_count": 2200,
            "image_url": "https://images.unsplash.com/photo-1517649763962-0c62306601b7?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "medium",
            "featured": False,
            "impact_statement": "Covers ice time for one team for one month",
            "is_nsfw": False,
            "created_at": dt(2026, 3, 19, 19, 0),
        },
        {
            "user_id": u,
            "title": T + "Children — bilingual story nights in clinics",
            "description": "Scenario: children & health adjacent; soft urgency.",
            "category": "children",
            "goal_amount": 1800,
            "raised_amount": 720,
            "donor_count": 134,
            "share_count": 190,
            "click_count": 760,
            "image_url": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "medium",
            "featured": False,
            "impact_statement": "Prints 40 picture books in two languages",
            "is_nsfw": False,
            "created_at": dt(2026, 4, 3, 13, 30),
        },
        {
            "user_id": u,
            "title": T + "Faith — interfaith meal trains after floods",
            "description": "Scenario: faith communities + disaster adjacent logistics.",
            "category": "faith",
            "goal_amount": 5500,
            "raised_amount": 1200,
            "donor_count": 67,
            "share_count": 95,
            "click_count": 400,
            "image_url": "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "high",
            "featured": False,
            "impact_statement": "Feeds one family of four for three days",
            "is_nsfw": False,
            "created_at": dt(2026, 4, 6, 17, 0),
        },
        {
            "user_id": u,
            "title": T + "Veterans — small business micro-grants cohort",
            "description": "Scenario: veterans + innovation; higher average gift implied.",
            "category": "veterans",
            "goal_amount": 20000,
            "raised_amount": 15400,
            "donor_count": 210,
            "share_count": 340,
            "click_count": 1800,
            "image_url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "medium",
            "featured": True,
            "impact_statement": "Adds one $500 seed grant to the pool",
            "is_nsfw": False,
            "created_at": dt(2026, 3, 8, 12, 0),
        },
        {
            "user_id": u,
            "title": T + "Women — safe night rides for shift workers",
            "description": "Scenario: women's causes + community safety; featured strip.",
            "category": "women",
            "goal_amount": 7500,
            "raised_amount": 6100,
            "donor_count": 512,
            "share_count": 1200,
            "click_count": 5400,
            "image_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "high",
            "featured": True,
            "impact_statement": "Subsidizes five verified rides home",
            "is_nsfw": False,
            "created_at": dt(2026, 3, 25, 21, 30),
        },
        {
            "user_id": u,
            "title": T + "Memorial — scholarship in honor of a teacher",
            "description": "Scenario: memorial tone; long-form description for typography tests.",
            "category": "memorial",
            "goal_amount": 10000,
            "raised_amount": 2400,
            "donor_count": 58,
            "share_count": 70,
            "click_count": 290,
            "image_url": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "low",
            "featured": False,
            "impact_statement": "Funds one semester stipend for a student in need",
            "is_nsfw": False,
            "created_at": dt(2026, 3, 29, 9, 0),
        },
        {
            "user_id": u,
            "title": T + "Mature content — harm reduction & health literacy (18+)",
            "description": "Scenario: NSFW / sensitive flag; should be hidden when NSFW filter is on. Educational materials and confidential support line hours.",
            "category": "health",
            "goal_amount": 4000,
            "raised_amount": 900,
            "donor_count": 41,
            "share_count": 22,
            "click_count": 180,
            "image_url": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "medium",
            "featured": False,
            "impact_statement": "Extends hotline coverage by one hour",
            "is_nsfw": True,
            "created_at": dt(2026, 4, 4, 11, 45),
        },
        {
            "user_id": u,
            "title": T + "Tech — open API for transparent NGO ledgers",
            "description": "Scenario: innovation + transparency; developer-adjacent audience.",
            "category": "innovation",
            "goal_amount": 30000,
            "raised_amount": 4200,
            "donor_count": 95,
            "share_count": 400,
            "click_count": 2100,
            "image_url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80",
            "gif_url": None,
            "video_url": None,
            "status": "active",
            "urgency_level": "low",
            "featured": False,
            "impact_statement": "Pays for one week of hosted indexer uptime",
            "is_nsfw": False,
            "created_at": dt(2026, 4, 7, 10, 0),
        },
    ]


async def _run() -> int:
    raw = os.environ.get("DATABASE_URL", "").strip()
    if not raw:
        print("ERROR: DATABASE_URL is not set", file=sys.stderr)
        return 2

    url = _normalize_async_database_url(raw)
    engine = create_async_engine(url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    rows = _rows()
    async with factory() as session:
        q = select(func.count()).select_from(Campaigns).where(Campaigns.title.startswith(DEMO_TITLE_PREFIX))
        existing = await session.scalar(q)
        if existing and int(existing) > 0:
            print(f"OK: already seeded ({existing} rows with prefix {DEMO_TITLE_PREFIX!r})")
            await engine.dispose()
            return 0

        for r in rows:
            session.add(Campaigns(**r))
        await session.commit()
        print(f"OK: inserted {len(rows)} demo campaigns")

    await engine.dispose()
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(_run()))


if __name__ == "__main__":
    main()
