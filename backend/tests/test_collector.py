"""Collector tests with httpx.AsyncClient.get monkeypatched (no network)."""

import asyncio
import logging

import httpx
import pytest

from backend import serpapi_collector as collector

FAKE_KEY = "test-secret-key-123"


def _response(payload):
    return httpx.Response(200, json=payload, request=httpx.Request("GET", collector.SERPAPI_URL))


@pytest.fixture
def fake_get(monkeypatch):
    monkeypatch.setenv("SERPAPI_API_KEY", FAKE_KEY)
    state = {"inflight": 0, "max_inflight": 0, "timeouts": [], "fail_queries": 0, "fail_all": False,
             "queries": [], "maps": {}}

    async def get(self, url, params=None, timeout=None, **kwargs):
        state["timeouts"].append((params["engine"], timeout))
        if params["engine"] == "google_maps":
            return _response(state["maps"])
        state["queries"].append(params["q"])
        state["inflight"] += 1
        state["max_inflight"] = max(state["max_inflight"], state["inflight"])
        await asyncio.sleep(0.01)
        state["inflight"] -= 1
        if state["fail_all"] or state["fail_queries"] > 0:
            state["fail_queries"] -= 1
            raise httpx.ConnectError(f"boom {url}?api_key={params['api_key']}")
        if params["engine"] == "google_news":
            return _response({"news_results": [{"title": "Bellandur news item", "link": "https://e.com/n"}]})
        organic = state.get("organic") or [{"title": "Bellandur web item", "link": "https://e.com/w"}]
        return _response({"organic_results": organic})

    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    return state


def collect():
    return asyncio.run(collector.collect_location_signals("Bellandur", "warehouse", 12.93, 77.67))


def test_searches_run_in_parallel(fake_get):
    result = collect()
    assert fake_get["max_inflight"] == 5
    assert result["failed_searches"] == 0
    assert result["total_searches"] == 5


def test_timeouts(fake_get):
    collect()
    timeouts = dict(fake_get["timeouts"])
    assert timeouts["google_maps"] == 8.0
    assert {t for e, t in fake_get["timeouts"] if e != "google_maps"} == {10.0}


def test_partial_failures_are_counted(fake_get):
    fake_get["fail_queries"] = 2
    result = collect()
    assert result["failed_searches"] == 2
    assert result["total_signals"] == 3


def test_all_failures_raise(fake_get):
    fake_get["fail_all"] = True
    with pytest.raises(RuntimeError):
        collect()


def test_failures_logged_without_key_or_url(fake_get, caplog):
    fake_get["fail_queries"] = 2
    with caplog.at_level(logging.DEBUG):
        collect()
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 2
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert FAKE_KEY not in text
    assert "serpapi.com/search.json?" not in text


@pytest.mark.parametrize(
    "address, expected",
    [
        ("Bellandur, Bengaluru, Karnataka 560103", ("Bellandur", None)),
        ("Outer Ring Rd, Bellandur, Bengaluru, Karnataka 560103", ("Outer Ring Rd", "Bellandur")),
        ("Sarjapur Main Rd, Dommasandra, Bengaluru, Karnataka 562125", ("Sarjapur Main Rd", "Dommasandra")),
        ("Peenya 2nd Stage, Peenya, Bangalore, Karnataka 560058, India", ("Peenya 2nd Stage", "Peenya")),
        ("12, 5th Cross Rd, HSR Layout Sector 2, HSR Layout, Bengaluru, Karnataka 560102",
         ("HSR Layout Sector 2", "HSR Layout")),
        ("Karnataka 560103, India", (None, None)),
    ],
)
def test_parse_address_parts(address, expected):
    assert collector.parse_address_parts(address) == expected


def test_no_corridor_is_left_out_of_queries(fake_get):
    fake_get["maps"] = {"place_results": {"title": "Bellandur", "address": "Bellandur, Bengaluru, Karnataka 560103"}}
    result = collect()
    assert result["corridor"] is None
    assert fake_get["queries"]
    for q in fake_get["queries"]:
        assert "None" not in q
        assert "Karnataka" not in q
        assert '""' not in q


def test_valid_corridor_is_used_in_queries(fake_get):
    fake_get["maps"] = {"place_results": {
        "title": "Bellandur Lake", "address": "Outer Ring Rd, Bellandur, Bengaluru, Karnataka 560103"}}
    result = collect()
    assert result["corridor"] == "Bellandur"
    assert sum('"Bellandur"' in q for q in fake_get["queries"]) >= 3


GOTO = "https://www.google.com/goto?url="


@pytest.mark.parametrize(
    "url, expected",
    [
        (GOTO + "https%3A%2F%2Fwww.thehindu.com%2Fnews%2Fa", "https://www.thehindu.com/news/a"),
        ("https://google.com/url?q=https://www.deccanherald.com/x&sa=U", "https://www.deccanherald.com/x"),
        ("https://www.google.com/amp/s/?url=https%3A%2F%2Fscroll.in%2Fa", "https://scroll.in/a"),
        (GOTO + "javascript%3Aalert(1)", None),
        ("https://www.google.com/goto?gsessionid=abc", None),
        (GOTO + "ftp%3A%2F%2Fexample.com%2Ff", None),
        (GOTO + "https%3A%2F%2F%2Fno-host", None),
        (GOTO + "https%3A%2F%2Fwww.google.com%2Furl%3Fq%3Dhttps%3A%2F%2Fe.com", None),
        (GOTO + "https%3A%2F%2Fe.com%2Fa%20b", None),
        ("https://www.thehindu.com/news/cities/bangalore/a.ece", "https://www.thehindu.com/news/cities/bangalore/a.ece"),
        ("https://evilgoogle.com/goto?url=https%3A%2F%2Fe.com", "https://evilgoogle.com/goto?url=https%3A%2F%2Fe.com"),
        ("https://www.google.com/maps/place/Bellandur", "https://www.google.com/maps/place/Bellandur"),
    ],
)
def test_unwrap_redirect_url(url, expected):
    assert collector.unwrap_redirect_url(url) == expected


def test_goto_links_unwrapped_before_synthesis(fake_get):
    from backend.synthesizer import synthesize_friction_report

    fake_get["organic"] = [
        {"title": "Bellandur lake overflow floods the ORR",
         "link": "https://www.deccanherald.com/city/flood", "displayed_link": "https://www.deccanherald.com › city"},
        {"title": "Catastrophic rainfall Bengaluru lakes overflow again",
         "link": GOTO + "https%3A%2F%2Fwww.facebook.com%2Fphoto%2F1", "displayed_link": "https://www.facebook.com › photo"},
        {"title": "Bellandur flooding leaves residents stranded again",
         "link": GOTO + "https%3A%2F%2Fwww.thehindu.com%2Fnews%2Fflood", "displayed_link": "30+ reactions"},
        {"title": "Bellandur drain overflow javascript link",
         "link": GOTO + "javascript%3Aalert(1)", "displayed_link": "1 year ago"},
        {"title": "Bellandur waterlogging with no url param", "link": "https://www.google.com/goto?gsessionid=x"},
    ]
    result = collect()
    by_url = {s["url"]: s for s in result["signals"] if s["category"] == "flooding_drainage"}
    assert set(by_url) == {
        "https://www.facebook.com/photo/1",
        "https://www.thehindu.com/news/flood",
        "https://www.deccanherald.com/city/flood",
    }
    assert by_url["https://www.thehindu.com/news/flood"]["source"] == "thehindu.com"
    assert by_url["https://www.deccanherald.com/city/flood"]["source"] == "deccanherald.com"
    assert not any("google.com" in s["url"] for s in result["signals"])

    report = asyncio.run(synthesize_friction_report("Bellandur", "warehouse", result))
    urls = {f["url"] for f in report["flags"]}
    assert "https://www.facebook.com/photo/1" not in urls
    assert "https://www.thehindu.com/news/flood" in urls


def test_named_source_is_kept(fake_get):
    fake_get["organic"] = [{"title": "Bellandur flood item", "link": GOTO + "https%3A%2F%2Fwww.thehindu.com%2Fa",
                            "displayed_link": "The Hindu"}]
    result = collect()
    organic = [s for s in result["signals"] if s["category"] != "civic_incident"]
    assert {s["source"] for s in organic} == {"The Hindu"}


@pytest.mark.parametrize("link", ["", "javascript:alert(1)", "/relative/path", "ftp://e.com/f"])
def test_signals_without_http_url_are_dropped(fake_get, link):
    fake_get["organic"] = [{"title": "Bellandur flood item", "link": link, "displayed_link": "Civic Source"}]
    result = collect()
    organic = [s for s in result["signals"] if s["category"] != "civic_incident"]
    assert organic == []
