#!/usr/bin/env python3
"""
AI觉醒笔记 — X (Twitter) 发布
凭证留空。发帖 + 可选配图。
"""

import os
import sys

import requests

X_BEARER_TOKEN = os.environ.get("X_BEARER_TOKEN", "")
X_CONSUMER_KEY = os.environ.get("X_CONSUMER_KEY", "")
X_CONSUMER_SECRET = os.environ.get("X_CONSUMER_SECRET", "")
X_ACCESS_TOKEN = os.environ.get("X_ACCESS_TOKEN", "")
X_ACCESS_SECRET = os.environ.get("X_ACCESS_SECRET", "")

BASE = "https://api.x.com/2"
UPLOAD_BASE = "https://upload.x.com/1.1"


def _post_raw(json_payload: dict, token: str = "") -> dict:
    t = token or X_BEARER_TOKEN
    if not t:
        raise ValueError("X 凭证未设置")
    r = requests.post(
        f"{BASE}/tweets",
        headers={"Authorization": f"Bearer {t}", "Content-Type": "application/json"},
        json=json_payload,
    )
    return r.json()


def upload_media(image_path: str, token: str = "") -> str:
    """上传图片，返回 media_id。"""
    t = token or X_BEARER_TOKEN
    # X v1.1 media upload
    from requests_oauthlib import OAuth1

    auth = OAuth1(
        X_CONSUMER_KEY,
        X_CONSUMER_SECRET,
        X_ACCESS_TOKEN,
        X_ACCESS_SECRET,
    )

    with open(image_path, "rb") as f:
        r = requests.post(
            f"{UPLOAD_BASE}/media/upload.json",
            auth=auth,
            files={"media": f},
        )
    d = r.json()
    mid = d.get("media_id_string", "")
    if not mid:
        raise RuntimeError(f"上传图片失败: {d}")
    return mid


def publish_tweet(text: str, image_path: str = "", token: str = "") -> str:
    """发布一条推文（可选配图），返回推文链接。"""
    payload = {"text": text}
    if image_path:
        mid = upload_media(image_path, token)
        payload["media"] = {"media_ids": [mid]}

    d = _post_raw(payload, token)
    if "data" not in d:
        raise RuntimeError(f"发帖失败: {d}")
    tid = d["data"]["id"]
    url = f"https://x.com/i/status/{tid}"
    print(f"[X] 推文发布成功: {tid}")
    return url


def publish_thread(tweets: list[dict], token: str = "") -> list[str]:
    """发布一个 thread。每项: {text, image?}。返回推文链接列表。"""
    urls = []
    prev_tid = None
    for item in tweets:
        payload = {"text": item["text"]}
        if prev_tid:
            payload["reply"] = {"in_reply_to_tweet_id": prev_tid}
        if item.get("image"):
            mid = upload_media(item["image"], token)
            payload["media"] = {"media_ids": [mid]}
        d = _post_raw(payload, token)
        tid = d.get("data", {}).get("id", "")
        if not tid:
            raise RuntimeError(f"Thread 第{len(urls)+1}条失败: {d}")
        urls.append(f"https://x.com/i/status/{tid}")
        prev_tid = tid
        print(f"[X] Thread {len(urls)}/{len(tweets)}: {tid}")
    return urls


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--text", required=True, help="推文内容")
    p.add_argument("--image", default="", help="配图路径（可选）")
    p.add_argument("--token", default="")
    args = p.parse_args()

    url = publish_tweet(
        text=args.text,
        image_path=args.image,
        token=args.token or X_BEARER_TOKEN,
    )
    print(url)
