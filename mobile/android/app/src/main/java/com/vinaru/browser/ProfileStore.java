package com.vinaru.browser;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.UUID;

public final class ProfileStore {
    private static final String PREFS = "vinaru_profiles";
    private static final String KEY_PROFILES = "profiles";
    private static final String KEY_ACTIVE = "activeId";
    private static final String[] COLORS = {
            "#3b7cf6", "#ef4b4b", "#2ecc71", "#f2b807", "#9b59b6", "#1abc9c", "#e67e22"
    };

    private ProfileStore() {}

    public static synchronized JSONArray list(Context context) {
        return readProfiles(context);
    }

    public static synchronized JSONObject getActive(Context context) {
        String activeId = prefs(context).getString(KEY_ACTIVE, "");
        if (activeId == null || activeId.isEmpty()) return null;
        JSONArray list = readProfiles(context);
        for (int i = 0; i < list.length(); i++) {
            try {
                JSONObject item = list.getJSONObject(i);
                if (activeId.equals(item.optString("id"))) return item;
            } catch (JSONException ignored) {
            }
        }
        return null;
    }

    public static synchronized JSONObject saveAccount(Context context, JSONObject data) throws JSONException {
        String email = data.optString("email", "").trim().toLowerCase();
        if (email.isEmpty()) throw new JSONException("email is required");
        String id = data.optString("id", "");
        if (id.isEmpty()) id = "local-" + email;

        JSONObject item = new JSONObject();
        item.put("id", id);
        item.put("type", data.optString("type", "local"));
        item.put("email", email);
        item.put("displayName", data.optString("displayName", email));
        item.put("avatarColor", data.optString("avatarColor", COLORS[0]));
        item.put("picture", data.optString("picture", ""));
        item.put("accessToken", data.optString("accessToken", ""));
        item.put("refreshToken", data.optString("refreshToken", ""));
        item.put("createdAt", data.optLong("createdAt", System.currentTimeMillis()));
        item.put("signedOut", false);

        JSONArray list = readProfiles(context);
        JSONArray next = new JSONArray();
        boolean replaced = false;
        next.put(item);
        for (int i = 0; i < list.length(); i++) {
            JSONObject existing = list.getJSONObject(i);
            if (id.equals(existing.optString("id")) || email.equalsIgnoreCase(existing.optString("email"))) {
                replaced = true;
                continue;
            }
            next.put(existing);
        }
        if (!replaced) {
            // already prepended
        }
        writeProfiles(context, next);
        prefs(context).edit().putString(KEY_ACTIVE, id).apply();
        return item;
    }

    public static synchronized JSONObject create(Context context, String displayName) throws JSONException {
        String name = displayName == null ? "" : displayName.trim();
        if (name.isEmpty()) throw new JSONException("Name is required");
        JSONArray list = readProfiles(context);
        JSONObject item = new JSONObject();
        item.put("id", "pf-" + UUID.randomUUID());
        item.put("type", "guest");
        item.put("displayName", name);
        item.put("email", "");
        item.put("avatarColor", COLORS[list.length() % COLORS.length]);
        item.put("createdAt", System.currentTimeMillis());
        item.put("signedOut", false);

        JSONArray next = new JSONArray();
        next.put(item);
        for (int i = 0; i < list.length(); i++) next.put(list.getJSONObject(i));
        writeProfiles(context, next);
        prefs(context).edit().putString(KEY_ACTIVE, item.getString("id")).apply();
        return item;
    }

    public static synchronized JSONObject setActive(Context context, String id) {
        if (id == null || id.isEmpty()) {
            prefs(context).edit().remove(KEY_ACTIVE).apply();
            return null;
        }
        try {
            JSONArray list = readProfiles(context);
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.getJSONObject(i);
                if (id.equals(item.optString("id"))) {
                    item.put("signedOut", false);
                    list.put(i, item);
                    writeProfiles(context, list);
                    prefs(context).edit().putString(KEY_ACTIVE, id).apply();
                    return item;
                }
            }
        } catch (JSONException ignored) {
        }
        return null;
    }

    public static synchronized void clearActive(Context context) {
        try {
            String activeId = prefs(context).getString(KEY_ACTIVE, "");
            if (activeId != null && !activeId.isEmpty()) {
                JSONArray list = readProfiles(context);
                for (int i = 0; i < list.length(); i++) {
                    JSONObject item = list.getJSONObject(i);
                    if (activeId.equals(item.optString("id"))) {
                        item.put("signedOut", true);
                        list.put(i, item);
                        writeProfiles(context, list);
                        break;
                    }
                }
            }
        } catch (JSONException ignored) {
        }
        prefs(context).edit().remove(KEY_ACTIVE).apply();
    }

    public static synchronized boolean remove(Context context, String id) {
        if (id == null || id.isEmpty()) return false;
        try {
            JSONArray list = readProfiles(context);
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
            if (!removed) return false;
            writeProfiles(context, next);
            String activeId = prefs(context).getString(KEY_ACTIVE, "");
            if (id.equals(activeId)) {
                if (next.length() > 0) {
                    prefs(context).edit().putString(KEY_ACTIVE, next.getJSONObject(0).optString("id")).apply();
                } else {
                    prefs(context).edit().remove(KEY_ACTIVE).apply();
                }
            }
            return true;
        } catch (JSONException e) {
            return false;
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONArray readProfiles(Context context) {
        String raw = prefs(context).getString(KEY_PROFILES, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void writeProfiles(Context context, JSONArray list) {
        prefs(context).edit().putString(KEY_PROFILES, list.toString()).apply();
    }
}
