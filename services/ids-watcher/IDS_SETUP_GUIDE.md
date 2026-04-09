# IDS Setup Guide for DurianDetector

This guide covers installing and configuring each supported IDS so that its output is compatible with the DurianDetector IDS Watcher.

---

## Table of Contents

- [Suricata](#suricata)
- [Snort 3](#snort-3)
- [Zeek](#zeek)
- [Kismet](#kismet)
- [Running the Watcher](#running-the-watcher)

---

## Suricata

### Ubuntu / Debian

```bash
# Install
sudo apt update
sudo apt install -y suricata

# Check version
suricata --build-info | head -5

# Download latest rulesets
sudo suricata-update

# Find your network interface
ip -br link show
# Example output: eth0, ens33, wlan0, etc.
```

### Configure EVE JSON logging

DurianDetector reads Suricata's EVE JSON output. This is enabled by default, but verify it:

```bash
sudo nano /etc/suricata/suricata.yaml
```

Find the `eve-log` section and ensure it looks like this:

```yaml
outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: eve.json
      types:
        - alert:
            payload: yes
            payload-printable: yes
            packet: yes
```

### Set the network interface

In the same `suricata.yaml`, set your interface:

```yaml
af-packet:
  - interface: eth0    # <-- your interface
```

Or pass it on the command line (see below).

### Start Suricata

```bash
# Run on interface eth0
sudo suricata -c /etc/suricata/suricata.yaml -i eth0

# Or run as a daemon
sudo suricata -c /etc/suricata/suricata.yaml -i eth0 -D

# Verify it's running
sudo systemctl status suricata

# Verify logs are being written
tail -f /var/log/suricata/eve.json
```

### Enable as a service (auto-start on boot)

```bash
sudo systemctl enable suricata
sudo systemctl start suricata
sudo systemctl status suricata
```

### Log file location

Default: `/var/log/suricata/eve.json`

Use this path in the watcher config.

### CentOS / RHEL / Fedora

```bash
sudo dnf install -y epel-release
sudo dnf install -y suricata
sudo suricata-update
sudo systemctl enable suricata
sudo systemctl start suricata
```

Config file: `/etc/suricata/suricata.yaml`
Log file: `/var/log/suricata/eve.json`

---

## Snort 3

### Ubuntu / Debian

```bash
# Install dependencies
sudo apt update
sudo apt install -y build-essential libpcap-dev libpcre3-dev \
  libnet1-dev zlib1g-dev luajit hwloc libdnet-dev \
  libdumbnet-dev bison flex liblzma-dev openssl libssl-dev \
  pkg-config libhwloc-dev cmake cpputest libsqlite3-dev \
  uuid-dev libcmocka-dev libnetfilter-queue-dev libmnl-dev \
  autotools-dev libluajit-5.1-dev libunwind-dev libfl-dev

# Install DAQ (Data Acquisition library)
git clone https://github.com/snort3/libdaq.git
cd libdaq
./bootstrap
./configure
make
sudo make install
cd ..

# Install Snort 3
git clone https://github.com/snort3/snort3.git
cd snort3
./configure_cmake.sh --prefix=/usr/local
cd build
make -j$(nproc)
sudo make install
cd ../..

# Update shared library cache
sudo ldconfig

# Verify installation
snort -V
```

### Quick install (Ubuntu PPA - if available)

```bash
# Check if Snort 3 PPA is available for your Ubuntu version
sudo add-apt-repository ppa:snort/snort3
sudo apt update
sudo apt install -y snort3
```

### Configure JSON alert output

Create or edit the Snort configuration:

```bash
sudo mkdir -p /usr/local/etc/snort
sudo mkdir -p /var/log/snort
sudo nano /usr/local/etc/snort/snort.lua
```

Add the `alert_json` output plugin:

```lua
-- Enable JSON alert output
alert_json =
{
    file = true,
    limit = 100,        -- MB per file
    fields = "timestamp src dst sport dport proto classtype priority msg",
}

-- Set your network
HOME_NET = '192.168.1.0/24'    -- adjust to your network
EXTERNAL_NET = '!$HOME_NET'
```

### Download rules

```bash
# Create rules directory
sudo mkdir -p /usr/local/etc/snort/rules

# Download community rules
wget https://www.snort.org/downloads/community/snort3-community-rules.tar.gz
tar -xzf snort3-community-rules.tar.gz
sudo cp snort3-community-rules/snort3-community.rules /usr/local/etc/snort/rules/

# Add to snort.lua
# ips = { include = '/usr/local/etc/snort/rules/snort3-community.rules' }
```

### Start Snort

```bash
# Find your interface
ip -br link show

# Run Snort on interface eth0
sudo snort -c /usr/local/etc/snort/snort.lua -i eth0 -l /var/log/snort -A json

# Run as daemon
sudo snort -c /usr/local/etc/snort/snort.lua -i eth0 -l /var/log/snort -A json -D

# Verify logs
tail -f /var/log/snort/alert_json.txt
```

### Create a systemd service (auto-start on boot)

```bash
sudo nano /etc/systemd/system/snort3.service
```

```ini
[Unit]
Description=Snort 3 IDS
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/snort -c /usr/local/etc/snort/snort.lua -i eth0 -l /var/log/snort -A json
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable snort3
sudo systemctl start snort3
sudo systemctl status snort3
```

### Log file location

Default: `/var/log/snort/alert_json.txt`

Use this path in the watcher config.

---

## Zeek

### Ubuntu / Debian

```bash
# Add Zeek repository
sudo apt update
sudo apt install -y curl gnupg2
echo 'deb http://download.opensuse.org/repositories/security:/zeek/xUbuntu_22.04/ /' | \
  sudo tee /etc/apt/sources.list.d/zeek.list
curl -fsSL https://download.opensuse.org/repositories/security:zeek/xUbuntu_22.04/Release.key | \
  gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/zeek.gpg > /dev/null
sudo apt update
sudo apt install -y zeek

# Or install via binary package (simpler)
sudo apt install -y zeek-lts
```

> **Note:** Replace `xUbuntu_22.04` with your Ubuntu version. Check https://software.opensuse.org/download.html?project=security%3Azeek&package=zeek for your distro.

### Configure Zeek

```bash
# Zeek installs to /opt/zeek by default
export PATH=/opt/zeek/bin:$PATH
echo 'export PATH=/opt/zeek/bin:$PATH' >> ~/.bashrc

# Set the interface to monitor
sudo nano /opt/zeek/etc/node.cfg
```

Edit `node.cfg`:

```ini
[zeek]
type=standalone
host=localhost
interface=eth0    # <-- your interface
```

### Configure the network

```bash
sudo nano /opt/zeek/etc/networks.cfg
```

```
# Your local networks
192.168.1.0/24     Private network
10.0.0.0/8         Internal
```

### Start Zeek

```bash
# Deploy Zeek (creates log files)
sudo /opt/zeek/bin/zeekctl deploy

# Check status
sudo /opt/zeek/bin/zeekctl status

# Verify logs are being written
ls /opt/zeek/logs/current/
# You should see: conn.log, dns.log, http.log, notice.log, etc.

# Watch notice.log (this is what the watcher reads)
tail -f /opt/zeek/logs/current/notice.log
```

### Zeek management commands

```bash
# Start
sudo zeekctl start

# Stop
sudo zeekctl stop

# Restart (after config changes)
sudo zeekctl deploy

# Check status
sudo zeekctl status

# Rotate logs
sudo zeekctl rotate
```

### Enable as a cron job (auto-start)

```bash
# Zeekctl has a built-in cron command
sudo crontab -e
```

Add:

```
*/5 * * * * /opt/zeek/bin/zeekctl cron
```

This checks every 5 minutes if Zeek is running and restarts it if it has crashed.

### Log file location

Default: `/opt/zeek/logs/current/notice.log`

Use this path in the watcher config.

### CentOS / RHEL / Fedora

```bash
sudo dnf install -y zeek-lts
# or
sudo yum install -y zeek
```

Config: `/opt/zeek/etc/node.cfg`
Logs: `/opt/zeek/logs/current/notice.log`

---

## Kismet

Kismet monitors **wireless networks** (Wi-Fi, Bluetooth, RF). It requires a wireless adapter that supports monitor mode.

### Ubuntu / Debian

```bash
# Install dependencies
sudo apt update
sudo apt install -y build-essential git libmicrohttpd-dev \
  pkg-config zlib1g-dev libnl-3-dev libnl-genl-3-dev \
  libcap-dev libpcap-dev libnm-dev libdw-dev libsqlite3-dev \
  libprotobuf-dev libprotobuf-c-dev protobuf-compiler \
  protobuf-c-compiler libsensors-dev libusb-1.0-0-dev \
  python3 python3-setuptools python3-protobuf python3-requests \
  python3-numpy python3-serial python3-usb python3-dev \
  librtlsdr0 libubertooth-dev libbtbb-dev

# Clone and build Kismet
git clone https://github.com/kismetwireless/kismet.git
cd kismet
./configure
make -j$(nproc)
sudo make suidinstall
cd ..

# Add your user to the kismet group (so you don't need root)
sudo usermod -aG kismet $USER
# Log out and back in for group change to take effect
```

### Quick install (package manager)

```bash
# Add Kismet repository
wget -O - https://www.kismetwireless.net/repos/kismet-release.gpg.key | \
  sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/kismet.gpg
echo 'deb https://www.kismetwireless.net/repos/apt/release/jammy jammy main' | \
  sudo tee /etc/apt/sources.list.d/kismet.list
sudo apt update
sudo apt install -y kismet
```

> Replace `jammy` with your Ubuntu codename (`lsb_release -cs`).

### Check for wireless adapter

```bash
# List wireless interfaces
iwconfig

# Or
ip link show | grep wlan

# Check if your adapter supports monitor mode
iw list | grep -A5 "Supported interface modes"
# Look for "monitor" in the output
```

### Enable monitor mode

```bash
# Replace wlan0 with your wireless interface name
sudo ip link set wlan0 down
sudo iw wlan0 set monitor control
sudo ip link set wlan0 up

# Verify
iwconfig wlan0
# Should show "Mode:Monitor"
```

### Configure Kismet

```bash
# Kismet config is at /etc/kismet/ or ~/.kismet/
sudo nano /etc/kismet/kismet.conf
```

Key settings:

```
# Set the wireless source
source=wlan0

# Enable the REST API (the watcher polls this)
httpd_uri_prefix=/
httpd_port=2501
httpd_bind_address=0.0.0.0
```

### Set an API key (for the watcher)

```bash
# Create API credentials
sudo nano /etc/kismet/kismet_httpd.conf
```

```
httpd_username=kismet
httpd_password=your_password_here
```

Or generate an API key via the Kismet web UI at `http://localhost:2501` after first login.

### Start Kismet

```bash
# Start with a specific wireless source
kismet -c wlan0

# Start as a daemon (background)
kismet -c wlan0 --daemonize

# Verify it's running
curl -s http://localhost:2501/system/status.json | python3 -m json.tool

# Check alerts endpoint (this is what the watcher polls)
curl -s http://localhost:2501/alerts/last-time/0/alerts.json
```

### Create a systemd service (auto-start)

```bash
sudo nano /etc/systemd/system/kismet.service
```

```ini
[Unit]
Description=Kismet Wireless IDS
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/kismet -c wlan0 --no-ncurses
Restart=on-failure
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable kismet
sudo systemctl start kismet
sudo systemctl status kismet
```

### REST API endpoint

Default: `http://localhost:2501`

Use this URL in the watcher config.

---

## Running the Watcher

Once you have at least one IDS running and producing logs:

### 1. Install the watcher

```bash
cd services/ids-watcher
pip install -r requirements.txt
```

### 2. Run the setup wizard

```bash
python watcher.py setup
```

This will:
- Ask for your DurianDetector API URL and API key
- Let you select which IDS engines to monitor (multiple allowed)
- Auto-detect log file paths where possible
- Validate paths exist
- Test the API connection
- Generate `config.yaml`

### 3. Start the watcher

```bash
python watcher.py
```

The watcher tails all enabled IDS log files concurrently and batches alerts to DurianDetector.

### 4. Run as a background service

```bash
# Using systemd
sudo nano /etc/systemd/system/durian-watcher.service
```

```ini
[Unit]
Description=DurianDetector IDS Watcher
After=network.target suricata.service snort3.service

[Service]
Type=simple
WorkingDirectory=/path/to/ids-watcher
ExecStart=/usr/bin/python3 watcher.py
Restart=on-failure
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable durian-watcher
sudo systemctl start durian-watcher
sudo systemctl status durian-watcher

# View watcher logs
journalctl -u durian-watcher -f
```

### 5. Verify alerts are flowing

```bash
# Check the watcher logs
journalctl -u durian-watcher -f

# Or if running in foreground, you'll see:
# 12:34:56 [INFO] ids-watcher — Running 2 watcher(s) concurrently: Suricata, Snort
# 12:35:01 [INFO] ids-watcher — Ingested 12/12 alerts
```

Then open your DurianDetector dashboard — alerts should appear in the Live Alert Feed.

---

## Quick Reference

| IDS | Config file | Log file / endpoint | Key setting |
|-----|------------|---------------------|-------------|
| Suricata | `/etc/suricata/suricata.yaml` | `/var/log/suricata/eve.json` | `eve-log: enabled: yes` |
| Snort 3 | `/usr/local/etc/snort/snort.lua` | `/var/log/snort/alert_json.txt` | `alert_json = { file = true }` |
| Zeek | `/opt/zeek/etc/node.cfg` | `/opt/zeek/logs/current/notice.log` | `interface=eth0` in node.cfg |
| Kismet | `/etc/kismet/kismet.conf` | `http://localhost:2501` | `httpd_port=2501` |

## Troubleshooting

### No alerts appearing?

```bash
# 1. Check IDS is running
sudo systemctl status suricata   # or snort3, etc.

# 2. Check logs are being written
tail -f /var/log/suricata/eve.json

# 3. Check watcher can reach the API
curl -s -H "X-API-Key: YOUR_KEY" https://your-api-url/health

# 4. Check watcher logs
journalctl -u durian-watcher --since "5 minutes ago"
```

### Permission denied on log files?

```bash
# Add your user to the IDS log group
sudo usermod -aG suricata $USER   # Suricata
sudo chmod 644 /var/log/suricata/eve.json

# Or run the watcher as root
sudo python watcher.py
```

### Interface not found?

```bash
# List all interfaces
ip -br link show

# For wireless (Kismet)
iwconfig
```
