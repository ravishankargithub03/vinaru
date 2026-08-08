package com.vinaru.browser;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.webkit.MimeTypeMap;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;

@CapacitorPlugin(name = "VinaruDownloads")
public class VinaruDownloadsPlugin extends Plugin {
    @PluginMethod
    public void list(PluginCall call) {
        refreshStatuses(getContext());
        JSONArray stored = DownloadStore.list(getContext());
        JSArray out = new JSArray();
        for (int i = 0; i < stored.length(); i++) {
            try {
                JSONObject item = stored.getJSONObject(i);
                JSObject row = new JSObject();
                row.put("id", item.optString("id"));
                row.put("filename", item.optString("filename"));
                row.put("url", item.optString("url"));
                row.put("mimeType", item.optString("mimeType"));
                row.put("state", item.optString("state", "queued"));
                row.put("localUri", item.optString("localUri", ""));
                row.put("createdAt", item.optLong("createdAt", 0));
                row.put("downloadId", item.optLong("downloadId", -1));
                out.put(row);
            } catch (Exception ignored) {
            }
        }
        JSObject result = new JSObject();
        result.put("items", out);
        call.resolve(result);
    }

    @PluginMethod
    public void open(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("id is required");
            return;
        }
        refreshStatuses(getContext());
        JSONObject item = DownloadStore.find(getContext(), id);
        if (item == null) {
            call.reject("Download not found");
            return;
        }

        final String localUri = item.optString("localUri", "");
        final String initialMime = item.optString("mimeType", "*/*");
        final long downloadId = item.optLong("downloadId", -1);

        getActivity().runOnUiThread(() -> {
            try {
                Uri uri = null;
                String mimeType = initialMime;
                DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
                if (downloadId >= 0 && dm != null) {
                    uri = dm.getUriForDownloadedFile(downloadId);
                    String dmMime = dm.getMimeTypeForDownloadedFile(downloadId);
                    if (dmMime != null && !dmMime.isEmpty()) {
                        mimeType = dmMime;
                    }
                }
                if (uri == null && localUri != null && !localUri.isEmpty()) {
                    if (localUri.startsWith("content:") || localUri.startsWith("file:")) {
                        uri = Uri.parse(localUri);
                    } else {
                        File file = new File(localUri);
                        uri = FileProvider.getUriForFile(
                                getContext(),
                                getContext().getPackageName() + ".fileprovider",
                                file
                        );
                    }
                }
                if (uri == null) {
                    call.reject("File is not ready yet");
                    return;
                }

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, mimeType != null && !mimeType.isEmpty() ? mimeType : "*/*");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (ActivityNotFoundException e) {
                call.reject("No app available to open this file");
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Failed to open file");
            }
        });
    }

    @PluginMethod
    public void openFolder(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                try {
                    Uri uri = Uri.parse(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).toString());
                    Intent fallback = new Intent(Intent.ACTION_VIEW);
                    fallback.setDataAndType(uri, "resource/folder");
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(fallback);
                    call.resolve();
                } catch (Exception ex) {
                    call.reject("Could not open Downloads folder");
                }
            }
        });
    }

    static void refreshStatuses(Context context) {
        DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) return;
        JSONArray list = DownloadStore.list(context);
        for (int i = 0; i < list.length(); i++) {
            try {
                JSONObject item = list.getJSONObject(i);
                long downloadId = item.optLong("downloadId", -1);
                if (downloadId < 0) continue;
                DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
                Cursor cursor = dm.query(query);
                if (cursor == null) continue;
                try {
                    if (cursor.moveToFirst()) {
                        int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                        String state;
                        switch (status) {
                            case DownloadManager.STATUS_SUCCESSFUL:
                                state = "completed";
                                break;
                            case DownloadManager.STATUS_FAILED:
                                state = "failed";
                                break;
                            case DownloadManager.STATUS_RUNNING:
                                state = "progressing";
                                break;
                            case DownloadManager.STATUS_PAUSED:
                                state = "paused";
                                break;
                            default:
                                state = "queued";
                                break;
                        }
                        String localUri = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));
                        DownloadStore.updateByDownloadId(context, downloadId, state, localUri);
                    }
                } finally {
                    cursor.close();
                }
            } catch (Exception ignored) {
            }
        }
    }

    static String guessMime(String filename, String fallback) {
        if (fallback != null && !fallback.isEmpty() && !"*/*".equals(fallback)) return fallback;
        String ext = MimeTypeMap.getFileExtensionFromUrl(filename);
        if (ext == null || ext.isEmpty()) {
            int dot = filename.lastIndexOf('.');
            if (dot >= 0 && dot < filename.length() - 1) ext = filename.substring(dot + 1);
        }
        if (ext == null || ext.isEmpty()) return "application/octet-stream";
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase());
        return mime != null ? mime : "application/octet-stream";
    }
}
