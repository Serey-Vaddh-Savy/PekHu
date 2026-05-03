import importlib
from fastapi.testclient import TestClient

if __name__ == "__main__":
    m = importlib.import_module("main")
    client = TestClient(m.app)
    resp = client.get("/")
    print("Response JSON:", resp.json())
