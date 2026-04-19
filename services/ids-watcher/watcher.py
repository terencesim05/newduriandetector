"""DurianDetector IDS Watcher — tails IDS log files and pushes alerts
to the log-service ingestion API in real time.

Supports: Suricata (EVE JSON), Zeek (notice.log), Snort (JSON alerts),
and Kismet (REST API polling).

Usage:
    python watcher.py                   # uses config.yaml
    python watcher.py -c config.local.yaml
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import aiohttp
import yaml

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ids-watcher")


# ── Config ────────────────────────────────────────────────────────────

def load_config(path: str) -> dict:
    with open(path) as f:
        cfg = yaml.safe_load(f)
    return cfg


# ── API client ────────────────────────────────────────────────────────

class APIClient:
    """Batches alerts and POSTs them to the DurianDetector log-service."""

    def __init__(self, base_url: str, api_key: str, token: str, batch_size: int, batch_interval: float):
        self.url = f"{base_url.rstrip('/')}/api/logs/ingest"
        self.headers = {"Content-Type": "application/json"}
        if api_key:
            self.headers["X-API-Key"] = api_key
            log.info("Authenticating with API key")
        elif token:
            self.headers["Authorization"] = f"Bearer {token}"
            log.warning("Authenticating with JWT token — this will expire. Use an API key for production.")
        else:
            log.error("No API key or token configured. Requests will fail.")
        self.batch_size = batch_size
        self.batch_interval = batch_interval
        self._queue: asyncio.Queue = asyncio.Queue()
        self._session: aiohttp.ClientSession | None = None

    async def start(self):
        self._session = aiohttp.ClientSession()
        asyncio.create_task(self._flush_loop())

    async def stop(self):
        if self._session:
            await self._session.close()

    async def enqueue(self, field: str, alert: dict):
        """Add a parsed alert dict to the send queue."""
        await self._queue.put((field, alert))

    async def _flush_loop(self):
        while True:
            batch: dict[str, list] = {}
            deadline = time.monotonic() + self.batch_interval

            # Collect until batch is full or interval expires
            while sum(len(v) for v in batch.values()) < self.batch_size:
                timeout = max(0.1, deadline - time.monotonic())
                try:
                    field, alert = await asyncio.wait_for(self._queue.get(), timeout=timeout)
                    batch.setdefault(field, []).append(alert)
                except asyncio.TimeoutError:
                    break

            if batch:
                await self._send(batch)

    async def _send(self, batch: dict[str, list]):
        total = sum(len(v) for v in batch.values())
        try:
            async with self._session.post(self.url, json=batch, headers=self.headers) as resp:
                if resp.status == 200:
                    body = await resp.json()
                    log.info("Ingested %d/%d alerts", body.get("ingested", total), total)
                else:
                    text = await resp.text()
                    log.error("Ingest failed (%d): %s", resp.status, text[:200])
        except aiohttp.ClientError as e:
            log.error("Connection error: %s", e)


# ── File tailer ───────────────────────────────────────────────────────

async def tail_file(path: str):
    """Async generator that yields new lines appended to a file.
    Starts from the end of the file (only new data)."""
    while not os.path.exists(path):
        log.warning("Waiting for %s to appear...", path)
        await asyncio.sleep(2)

    with open(path, "r") as f:
        # Seek to end — only process new lines
        f.seek(0, 2)
        log.info("Tailing %s (offset %d)", path, f.tell())
        while True:
            line = f.readline()
            if line:
                yield line.rstrip("\n")
            else:
                await asyncio.sleep(0.2)


# ── Suricata watcher ─────────────────────────────────────────────────

async def watch_suricata(path: str, client: APIClient):
    log.info("Starting Suricata watcher on %s", path)
    async for line in tail_file(path):
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        # Only forward alert events
        if obj.get("event_type") != "alert" and "alert" not in obj:
            continue
        alert = {
            "timestamp": obj.get("timestamp", ""),
            "src_ip": obj.get("src_ip", "0.0.0.0"),
            "dest_ip": obj.get("dest_ip", "0.0.0.0"),
            "src_port": obj.get("src_port"),
            "dest_port": obj.get("dest_port"),
            "proto": obj.get("proto"),
            "alert": obj.get("alert", {}),
        }
        await client.enqueue("suricata_alerts", alert)


# ── Zeek watcher ──────────────────────────────────────────────────────

async def watch_zeek(path: str, client: APIClient):
    log.info("Starting Zeek watcher on %s", path)
    fields = None
    async for line in tail_file(path):
        if not line:
            continue
        if line.startswith("#fields"):
            fields = line.split("\t")[1:]
            continue
        if line.startswith("#"):
            continue
        if fields is None:
            fields = [
                "ts", "uid", "id.orig_h", "id.orig_p", "id.resp_h", "id.resp_p",
                "fuid", "file_mime_type", "file_desc", "proto", "note", "msg",
                "sub", "src", "dst", "p", "n", "peer_descr", "actions", "suppress_for",
            ]
        values = line.split("\t")
        row = {}
        for i, f in enumerate(fields):
            if i < len(values) and values[i] != "-":
                row[f] = values[i]
        try:
            alert = {
                "ts": float(row.get("ts", 0)),
                "id.orig_h": row.get("id.orig_h", "0.0.0.0"),
                "id.resp_h": row.get("id.resp_h", "0.0.0.0"),
                "proto": row.get("proto"),
                "note": row.get("note", ""),
                "msg": row.get("msg", ""),
            }
            orig_p = row.get("id.orig_p")
            resp_p = row.get("id.resp_p")
            if orig_p and orig_p.isdigit():
                alert["id.orig_p"] = int(orig_p)
            if resp_p and resp_p.isdigit():
                alert["id.resp_p"] = int(resp_p)
            await client.enqueue("zeek_alerts", alert)
        except (ValueError, TypeError):
            continue


# ── Snort watcher ─────────────────────────────────────────────────────

async def watch_snort(path: str, client: APIClient):
    log.info("Starting Snort watcher on %s", path)
    async for line in tail_file(path):
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        alert = {
            "timestamp": obj.get("timestamp", ""),
            "src": obj.get("src", obj.get("src_addr", "0.0.0.0")),
            "dst": obj.get("dst", obj.get("dst_addr", "0.0.0.0")),
            "sport": obj.get("sport", obj.get("src_port")),
            "dport": obj.get("dport", obj.get("dst_port")),
            "proto": obj.get("proto"),
            "classtype": obj.get("classtype", ""),
            "priority": obj.get("priority", 3),
            "msg": obj.get("msg", ""),
        }
        await client.enqueue("snort_alerts", alert)


# ── Kismet watcher (REST API polling) ─────────────────────────────────

async def watch_kismet(url: str, api_key: str, poll_interval: float, client: APIClient):
    log.info("Starting Kismet watcher polling %s every %ds", url, poll_interval)
    base = url.rstrip("/")
    headers = {}
    if api_key:
        headers["KISMET"] = api_key

    last_ts = time.time()
    session = aiohttp.ClientSession()

    try:
        while True:
            try:
                endpoint = f"{base}/alerts/last-time/{last_ts}/alerts.json"
                async with session.get(endpoint, headers=headers) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        alerts = data if isinstance(data, list) else []
                        for obj in alerts:
                            alert = {
                                "kismet_device_base_name": obj.get("kismet.device.base.name", ""),
                                "kismet_alert_header": obj.get("kismet.alert.header", ""),
                                "kismet_alert_text": obj.get("kismet.alert.text", ""),
                                "kismet_alert_timestamp": obj.get("kismet.alert.timestamp", 0.0),
                                "kismet_alert_source_mac": obj.get("kismet.alert.source_mac", "00:00:00:00:00:00"),
                                "kismet_alert_dest_mac": obj.get("kismet.alert.dest_mac", "00:00:00:00:00:00"),
                            }
                            await client.enqueue("kismet_alerts", alert)
                        if alerts:
                            last_ts = max(
                                obj.get("kismet.alert.timestamp", last_ts) for obj in alerts
                            )
                            log.info("Polled %d Kismet alerts", len(alerts))
                    elif resp.status != 404:
                        log.warning("Kismet poll returned %d", resp.status)
            except aiohttp.ClientError as e:
                log.error("Kismet connection error: %s", e)

            await asyncio.sleep(poll_interval)
    finally:
        await session.close()


# ── Setup wizard ─────────────────────────────────────────────────────

IDS_DEFAULTS = {
    "suricata": [
        "/var/log/suricata/eve.json",
        "/etc/suricata/eve.json",
        "/opt/suricata/var/log/eve.json",
        "/usr/local/var/log/suricata/eve.json",
    ],
    "snort": [
        "/var/log/snort/alert_json.txt",
        "/var/log/snort3/alert_json.txt",
        "/usr/local/var/log/snort/alert_json.txt",
    ],
    "zeek": [
        "/opt/zeek/logs/current/notice.log",
        "/usr/local/zeek/logs/current/notice.log",
        "/var/log/zeek/current/notice.log",
    ],
}


def _find_default_path(ids_name: str) -> str | None:
    """Check common paths and return the first one that exists."""
    for p in IDS_DEFAULTS.get(ids_name, []):
        if os.path.exists(p):
            return p
    return None


def _prompt(message: str, default: str = "") -> str:
    """Prompt user for input with an optional default."""
    if default:
        raw = input(f"  {message} [{default}]: ").strip()
        return raw if raw else default
    while True:
        raw = input(f"  {message}: ").strip()
        if raw:
            return raw
        print("  (required)")


def _prompt_yn(message: str, default: bool = True) -> bool:
    """Prompt user for yes/no."""
    hint = "Y/n" if default else "y/N"
    raw = input(f"  {message} [{hint}]: ").strip().lower()
    if not raw:
        return default
    return raw in ("y", "yes")


def _test_connection(url: str, api_key: str) -> bool:
    """Synchronously test the API connection."""
    import urllib.request
    import urllib.error
    health_url = f"{url.rstrip('/')}/health"
    req = urllib.request.Request(health_url)
    if api_key:
        req.add_header("X-API-Key", api_key)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                return True
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        pass
    return False


def _validate_path(path: str) -> bool:
    """Check if a file path exists."""
    return os.path.exists(path)


def run_setup(output_path: str = "config.yaml"):
    """Interactive setup wizard that generates config.yaml."""
    print()
    print("  DurianDetector IDS Watcher Setup")
    print("  ================================")
    print()

    # ── API connection ──
    print("  -- API Connection --")
    api_url = "https://log-service-production-f5f2.up.railway.app"
    print(f"  API URL: {api_url}")
    api_key = _prompt("API Key (from Settings > API Keys)")

    if _test_connection(api_url, api_key):
        print("  [OK] Connection verified!")
    else:
        print("  [!!] Could not reach the server. Check the URL and API key.")
        if not _prompt_yn("Continue anyway?", default=False):
            print("  Setup cancelled.")
            return
    print()

    # ── IDS selection ──
    print("  -- IDS Selection --")
    print("  Select which IDS engines to monitor (they will run concurrently):")
    print()
    print("    [1] Suricata  (EVE JSON log file)")
    print("    [2] Snort     (JSON alert log file)")
    print("    [3] Zeek      (notice.log file)")
    print("    [4] Kismet    (REST API polling)")
    print()
    selection = _prompt("Enter numbers, comma-separated (e.g. 1,2)", "1")
    selected = {s.strip() for s in selection.split(",")}
    print()

    ids_map = {"1": "suricata", "2": "snort", "3": "zeek", "4": "kismet"}
    config = {
        "api": {
            "url": api_url,
            "api_key": api_key,
            "token": "",
        },
        "batch": {
            "size": 50,
            "interval": 1,
        },
        "suricata": {"enabled": False, "path": "/var/log/suricata/eve.json"},
        "snort": {"enabled": False, "path": "/var/log/snort/alert_json.txt"},
        "zeek": {"enabled": False, "path": "/opt/zeek/logs/current/notice.log"},
        "kismet": {
            "enabled": False,
            "url": "http://localhost:2501",
            "api_key": "",
            "poll_interval": 5,
        },
    }

    enabled_names = []

    for num in sorted(selected):
        ids_name = ids_map.get(num)
        if not ids_name:
            print(f"  [!!] Unknown selection: {num}, skipping")
            continue

        print(f"  -- {ids_name.capitalize()} Configuration --")

        if ids_name == "kismet":
            kismet_url = _prompt("Kismet REST API URL", "http://localhost:2501")
            kismet_key = _prompt("Kismet API key (leave blank if none)", "")
            poll = _prompt("Poll interval in seconds", "5")
            config["kismet"] = {
                "enabled": True,
                "url": kismet_url,
                "api_key": kismet_key,
                "poll_interval": int(poll),
            }
            enabled_names.append("Kismet")
        else:
            # Check common paths first
            detected = _find_default_path(ids_name)
            if detected:
                print(f"  [OK] Found {ids_name} log at {detected}")
                path = _prompt("Log file path", detected)
            else:
                path = _prompt("Log file path")

            if _validate_path(path):
                print(f"  [OK] File exists: {path}")
            else:
                print(f"  [!!] File not found: {path}")
                print(f"       The watcher will wait for it to appear at runtime.")

            config[ids_name] = {"enabled": True, "path": path}
            enabled_names.append(ids_name.capitalize())

        print()

    if not enabled_names:
        print("  [!!] No IDS selected. Setup cancelled.")
        return

    # ── Batch settings ──
    print("  -- Batch Settings --")
    if _prompt_yn("Use defaults (50 alerts/batch, 1s interval)?"):
        pass
    else:
        batch_size = _prompt("Max alerts per batch", "50")
        batch_interval = _prompt("Flush interval in seconds", "1")
        config["batch"]["size"] = int(batch_size)
        config["batch"]["interval"] = int(batch_interval)
    print()

    # ── Save ──
    with open(output_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    print(f"  [OK] Config saved to {output_path}")
    print(f"  [OK] Enabled: {', '.join(enabled_names)} (running concurrently)")
    print()
    print(f"  Run the watcher:")
    print(f"    python watcher.py")
    print()


# ── Main ──────────────────────────────────────────────────────────────

async def main(config_path: str):
    cfg = load_config(config_path)

    api_cfg = cfg.get("api", {})
    batch_cfg = cfg.get("batch", {})
    client = APIClient(
        base_url=api_cfg.get("url", "https://log-service-production-f5f2.up.railway.app"),
        api_key=api_cfg.get("api_key", ""),
        token=api_cfg.get("token", ""),
        batch_size=batch_cfg.get("size", 50),
        batch_interval=batch_cfg.get("interval", 1),
    )
    await client.start()

    tasks = []

    # Suricata
    suri = cfg.get("suricata", {})
    if suri.get("enabled"):
        tasks.append(asyncio.create_task(watch_suricata(suri["path"], client)))

    # Zeek
    zeek = cfg.get("zeek", {})
    if zeek.get("enabled"):
        tasks.append(asyncio.create_task(watch_zeek(zeek["path"], client)))

    # Snort
    snort = cfg.get("snort", {})
    if snort.get("enabled"):
        tasks.append(asyncio.create_task(watch_snort(snort["path"], client)))

    # Kismet
    kismet = cfg.get("kismet", {})
    if kismet.get("enabled"):
        tasks.append(asyncio.create_task(watch_kismet(
            url=kismet.get("url", "http://localhost:2501"),
            api_key=kismet.get("api_key", ""),
            poll_interval=kismet.get("poll_interval", 5),
            client=client,
        )))

    if not tasks:
        log.error("No IDS watchers enabled. Run 'python watcher.py setup' to configure.")
        return

    enabled = [name for name, cfg_section in [
        ("Suricata", cfg.get("suricata", {})),
        ("Snort", cfg.get("snort", {})),
        ("Zeek", cfg.get("zeek", {})),
        ("Kismet", cfg.get("kismet", {})),
    ] if cfg_section.get("enabled")]
    log.info("Running %d watcher(s) concurrently: %s — press Ctrl+C to stop", len(tasks), ", ".join(enabled))

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        pass
    finally:
        await client.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DurianDetector IDS Watcher")
    subparsers = parser.add_subparsers(dest="command")

    # setup subcommand
    setup_parser = subparsers.add_parser("setup", help="Interactive setup wizard to generate config.yaml")
    setup_parser.add_argument("-o", "--output", default="config.yaml", help="Output config file path")

    # run is the default (no subcommand needed)
    parser.add_argument("-c", "--config", default="config.yaml", help="Path to config YAML")

    args = parser.parse_args()

    if args.command == "setup":
        run_setup(args.output)
    else:
        try:
            asyncio.run(main(args.config))
        except KeyboardInterrupt:
            log.info("Shutting down")
