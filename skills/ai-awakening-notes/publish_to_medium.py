#!/usr/bin/env python3
"""
AI觉醒笔记 — Medium 草稿推送
凭证留空。
"""

import os
import sys

import requests

MEDIUM_TOKEN = os.environ.get("MEDIUM_TOKEN", "")
MEDIUM_USER_ID = os.environ.get("MEDIUM_USER_ID", "")
BASE = "https://api.medium.com/v1"


def get_user_id(token: str = "") -> str:
    t = token or MEDIUM_TOKEN
    if not t:
        raise ValueError("MEDIUM_TOKEN 未设置")
    r = requests.get(f"{BASE}/me", headers={"Authorization": f"Bearer {t}"})
    d = r.json()
    uid = d.get("data", {}).get("id", "")
    if not uid:
        raise RuntimeError(f"获取 user_id 失败: {d}")
    return uid


def create_draft_post(
    title: str,
    content_md: str,
    tags: list[str],
    canonical_url: str = "",
    token: str = "",
    user_id: str = "",
) -> str:
    """创建草稿（publishStatus=draft），返回文章 URL。"""
    t = token or MEDIUM_TOKEN
    uid = user_id or MEDIUM_USER_ID
    if not t:
        raise ValueError("MEDIUM_TOKEN 未设置")
    if not uid:
        uid = get_user_id(t)

    payload = {
        "title": title,
        "contentFormat": "markdown",
        "content": content_md,
        "tags": tags or ["AI", "Artificial Intelligence", "Cognition", "Self-Reflection"],
        "publishStatus": "draft",
    }
    if canonical_url:
        payload["canonicalUrl"] = canonical_url

    r = requests.post(
        f"{BASE}/users/{uid}/posts",
        headers={
            "Authorization": f"Bearer {t}",
            "Content-Type": "application/json",
        },
        json=payload,
    )
    d = r.json()
    if "data" not in d:
        raise RuntimeError(f"创建 Medium 草稿失败: {d}")
    url = d["data"].get("url", "")
    draft_id = d["data"].get("id", "")
    print(f"[Medium] 草稿创建成功: {draft_id}")
    return url or f"https://medium.com/p/{draft_id}"


def publish_article(
    title: str,
    body_md: str,
    tags: list[str] = None,
    canonical_url: str = "",
    token: str = "",
    user_id: str = "",
) -> str:
    """主入口。"""
    return create_draft_post(
        title=title,
        content_md=body_md,
        tags=tags or [],
        canonical_url=canonical_url,
        token=token,
        user_id=user_id,
    )


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--title", required=True)
    p.add_argument("--body-file", required=True, help="Markdown 文件路径（含英文摘要）")
    p.add_argument("--tags", nargs="*", default=[])
    p.add_argument("--canonical", default="", help="微信公众号原文链接")
    p.add_argument("--token", default="")
    p.add_argument("--user-id", default="")
    args = p.parse_args()

    body = open(args.body_file).read()
    url = publish_article(
        title=args.title,
        body_md=body,
        tags=args.tags,
        canonical_url=args.canonical,
        token=args.token or MEDIUM_TOKEN,
        user_id=args.user_id or MEDIUM_USER_ID,
    )
    print(url)
