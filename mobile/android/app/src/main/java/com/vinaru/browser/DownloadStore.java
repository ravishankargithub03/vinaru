package com.vinaru.browser;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class DownloadStore {
    private static final String PREFS = "vinaru_downloads";
    private static final String KEY = "items";
    private static final int MAX_ITEMS = 50;

    private DownloadStore() {}

    public static synchronized void add(Context context, JSONObject item) {
        try {
            JSONArray list = read(context);
            JSONArray next = new JSONArray();
            next.put(item);
            for (int i = 0; i < list.length() && next.length() < MAX_ITEMS; i++) {
                next.put(list.getJSONObject(i));
            }
            write(context, next);
        } catch (JSONException ignored) {
        }
    }

    public static synchronized JSONArray list(Context context) {
        return read(context);
    }

    public static synchronized JSONObject find(Context context, String id) {
        JSONArray list = read(context);
        for (int i = 0; i < list.length(); i++) {
            try {
                JSONObject item = list.getJSONObject(i);
                if (id.equals(item.optString("id"))) return item;
            } catch (JSONException ignored) {
            }
        }
        return null;
    }

    public static synchronized void updateByDownloadId(Context context, long downloadId, String state, String localUri) {
        try {
            JSONArray list = read(context);
            boolean changed = false;
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.getJSONObject(i);
                if (item.optLong("downloadId", -1) == downloadId) {
                    item.put("state", state);
                    if (localUri != null && !localUri.isEmpty()) {
                        item.put("localUri", localUri);
                    }
                    changed = true;
                    break;
                }
            }
            if (changed) write(context, list);
        } catch (JSONException ignored) {
        }
    }

    private static JSONArray read(Context context) {
        SharedPreferences prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void write(Context context, JSONArray list) {
        SharedPreferences prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY, list.toString()).apply();
    }
}
