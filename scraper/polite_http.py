"""A polite HTTP fetcher: obeys robots.txt (including `*` and `$` wildcards,
which urllib.robotparser does not understand), waits the site's crawl-delay
between requests to the same host, and fetches one URL at a time."""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlsplit

import httpx

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (compatible; PropertyComVeBot/1.0; +https://property.com.ve/about)"


class RobotsRules:
    def __init__(self, text: str, agent: str = "*"):
        self.allow: list = []
        self.disallow: list = []
        self.crawl_delay: Optional[float] = None
        self.sitemaps: list = []
        self._parse(text or "", agent)

    def _parse(self, text: str, agent: str):
        groups = []           # list of (agents, lines)
        cur_agents, cur_lines, last_was_agent = [], [], False
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if not line or ":" not in line:
                continue
            k, v = line.split(":", 1)
            k, v = k.strip().lower(), v.strip()
            if k == "sitemap":
                self.sitemaps.append(v)
                continue
            if k == "user-agent":
                if not last_was_agent and cur_agents:
                    groups.append((cur_agents, cur_lines))
                    cur_agents, cur_lines = [], []
                cur_agents.append(v.lower())
                last_was_agent = True
            else:
                cur_lines.append((k, v))
                last_was_agent = False
        if cur_agents:
            groups.append((cur_agents, cur_lines))
        chosen = [g for g in groups if agent.lower() in g[0]] or [g for g in groups if "*" in g[0]]
        for _, lines in chosen:
            for k, v in lines:
                if k == "allow" and v:
                    self.allow.append(v)
                elif k == "disallow" and v:
                    self.disallow.append(v)
                elif k == "crawl-delay":
                    try:
                        self.crawl_delay = float(v)
                    except ValueError:
                        pass

    @staticmethod
    def _to_regex(pattern: str):
        anchored = pattern.endswith("$")
        if anchored:
            pattern = pattern[:-1]
        rx = "".join(".*" if c == "*" else re.escape(c) for c in pattern)
        return re.compile("^" + rx + ("$" if anchored else ""))

    def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        path = parts.path or "/"
        if parts.query:
            path += "?" + parts.query
        best_len, best_allow = -1, True
        for pat in self.allow:
            if self._to_regex(pat).match(path) and len(pat) > best_len:
                best_len, best_allow = len(pat), True
        for pat in self.disallow:
            # On equal length, Allow wins (Google's rule)
            if self._to_regex(pat).match(path) and len(pat) > best_len:
                best_len, best_allow = len(pat), False
        return best_allow


@dataclass
class FetchResult:
    url: str
    status: int
    text: str = ""
    content: bytes = b""
    headers: dict = None
    error: Optional[str] = None

    @property
    def ok(self) -> bool:
        return self.error is None and 200 <= self.status < 300

    @property
    def gone(self) -> bool:
        return self.status in (404, 410)


class PoliteFetcher:
    def __init__(self, min_delay: dict = None, timeout: float = 30.0):
        """min_delay: {host: seconds}; the larger of this and robots' crawl-delay applies."""
        self.client = httpx.Client(
            timeout=timeout, follow_redirects=True,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "es-VE,es;q=0.9,en;q=0.5"},
        )
        self.min_delay = min_delay or {}
        self.robots: dict = {}
        self.last_hit: dict = {}
        self.requests = 0
        self.slowdown: dict = {}     # host -> multiplier after a 429
        self.max_retries = 3

    def _host(self, url: str) -> str:
        return urlsplit(url).netloc.lower()

    def rules_for(self, url: str) -> RobotsRules:
        host = self._host(url)
        if host not in self.robots:
            scheme = urlsplit(url).scheme or "https"
            robots_url = f"{scheme}://{host}/robots.txt"
            text = ""
            try:
                self._wait(host, 1.0)
                r = self.client.get(robots_url)
                self.requests += 1
                self.last_hit[host] = time.monotonic()
                # A redirect to another host's robots.txt: follow it (httpx did)
                if r.status_code == 200:
                    text = r.text
                elif 400 <= r.status_code < 500:
                    text = ""   # no robots file: everything allowed
                else:
                    raise RuntimeError(f"robots.txt {robots_url} returned {r.status_code}")
            except httpx.HTTPError as e:
                raise RuntimeError(f"robots.txt {robots_url} unreachable: {e}")
            self.robots[host] = RobotsRules(text)
            logger.info(f"robots.txt {host}: crawl-delay={self.robots[host].crawl_delay} "
                        f"disallow={self.robots[host].disallow}")
        return self.robots[host]

    def delay_for(self, url: str) -> float:
        rules = self.rules_for(url)
        return max(rules.crawl_delay or 0.0, self.min_delay.get(self._host(url), 1.0))

    def _wait(self, host: str, delay: float):
        last = self.last_hit.get(host)
        if last is not None:
            gap = time.monotonic() - last
            if gap < delay:
                time.sleep(delay - gap)

    def get(self, url: str, binary: bool = False, check_robots: bool = True) -> FetchResult:
        host = self._host(url)
        if check_robots:
            rules = self.rules_for(url)
            if not rules.allowed(url):
                return FetchResult(url, 0, error="disallowed by robots.txt")
            delay = self.delay_for(url)
        else:
            delay = self.min_delay.get(host, 1.0)
        delay *= self.slowdown.get(host, 1.0)
        for attempt in range(self.max_retries + 1):
            self._wait(host, delay)
            try:
                r = self.client.get(url)
                res = FetchResult(url, r.status_code, headers=dict(r.headers))
                if binary:
                    res.content = r.content
                else:
                    res.text = r.text
                if r.status_code >= 400 and r.status_code not in (404, 410):
                    res.error = f"HTTP {r.status_code}"
            except httpx.HTTPError as e:
                res = FetchResult(url, 0, error=f"{type(e).__name__}: {e}")
            finally:
                self.requests += 1
                self.last_hit[host] = time.monotonic()
            # Rate-limited or server trouble: back off, and slow down for the rest of the run
            if res.status in (429, 503) or (res.status >= 500) or res.status == 0:
                if attempt == self.max_retries:
                    break
                retry_after = 0.0
                try:
                    retry_after = float((res.headers or {}).get("retry-after", 0))
                except ValueError:
                    pass
                wait = max(retry_after, 30.0 * (2 ** attempt))
                if res.status == 429:
                    self.slowdown[host] = min(8.0, self.slowdown.get(host, 1.0) * 2)
                    delay = max(delay, (self.min_delay.get(host, 1.0)) * self.slowdown[host])
                logger.warning(f"{host}: {res.status or res.error}; waiting {wait:.0f}s "
                               f"(attempt {attempt + 1}/{self.max_retries}, delay now {delay:.1f}s)")
                time.sleep(wait)
                continue
            break
        return res
