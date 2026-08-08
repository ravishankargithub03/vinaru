package com.vinaru.browser;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "VinaruLibrary")
public class VinaruLibraryPlugin extends Plugin {

    @PluginMethod
    public void listBookmarks(PluginCall call) {
        call.resolve(wrapItems(LibraryStore.listBookmarks(getContext())));
    }

    @PluginMethod
    public void addBookmark(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", url);
        try {
            JSONObject item = LibraryStore.addBookmark(getContext(), title, url);
            call.resolve(jsonToJs(item));
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Could not add bookmark");
        }
    }

    @PluginMethod
    public void removeBookmark(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("id is required");
            return;
        }
        boolean ok = LibraryStore.removeBookmark(getContext(), id);
        JSObject result = new JSObject();
        result.put("removed", ok);
        call.resolve(result);
    }

    @PluginMethod
    public void isBookmarked(PluginCall call) {
        String url = call.getString("url");
        JSObject result = new JSObject();
        result.put("bookmarked", LibraryStore.isBookmarked(getContext(), url));
        call.resolve(result);
    }

    @PluginMethod
    public void listHistory(PluginCall call) {
        String query = call.getString("query", "");
        call.resolve(wrapItems(LibraryStore.listHistory(getContext(), query)));
    }

    @PluginMethod
    public void recordHistory(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", url);
        LibraryStore.recordHistory(getContext(), title, url);
        call.resolve();
    }

    @PluginMethod
    public void removeHistory(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("id is required");
            return;
        }
        boolean ok = LibraryStore.removeHistory(getContext(), id);
        JSObject result = new JSObject();
        result.put("removed", ok);
        call.resolve(result);
    }

    @PluginMethod
    public void clearHistory(PluginCall call) {
        String mode = call.getString("mode", "all");
        long windowMs = 0;
        if ("hour".equals(mode)) windowMs = 60L * 60L * 1000L;
        else if ("day".equals(mode)) windowMs = 24L * 60L * 60L * 1000L;
        else windowMs = 0;
        LibraryStore.clearHistory(getContext(), windowMs);
        call.resolve();
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
        row.put("title", item.optString("title"));
        row.put("url", item.optString("url"));
        if (item.has("createdAt")) row.put("createdAt", item.optLong("createdAt"));
        if (item.has("visitedAt")) row.put("visitedAt", item.optLong("visitedAt"));
        if (item.has("visitCount")) row.put("visitCount", item.optInt("visitCount"));
        return row;
    }
}
