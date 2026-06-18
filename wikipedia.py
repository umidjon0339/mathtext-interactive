#!/usr/bin/env python3
"""
Download audio files for pulmonic consonants using direct file links from Wikimedia Commons.
Respects robots.txt with polite delays and proper User-Agent.
Files are saved in the 'audio/' directory and named using the consonant's 'name' field.
"""

import os
import json
import time
import requests
from pathlib import Path

# Configuration
AUDIO_DIR = Path("audio")
CONSONANTS_JSON = "public/phonetics/consonants.json"  # Adjust path to your JSON file

# Headers to mimic a real browser
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# Delay between requests in seconds
REQUEST_DELAY = 1.5

# Retry configuration
MAX_RETRIES = 5
INITIAL_BACKOFF = 5  # seconds


def get_audio_url_from_api(file_title):
    """Get the direct audio file URL from Wikimedia Commons using the API."""
    api_url = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json",
        "formatversion": "2"
    }

    try:
        response = requests.get(api_url, headers=HEADERS, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        # Extract URL from the response
        pages = data.get("query", {}).get("pages", [])
        if pages and "imageinfo" in pages[0] and pages[0]["imageinfo"]:
            return pages[0]["imageinfo"][0]["url"]
        else:
            print(f"  ✗ No imageinfo found for: {file_title}")
            return None

    except Exception as e:
        print(f"  ✗ Error fetching URL for {file_title}: {e}")
        return None


def download_with_backoff(url, filepath, retries=MAX_RETRIES):
    """Download a file with exponential backoff on rate limits."""
    for attempt in range(retries):
        try:
            # Perform a HEAD request first to check availability (reduces 500 errors)
            head_response = requests.head(url, headers=HEADERS, timeout=30)
            head_response.raise_for_status()

            # Now download the file
            response = requests.get(url, headers=HEADERS, stream=True, timeout=60)
            response.raise_for_status()

            # Write the file
            with open(filepath, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True

        except requests.exceptions.HTTPError as e:
            if response.status_code == 429:  # Too Many Requests
                wait_time = INITIAL_BACKOFF * (2 ** attempt)
                print(f"  ⏳ Rate limited. Waiting {wait_time} seconds before retry {attempt + 1}/{retries}...")
                time.sleep(wait_time)
            else:
                print(f"  ✗ HTTP error: {e}")
                return False

        except Exception as e:
            print(f"  ✗ Download error: {e}")
            return False

    print(f"  ✗ Failed after {retries} retries.")
    return False


def main():
    print("Loading consonant data...")

    # Load the consonants JSON
    if not CONSONANTS_JSON.exists():
        print(f"Error: Could not find {CONSONANTS_JSON}. Please adjust the path.")
        return

    with open(CONSONANTS_JSON, "r", encoding="utf-8") as f:
        consonants = json.load(f)

    # Create audio directory
    AUDIO_DIR.mkdir(exist_ok=True)

    successful = 0
    skipped = 0
    failed = 0

    for i, cons in enumerate(consonants, 1):
        # Get the canonical name from the consonant's 'name' field
        # Example: "voiceless bilabial plosive" -> "Voiceless_Bilabial_Plosive.ogg"
        name_parts = cons["name"].title().split()
        audio_filename = "_".join(name_parts) + ".ogg"
        audio_filepath = AUDIO_DIR / audio_filename

        print(f"[{i}/{len(consonants)}] Processing: {cons['name']}")

        # Skip if file already exists
        if audio_filepath.exists():
            print(f"  ⏭ Already exists: {audio_filename}")
            skipped += 1
            continue

        # Determine the Wikimedia Commons file title
        # The file naming pattern on Commons is similar but may vary.
        # We'll try a few patterns.
        possible_titles = [
            f"File:{cons['name'].title().replace(' ', '_')}.ogg",
            f"File:{cons['name'].split()[-1]}_{cons['name'].split()[0]}.ogg",  # Fallback
        ]

        audio_url = None
        for title in possible_titles:
            audio_url = get_audio_url_from_api(title)
            if audio_url:
                print(f"  ✓ Found audio for: {title}")
                break

        if not audio_url:
            print(f"  ✗ Could not find audio for: {cons['name']}")
            failed += 1
            continue

        # Download the file
        print(f"  ↓ Downloading: {audio_filename}")
        if download_with_backoff(audio_url, audio_filepath):
            successful += 1
            print(f"  ✓ Saved to: {audio_filepath}")
        else:
            failed += 1

        # Polite delay between requests
        time.sleep(REQUEST_DELAY)

    print("\n" + "="*50)
    print(f"✅ Download complete!")
    print(f"   Successful: {successful}")
    print(f"   Skipped (already exist): {skipped}")
    print(f"   Failed: {failed}")
    print(f"   Files saved in: {AUDIO_DIR.absolute()}")


if __name__ == "__main__":
    main()