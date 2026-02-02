import os
import re
import time
from datetime import datetime
from dotenv import load_dotenv
from bs4 import BeautifulSoup
import requests

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

from supabase import create_client, Client

# ------------------ CONFIG ------------------
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
TABLE_NAME = "off_grounds_listings"

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL = "https://offgroundshousing.student.virginia.edu"
SEARCH_URL = f"{BASE_URL}/housing"

# ------------------ SCRAPER ------------------
def get_uva_listings():
    print("Launching headless browser...")

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("user-agent=Mozilla/5.0")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    listings = []

    try:
        driver.get(SEARCH_URL)

        # Wait for initial listings
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "a[href*='/housing/property/']"))
        )
        time.sleep(3)

        # ----------- SCROLL TO LOAD ALL LISTINGS -----------
        last_height = driver.execute_script("return document.body.scrollHeight")
        while True:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                break
            last_height = new_height

        # ----------- COLLECT ALL PROPERTY LINKS -----------
        soup = BeautifulSoup(driver.page_source, "html.parser")
        property_links = soup.select("a[href*='/housing/property/']")
        urls = list({BASE_URL + a["href"] for a in property_links if a.get("href")})

        print(f"Found {len(urls)} properties")

        # ----------- SCRAPE EACH PROPERTY -----------
        for i, url in enumerate(urls):
            print(f"[{i+1}/{len(urls)}] {url}")
            driver.get(url)

            try:
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.TAG_NAME, "h1"))
                )
                time.sleep(2)

                page = BeautifulSoup(driver.page_source, "html.parser")
                text = page.get_text(" ", strip=True)

                # ---------------- BASIC INFO ----------------
                title_tag = page.find("h1")
                name = title_tag.get_text(strip=True) if title_tag else None

                # Extract ID from URL
                listing_id = url.rstrip("/").split("/")[-1]

                # Address
                address_match = re.search(r"\d{1,5} .*?(?= Charlottesville| VA)", text)
                address = address_match.group(0) if address_match else None

                # Bedrooms
                beds_match = re.search(r"(\d+)\s*Bed", text, re.I)
                bedrooms = int(beds_match.group(1)) if beds_match else None

                # ---------------- PRICING ----------------
                price_total = None
                price_per_person = None

                price_matches = re.findall(r"\$[\d,]+", text)
                if price_matches:
                    price_val = int(price_matches[0].replace("$", "").replace(",", ""))

                    if "per person" in text.lower():
                        price_per_person = price_val
                    else:
                        price_total = price_val

                if bedrooms and price_total:
                    price_per_person = int(price_total / bedrooms)

                # ---------------- CONTACT LINK ----------------
                contact_link_tag = page.find("a", href=re.compile("contact", re.I))
                landlord_contact_url = contact_link_tag["href"] if contact_link_tag else None
                if landlord_contact_url and not landlord_contact_url.startswith("http"):
                    landlord_contact_url = BASE_URL + landlord_contact_url

                # ---------------- LAT/LONG ----------------
                api_key = os.getenv("GEOCODE_API_KEY")  

                latitude = None
                longitude = None

                if address:
                    latitude, longitude = geocode_address(address, api_key)

                listings.append({
                    "id": listing_id,
                    "name": name,
                    "address": address,
                    "latitude": latitude,
                    "longitude": longitude,
                    "bedrooms": bedrooms,
                    "price_total": price_total,
                    "price_per_person": price_per_person,
                    "url": url,
                    "landlord_contact_url": landlord_contact_url,
                })

            except Exception as e:
                print(f"Error scraping {url}: {e}")

    finally:
        driver.quit()

    print(f"Scraped {len(listings)} listings")
    return listings



def geocode_address(address: str, api_key: str):
    """
    Uses geocode.maps.co to look up latitude and longitude for an address.
    Returns (latitude, longitude) or (None, None) if not found.
    """
    if not address:
        return None, None

    try:
        url = "https://geocode.maps.co/search"
        params = {
            "q": address,
            "api_key": api_key
        }

        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()

        if isinstance(data, list) and len(data) > 0:
            lat = float(data[0].get("lat"))
            lon = float(data[0].get("lon"))
            return lat, lon

    except Exception as e:
        print(f"Geocoding failed for '{address}': {e}")

    return None, None





        

# ------------------ SUPABASE SYNC ------------------
def sync_to_supabase():
    print("Scraping UVA Housing...")
    data = get_uva_listings()

    if not data:
        print("No data found to upsert.")
        return

    print(f"Upserting {len(data)} listings to Supabase...")
    supabase.table(TABLE_NAME).upsert(data, on_conflict="id").execute()
    print("Sync complete.")

# ------------------ ENTRY POINT ------------------
if __name__ == "__main__":
    sync_to_supabase()
