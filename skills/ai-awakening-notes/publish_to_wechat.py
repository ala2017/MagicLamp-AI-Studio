#!/usr/bin/env python3
"""
AI觉醒笔记 — 微信公众号草稿箱推送
凭证留空，由外部注入。
"""

import json
import os
import sys
from typing import Optional

import requests


# ——— 凭证 ———
WECHAT_APPID = os.environ.get("WECHAT_APPID", "")
WECHAT_APPSECRET = os.environ.get("WECHAT_APPSECRET", "")

BASE = "https://api.weixin.qq.com/cgi-bin"


def get_access_token(appid: str = "", secret: str = "") -> str:
    a = appid or WECHAT_APPID
    s = secret or WECHAT_APPSECRET
    if not a or not s:
        raise ValueError("WECHAT_APPID / WECHAT_APPSECRET 未设置")
    r = requests.get(f"{BASE}/token?grant_type=client_credential&appid={a}&secret={s}")
    d = r.json()
    if "access_token" not in d:
        raise RuntimeError(f"获取 access_token 失败: {d}")
    return d["access_token"]


def upload_cover_image(token: str, image_path: str) -> str:
    """上传封面图（永久素材），返回 media_id。"""
    with open(image_path, "rb") as f:
        r = requests.post(
            f"{BASE}/material/add_material?access_token={token}&type=image",
            files={"media": f},
        )
    d = r.json()
    if "media_id" not in d:
        raise RuntimeError(f"上传封面图失败: {d}")
    return d["media_id"]


def upload_inline_image(token: str, image_path: str) -> str:
    """上传正文插图，返回可嵌入的 URL。"""
    with open(image_path, "rb") as f:
        r = requests.post(
            f"{BASE}/media/uploadimg?access_token={token}",
            files={"media": f},
        )
    d = r.json()
    if "url" not in d:
        raise RuntimeError(f"上传正文图失败: {d}")
    return d["url"]


def create_draft(
    token: str,
    title: str,
    content_html: str,
    cover_media_id: str,
    digest: str = "",
) -> dict:
    """创建草稿，返回草稿信息。"""
    articles = [{
        "title": title,
        "content": content_html,
        "content_source_url": "",
        "thumb_media_id": cover_media_id,
        "need_open_comment": 0,
        "only_fans_can_comment": 0,
        "digest": digest or title[:54],
    }]
    r = requests.post(
        f"{BASE}/draft/add?access_token={token}",
        json={"articles": articles},
    )
    d = r.json()
    if "media_id" not in d:
        raise RuntimeError(f"创建草稿失败: {d}")
    return d


def publish_article(
    title: str,
    markdown_body: str,
    cover_image_path: str,
    inline_images: list[str],
    appid: str = "",
    appsecret: str = "",
) -> str:
    """
    主入口：推送一篇文章到公众号草稿箱。
    - markdown_body: 已转为公众号富文本 HTML
    - cover_image_path: 封面图本地路径
    - inline_images: 插图本地路径列表
    返回草稿 media_id。
    """
    token = get_access_token(appid, appsecret)
    print(f"[微信] access_token 获取成功")

    cover_id = upload_cover_image(token, cover_image_path)
    print(f"[微信] 封面图上传成功: {cover_id}")

    for i, img in enumerate(inline_images):
        url = upload_inline_image(token, img)
        placeholder = f"{{INLINE_IMAGE_{i}}}"
        markdown_body = markdown_body.replace(placeholder, f'<img src="{url}"/>')
        print(f"[微信] 插图{i+1}上传成功")

    result = create_draft(token, title, markdown_body, cover_id)
    print(f"[微信] 草稿创建成功: {result.get('media_id')}")
    return result.get("media_id", "")


# ——— CLI ———
if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--title", required=True)
    p.add_argument("--body-file", required=True, help="公众号富文本 HTML 文件路径")
    p.add_argument("--cover", required=True, help="封面图路径")
    p.add_argument("--inline", nargs="*", default=[], help="插图路径列表")
    p.add_argument("--appid", default="")
    p.add_argument("--appsecret", default="")
    args = p.parse_args()

    body = open(args.body_file).read()
    mid = publish_article(
        title=args.title,
        markdown_body=body,
        cover_image_path=args.cover,
        inline_images=args.inline,
        appid=args.appid or WECHAT_APPID,
        appsecret=args.appsecret or WECHAT_APPSECRET,
    )
    print(mid)
