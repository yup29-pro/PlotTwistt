"""Directory/index/listing pages and promo openings are dropped before classification."""

import asyncio

import pytest

from backend.synthesizer import classify_signal, is_noise, is_noise_title, synthesize_friction_report
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


# Headlines from the second live run.
SOCIAL_AND_SHORT = [
    ("BENGALURU MORNING TRAFFIC ALERT ... - Facebook", "https://www.facebook.com/p/1"),
    ("BENGALURU MORNING TRAFFIC ALERT on ORR", "https://m.facebook.com/story/2"),
    ("Karnataka High Court", "https://karnatakajudiciary.kar.nic.in/"),
    ("Crime Files", "https://example.com/crime-files"),
]


@pytest.mark.parametrize("title, url", SOCIAL_AND_SHORT)
def test_social_posts_and_short_bare_titles_are_noise(title, url):
    assert is_noise(title, url)


@pytest.mark.parametrize(
    "title",
    ["Waterlogging update - Instagram", "Bellandur traffic today - X", "Road widening plan | LinkedIn"],
)
def test_social_title_suffixes_are_noise(title):
    assert is_noise(title, "https://example.com/post")


@pytest.mark.parametrize(
    "url", ["https://x.com/a/status/1", "https://twitter.com/a", "https://www.linkedin.com/posts/a", "https://instagram.com/p/1"]
)
def test_social_domains_are_noise(url):
    assert is_noise("Bellandur flood after heavy rain in the area", url)


@pytest.mark.parametrize(
    "title", ["Bellandur floods again", "Truck ban on ORR", "Crime rate rises in Bellandur"]
)
def test_short_titles_with_friction_keyword_kept(title):
    assert not is_noise(title, "https://example.com/news")


def test_city_wide_traffic_piece_is_not_noise():
    assert not is_noise("Bengaluru Traffic Alert: Avoid THESE Routes For Congestion", "https://example.com/t")


@pytest.mark.parametrize("title", REAL)
def test_earlier_real_headlines_still_kept(title):
    assert not is_noise(title, "https://example.com/news")


def test_bare_crime_label_is_not_friction():
    assert classify_signal("Crime Files", "warehouse") == ("civic_neighbor_friction", "low")
