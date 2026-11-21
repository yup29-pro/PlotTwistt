"""Directory/index/listing pages and promo openings are dropped before classification."""

import asyncio

import pytest

from backend.synthesizer import is_noise_title, synthesize_friction_report
from backend.tests.conftest import make_signals

# Headlines from the Phase 7 live smoke run (Bellandur / warehouse).
NOISE = [
    "Bengaluru Traffic Police - Index",
    "Marriott Executive Apartments Expands to Bellandur, Bengaluru, 102-key",
    "Marriott Executive Apartments Bellandur opens in Bengaluru",
    "Marriott opens second Executive Apartments in Bengaluru",
    "Marriott Executive Apartments expands in Bengaluru with opening of second property",
    # Same page shapes seen on other civic sites.
    "Bruhat Bengaluru Mahanagara Palike - Official Website",
    "Home | Bangalore Development Authority",
    "Contact Us - Bangalore Traffic Police",
]

REAL = [
    "#Karnataka: Waterlogging witnessed at the BTM layout, Silk Board junction",
    "Slums at Munekolalu and Bellandur were inundated due to heavy rain",
    "Karnataka High Court to BDA in land dispute",
    "Idea to reduce traffic congestion - ban trucks during day time",
    "Tempers fly, traffic crawls as vehicle restrictions kick in on ORR",
    "Flyover opens but waterlogging persists at Bellandur junction",
    "Homeowners in Bellandur protest stormwater drain encroachment",
]


@pytest.mark.parametrize("title", NOISE)
def test_noise_titles_detected(title):
    assert is_noise_title(title)


@pytest.mark.parametrize("title", REAL)
def test_real_friction_titles_kept(title):
    assert not is_noise_title(title)


def test_noise_dropped_from_report():
    signals = [
        {"title": t, "url": f"https://e.com/{i}", "source": "Test", "snippet": t}
        for i, t in enumerate(NOISE + REAL)
    ]
    report = asyncio.run(synthesize_friction_report("Bellandur", "warehouse", make_signals(signals)))
    assert report["total_flags"] == len(REAL)
    assert not any("Marriott" in f["headline"] or "Index" in f["headline"] for f in report["flags"])
