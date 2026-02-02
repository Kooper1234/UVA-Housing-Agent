import os
import re
import time
import requests
from dotenv import load_dotenv
from bs4 import BeautifulSoup

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
# Fixed variable name to match the function usage
GEOCODE_API_KEY = os.getenv("GEOCODE_API_KEY") 

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL = "https://offgroundshousing.student.virginia.edu"
SEARCH_URL = f"{BASE_URL}/housing"

# ------------------ GEOCODING HELPER ------------------
def get_coordinates(address):
    """Fetch lat/long from geocode.maps.co."""
    if not address or not GEOCODE_API_KEY:
        return None, None
    
    # Clean the address: use only the first part if it's long/messy
    address_query = address.split('|')[0].strip()
    full_query = f"{address_query}, Charlottesville, VA"
    
    url = f"https://geocode.maps.co/search?q={full_query}&api_key={GEOCODE_API_KEY}"
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return float(data[0]['lat']), float(data[0]['lon'])
        elif response.status_code == 429:
            print("      Rate limit hit. Waiting...")
            time.sleep(2)
    except Exception as e:
        print(f"      Geocoding error: {e}")
    
    return None, None

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
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "a[href*='/housing/property/']"))
        )
        time.sleep(5)

        soup = BeautifulSoup(driver.page_source, "html.parser")
        property_links = soup.select("a[href*='/housing/property/']")
        urls = list({BASE_URL + a["href"] for a in property_links if a.get("href")})

        print(f"Found {len(urls)} properties")

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

                # ---------------- ADDRESS EXTRACTION ----------------
                # 1. Try to find the specific address element first
                address_tag = page.find("div", class_="property-address") or page.find("h2", class_="section-title")
                
                if address_tag and any(char.isdigit() for char in address_tag.get_text()):
                    address = address_tag.get_text(strip=True).split(" Charlottesville")[0]
                else:
                    # 2. Fallback Regex: look for numbers followed by street indicators
                    address_match = re.search(r"\d{1,5}\s+[A-Za-z0-9\s\.\-]+(?:St|Ave|Dr|Rd|Ln|Way|Ct|Ter|Apt|Unit|Northwest|NW|West|Southwest|SW)", text)
                    address = address_match.group(0).strip() if address_match else None

                # ---------------- COORDINATES ----------------
                latitude, longitude = None, None
                
                # Try finding coordinates in the page script first (FREE)
                coords = re.search(r'"lat"\s*:\s*([0-9\.-]+).*?"lng"\s*:\s*([0-9\.-]+)', driver.page_source)
                if coords:
                    latitude = float(coords.group(1))
                    longitude = float(coords.group(2))
                elif address:
                    print(f"  - Geocoding address: {address}")
                    latitude, longitude = get_coordinates(address)
                    time.sleep(1) # Respect 1 req/sec limit

                # ---------------- OTHER DATA ----------------
                title_tag = page.find("h1")
                name = title_tag.get_text(strip=True) if title_tag else None
                listing_id = url.rstrip("/").split("/")[-1]

                beds_match = re.search(r"(\d+)\s*Bed", text, re.I)
                bedrooms = int(beds_match.group(1)) if beds_match else None

                price_total = None
                price_per_person = None
                price_matches = re.findall(r"\$[\d,]+", text)
                if price_matches:
                    price_val = int(price_matches[0].replace("$", "").replace(",", ""))
                    if "per person" in text.lower():
                        price_per_person = price_val
                    else:
                        price_total = price_val

                if bedrooms and price_total and not price_per_person:
                    price_per_person = int(price_total / bedrooms)

                contact_link_tag = page.find("a", href=re.compile("contact", re.I))
                landlord_contact_url = BASE_URL + contact_link_tag["href"] if contact_link_tag else None

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

if __name__ == "__main__":
    sync_to_supabase()