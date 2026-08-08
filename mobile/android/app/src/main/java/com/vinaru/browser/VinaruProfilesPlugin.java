package com.vinaru.browser;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "VinaruProfiles")
public class VinaruProfilesPlugin extends Plugin {

    @PluginMethod
    public void list(PluginCall call) {
        call.resolve(wrapItems(ProfileStore.list(getContext())));
    }

    @PluginMethod
    public void getActive(PluginCall call) {
        JSONObject active = ProfileStore.getActive(getContext());
        if (active == null) {
            call.resolve(new JSObject());
            return;
        }
        call.resolve(jsonToJs(active));
    }

    @PluginMethod
    public void saveAccount(PluginCall call) {
        try {
            JSONObject data = new JSONObject();
            data.put("id", call.getString("id", ""));
            data.put("type", call.getString("type", "local"));
            data.put("email", call.getString("email", ""));
            data.put("displayName", call.getString("displayName", ""));
            data.put("avatarColor", call.getString("avatarColor", "#3b7cf6"));
            data.put("picture", call.getString("picture", ""));
            data.put("accessToken", call.getString("accessToken", ""));
            data.put("refreshToken", call.getString("refreshToken", ""));
            data.put("createdAt", call.getLong("createdAt", System.currentTimeMillis()));
            JSONObject item = ProfileStore.saveAccount(getContext(), data);
            call.resolve(jsonToJs(item));
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Could not save account");
        }
    }

    @PluginMethod
    public void create(PluginCall call) {
        String displayName = call.getString("displayName", "");
        try {
            JSONObject item = ProfileStore.create(getContext(), displayName);
            call.resolve(jsonToJs(item));
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Could not create profile");
        }
    }

    @PluginMethod
    public void setActive(PluginCall call) {
        String id = call.getString("id");
        JSONObject active = ProfileStore.setActive(getContext(), id);
        if (active == null) {
            call.resolve(new JSObject());
            return;
        }
        call.resolve(jsonToJs(active));
    }

    @PluginMethod
    public void clearActive(PluginCall call) {
        ProfileStore.clearActive(getContext());
        call.resolve();
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("id is required");
            return;
        }
        boolean ok = ProfileStore.remove(getContext(), id);
        JSObject result = new JSObject();
        result.put("removed", ok);
        call.resolve(result);
    }

    private static JSObject wrapItems(JSONArray array) {
        JSArray out = new JSArray();
        for (int i = 0; i < array.length(); i++) {
            try {
                out.put(jsonToJs(array.getJSONObject(i)));
            } catch (Exception ignored) {
            }
        }
        JSObject result = new JSObject();
        result.put("items", out);
        return result;
    }

    private static JSObject jsonToJs(JSONObject item) {
        JSObject row = new JSObject();
        row.put("id", item.optString("id"));
        row.put("type", item.optString("type", "guest"));
        row.put("displayName", item.optString("displayName"));
        row.put("email", item.optString("email"));
        row.put("avatarColor", item.optString("avatarColor", "#3b7cf6"));
        row.put("picture", item.optString("picture", ""));
        row.put("accessToken", item.optString("accessToken", ""));
        row.put("refreshToken", item.optString("refreshToken", ""));
        row.put("createdAt", item.optLong("createdAt", 0));
        row.put("signedOut", item.optBoolean("signedOut", false));
        return row;
    }
}
