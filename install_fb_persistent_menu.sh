#!/usr/bin/env bash
curl -X POST -H "Content-Type: application/json" -d @persistent_menu.json "https://graph.facebook.com/v2.6/me/thread_settings?access_token=$FB_PAGE_ACCESS_TOKEN"
