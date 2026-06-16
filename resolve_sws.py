import sys
import urllib.request
import urllib.parse
import re

def search_sws_yahoo(ticker):
    query = f"site:simplywall.st/stocks/us/ {ticker}"
    url = f"https://search.yahoo.com/search?p={urllib.parse.quote(query)}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as res:
            body = res.read().decode('utf-8')
            
            # Find simplywall.st/stocks/us/ URLs
            urls = re.findall(r'simplywall\.st/stocks/us/[^\s"\'>&]+', body)
            if not urls:
                encoded_urls = re.findall(r'simplywall\.st%2fstocks%2fus%2f[^\s"\'>&]+', body)
                for u in encoded_urls:
                    urls.append(urllib.parse.unquote(u))
            
            clean_urls = []
            for u in urls:
                if not u.startswith('http'):
                    u = 'https://' + u
                u_clean = u.split('&')[0].split('"')[0].split("'")[0].split(')')[0]
                parts = u_clean.split('/stocks/us/')
                if len(parts) > 1:
                    subparts = parts[1].strip('/').split('/')
                    if len(subparts) >= 3:
                        reconstructed = 'https://simplywall.st/stocks/us/' + '/'.join(subparts[:3])
                        if reconstructed not in clean_urls:
                            clean_urls.append(reconstructed)
            return clean_urls[0] if clean_urls else None
    except Exception as e:
        sys.stderr.write(f"Error: {e}\n")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("")
        sys.exit(1)
        
    ticker = sys.argv[1]
    url = search_sws_yahoo(ticker)
    if url:
        print(url)
    else:
        print("")
