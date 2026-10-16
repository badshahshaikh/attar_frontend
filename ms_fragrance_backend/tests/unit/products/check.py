import os
import requests
import base64

account_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
api_token = os.environ["CLOUDFLARE_API_TOKEN"]

url = (
    f"https://api.cloudflare.com/client/v4/accounts/"
    f"{account_id}/ai/run/@cf/black-forest-labs/flux-1-schnell"
)

response = requests.post(
    url,
    headers={
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    },
    json={
        "prompt": (
            "Premium perfume bottle product photography, "
            "dark brown background, elegant studio lighting"
        ),
        "steps": 4,
    },
    timeout=120,
)

response.raise_for_status()
image_data = response.json()["result"]["image"]

with open("perfume.png", "wb") as file:
    file.write(base64.b64decode(image_data))

print("Image saved to perfume.png")