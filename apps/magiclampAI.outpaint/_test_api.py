"""测试 API 端到端：发送生成请求并轮询状态，观察模型加载过程"""
import requests, json, time, io
from PIL import Image

BASE = "http://127.0.0.1:8002"

# 1. 创建测试图
img = Image.new("RGB", (512, 512), (200, 150, 100))
buf = io.BytesIO()
img.save(buf, format="PNG")
buf.seek(0)

layout = json.dumps({"img_left": 0, "img_top": 0, "img_scale": 0.5, "prompt": "beautiful landscape"})

print(">>> Sending /api/generate ...")
r = requests.post(f"{BASE}/api/generate",
    files={"image": ("test.png", buf, "image/png")},
    data={"layout": layout})
data = r.json()
print(f">>> Response: {data}")
task_id = data.get("task_id")
if not task_id:
    print("No task_id! Aborting.")
    exit(1)

# 2. 轮询状态
for i in range(90):
    time.sleep(3)
    r2 = requests.get(f"{BASE}/api/status/{task_id}")
    s = r2.json()
    progress = s.get("progress", 0)
    status = s.get("status", "?")
    error = s.get("error")
    logs = s.get("logs", [])
    last_log = logs[-1] if logs else ""
    print(f"  [{i*3:3d}s] {progress:3d}% | {status:10s} | {last_log}")
    if error:
        print(f"  >>> ERROR: {error}")
    if status in ("completed", "error"):
        break

print("\n>>> DONE")
