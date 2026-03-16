package com.warllemedicao.meufinanceiro;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;

@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {
    private static final String TAG = "ShareReceiverPlugin";
    private JSObject pendingShare;

    @Override
    public void load() {
        super.load();
        processIntent(getActivity().getIntent(), false);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        processIntent(intent, true);
    }

    @PluginMethod
    public void getPendingShare(PluginCall call) {
        JSObject response = new JSObject();
        response.put("file", pendingShare);
        pendingShare = null;
        call.resolve(response);
    }

    private void processIntent(Intent intent, boolean notifyListeners) {
        if (intent == null) {
            return;
        }

        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return;
        }

        Uri fileUri = extractSharedUri(intent);
        if (fileUri == null) {
            Log.w(TAG, "Intent de compartilhamento recebido sem URI de arquivo");
            return;
        }

        JSObject payload = buildSharedFilePayload(fileUri);
        if (payload == null) {
            return;
        }

        pendingShare = payload;
        Log.i(TAG, "Arquivo compartilhado recebido: " + payload.optString("name", "comprovante"));

        if (notifyListeners) {
            JSObject event = new JSObject();
            event.put("file", payload);
            notifyListeners("shareIntentReceived", event, true);
        }
    }

    private Uri extractSharedUri(Intent intent) {
        if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
            ArrayList<Uri> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (uris != null && !uris.isEmpty()) {
                return uris.get(0);
            }

            Uri clipUri = extractUriFromClipData(intent);
            if (clipUri != null) {
                return clipUri;
            }
        }

        Object stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (stream instanceof Uri) {
            return (Uri) stream;
        }

        Uri clipUri = extractUriFromClipData(intent);
        if (clipUri != null) {
            return clipUri;
        }

        if (intent.getData() != null) {
            return intent.getData();
        }

        return null;
    }

    private Uri extractUriFromClipData(Intent intent) {
        ClipData clipData = intent.getClipData();
        if (clipData == null || clipData.getItemCount() == 0) {
            return null;
        }

        for (int index = 0; index < clipData.getItemCount(); index++) {
            ClipData.Item item = clipData.getItemAt(index);
            if (item == null) {
                continue;
            }

            Uri uri = item.getUri();
            if (uri != null) {
                return uri;
            }
        }

        return null;
    }

    private JSObject buildSharedFilePayload(Uri fileUri) {
        ContentResolver resolver = getContext().getContentResolver();
        String mimeType = resolver.getType(fileUri);
        String fileName = resolveFileName(fileUri);

        try (InputStream inputStream = resolver.openInputStream(fileUri);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            if (inputStream == null) {
                return null;
            }

            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, bytesRead);
            }

            JSObject payload = new JSObject();
            payload.put("id", String.valueOf(System.currentTimeMillis()));
            payload.put("name", fileName);
            payload.put("mimeType", mimeType != null ? mimeType : "application/octet-stream");
            payload.put("base64Data", Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP));
            return payload;
        } catch (IOException exception) {
            Log.e(TAG, "Falha ao ler arquivo compartilhado", exception);
            return null;
        }
    }

    private String resolveFileName(Uri fileUri) {
        ContentResolver resolver = getContext().getContentResolver();

        try (Cursor cursor = resolver.query(fileUri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) {
                    String displayName = cursor.getString(nameIndex);
                    if (displayName != null && !displayName.trim().isEmpty()) {
                        return displayName;
                    }
                }
            }
        } catch (Exception exception) {
            Log.w(TAG, "Falha ao resolver nome do arquivo compartilhado", exception);
        }

        String fallback = fileUri.getLastPathSegment();
        return fallback != null && !fallback.trim().isEmpty() ? fallback : "comprovante";
    }
}