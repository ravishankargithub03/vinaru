package com.vinaru.browser;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.UUID;

public final class LibraryStore {
    private static final String PREFS = "vinaru_library";
    private static final String KEY_BOOKMARKS = "bookmarks";
    private static final String KEY_HISTORY = "history";
    private static final int MAX_HISTORY = 200;
    private static final int MAX_BOOKMARKS = 200;

    private LibraryStore() {}

    public static synchronized JSONArray listBookmarks(Context context) {
        return readArray(context, KEY_BOOKMARKS);
    }

    public static synchronized JSONObject addBookmark(Context context, String title, String url) throws JSONException {
        if (url == null || url.trim().isEmpty()) throw new JSONException("url required");
        String cleanUrl = url.trim();
        JSONArray list = readArray(context, KEY_BOOKMARKS);
        for (int i = 0; i < list.length(); i++) {
            JSONObject existing = list.getJSONObject(i);
            if (cleanUrl.equals(existing.optString("url"))) {
                return existing;
            }
        }
        JSONObject item = new JSONObject();
        item.put("id", "bm-" + UUID.randomUUID());
        item.put("title", (title == null || title.trim().isEmpty()) ? cleanUrl : title.trim());
        item.put("url", cleanUrl);
        item.put("createdAt", System.currentTimeMillis());

        JSONArray next = new JSONArray();
        next.put(item);
        for (int i = 0; i < list.length() && next.length() < MAX_BOOKMARKS; i++) {
            next.put(list.getJSONObject(i));
        }
        writeArray(context, KEY_BOOKMARKS, next);
        return item;
    }

    public static synchronized boolean removeBookmark(Context context, String id) {
        return removeById(context, KEY_BOOKMARKS, id);
    }

    public static synchronized boolean isBookmarked(Context context, String url) {
        if (url == null) return false;
        JSONArray list = readArray(context, KEY_BOOKMARKS);
        for (int i = 0; i < list.length(); i++) {
            try {
                if (url.equals(list.getJSONObject(i).optString("url"))) return true;
            } catch (JSONException ignored) {
            }
        }
        return false;
    }

    public static synchronized JSONArray listHistory(Context context, String query) {
        JSONArray list = readArray(context, KEY_HISTORY);
        if (query == null || query.trim().isEmpty()) return list;
        String q = query.trim().toLowerCase();
        JSONArray filtered = new JSONArray();
        for (int i = 0; i < list.length(); i++) {
            try {
                JSONObject item = list.getJSONObject(i);
                String title = item.optString("title", "").toLowerCase();
                String url = item.optString("url", "").toLowerCase();
                if (title.contains(q) || url.contains(q)) filtered.put(item);
            } catch (JSONException ignored) {
            }
        }
        return filtered;
    }

    public static synchronized void recordHistory(Context context, String title, String url) {
        if (url == null || url.trim().isEmpty()) return;
        String cleanUrl = url.trim();
        if (cleanUrl.startsWith("about:") || cleanUrl.startsWith("data:")) return;
        try {
            JSONArray list = readArray(context, KEY_HISTORY);
            JSONObject match = null;
            int matchIndex = -1;
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.getJSONObject(i);
                if (cleanUrl.equals(item.optString("url"))) {
                    match = item;
                    matchIndex = i;
                    break;
                }
            }

            long now = System.currentTimeMillis();
            if (match != null) {
                match.put("title", (title == null || title.trim().isEmpty()) ? match.optString("title", cleanUrl) : title.trim());
                match.put("visitedAt", now);
                match.put("visitCount", match.optInt("visitCount", 1) + 1);
                JSONArray next = new JSONArray();
                next.put(match);
                for (int i = 0; i < list.length(); i++) {
                    if (i == matchIndex) continue;
                    if (next.length() >= MAX_HISTORY) break;
                    next.put(list.getJSONObject(i));
                }
                writeArray(context, KEY_HISTORY, next);
            } else {
                JSONObject item = new JSONObject();
                item.put("id", "hi-" + UUID.randomUUID());
                item.put("title", (title == null || title.trim().isEmpty()) ? cleanUrl : title.trim());
                item.put("url", cleanUrl);
                item.put("visitedAt", now);
                item.put("visitCount", 1);
                JSONArray next = new JSONArray();
                next.put(item);
                for (int i = 0; i < list.length() && next.length() < MAX_HISTORY; i++) {
                    next.put(list.getJSONObject(i));
                }
                writeArray(context, KEY_HISTORY, next);
            }
        } catch (JSONException ignored) {
        }
    }

    public static synchronized boolean removeHistory(Context context, String id) {
        return removeById(context, KEY_HISTORY, id);
    }

    public static synchronized void clearHistory(Context context, long olderThanMs) {
        try {
            JSONArray list = readArray(context, KEY_HISTORY);
            if (olderThanMs <= 0) {
                writeArray(context, KEY_HISTORY, new JSONArray());
                return;
            }
            long cutoff = System.currentTimeMillis() - olderThanMs;
            JSONArray next = new JSONArray();
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.getJSONObject(i);
                if (item.optLong("visitedAt", 0) >= cutoff) next.put(item);
            }
            writeArray(context, KEY_HISTORY, next);
        } catch (JSONException ignored) {
        }
    }

    private static boolean removeById(Context context, String key, String id) {
        if (id == null || id.isEmpty()) return false;
        try {
            JSONArray list = readArray(context, key);
            JSONArray next = new JSONArray();
            boolean removed = false;
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.getJSONObject(i);
                if (id.equals(item.optString("id"))) {
                    removed = true;
                    continue;
                }
                next.put(item);
            }
            if (removed) writeArray(context, key, next);
            return removed;
        } catch (JSONException e) {
            return false;
        }
    }

    private static JSONArray readArray(Context context, String key) {
        SharedPreferences prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(key, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void writeArray(Context context, String key, JSONArray list) {
        SharedPreferences prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(key, list.toString()).apply();
    }
}
